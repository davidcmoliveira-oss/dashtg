import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeNome, normalizePhoneBR } from "../_shared/normalizeNome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TINY_TOKEN = Deno.env.get("TINY_API_TOKEN");
const TINY_BASE = "https://api.tiny.com.br/api2";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPesquisa(pagina: number): Promise<any> {
  const body = new URLSearchParams({
    token: TINY_TOKEN ?? "", pesquisa: "", pagina: String(pagina), formato: "JSON",
  });
  const res = await fetch(`${TINY_BASE}/contatos.pesquisa.php`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
  });
  return await res.json();
}

async function fetchObter(id: string): Promise<{ fone: string | null; celular: string | null } | null> {
  if (!id) return null;
  try {
    const body = new URLSearchParams({ token: TINY_TOKEN ?? "", formato: "json", id });
    const res = await fetch(`${TINY_BASE}/contato.obter.php`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(),
    });
    const json = await res.json();
    const c = json?.retorno?.contato;
    if (!c) return null;
    return { fone: c.fone || null, celular: c.celular || null };
  } catch (e) { console.error("obter err", id, e); return null; }
}

// Refresh the master list from contatos.pesquisa.php
async function runBulk(supabase: any, started: number, maxMs: number) {
  let pagina = 1, totalPages = 1, synced = 0, withPhone = 0, fails = 0;
  while (pagina <= totalPages && Date.now() - started < maxMs) {
    let json: any = null;
    try { json = await fetchPesquisa(pagina); } catch (e) { console.error("page err", pagina, e); }
    if (json?.retorno?.status !== "OK") {
      fails++;
      if (fails >= 3) break;
      await sleep(1500); pagina++; continue;
    }
    fails = 0;
    totalPages = Number(json.retorno.numero_paginas ?? 1);
    const contatos: any[] = json.retorno.contatos ?? [];
    const seen = new Map<string, any>();
    for (const w of contatos) {
      const c = w?.contato ?? w;
      if (!c?.nome) continue;
      const nomeNorm = normalizeNome(c.nome);
      if (!nomeNorm) continue;
      const tel = normalizePhoneBR(c.fone ?? "");
      seen.set(nomeNorm, {
        customer_id: nomeNorm, nome_normalizado: nomeNorm,
        tiny_contact_id: c.id ? String(c.id) : null,
        nome_original: c.nome, nome: c.nome,
        fone: c.fone ?? null, telefone_normalizado: tel,
        sem_telefone: false, match_score: tel ? 100 : 0,
        source: "bulk_sync", synced_at: new Date().toISOString(),
      });
    }
    const upserts = [...seen.values()];
    if (upserts.length) {
      const { error } = await supabase.from("tiny_customers_cache").upsert(upserts, { onConflict: "nome_normalizado" });
      if (!error) { synced += upserts.length; withPhone += upserts.filter(u => u.telefone_normalizado).length; }
    }
    pagina++;
    if (pagina <= totalPages) await sleep(250);
  }
  return { pages_processed: pagina - 1, total_pages: totalPages, synced, with_phone: withPhone };
}

// Enrich phones: fetch contato.obter.php for records missing phone but having tiny_contact_id
async function runPhones(supabase: any, started: number, maxMs: number, batchSize: number) {
  // Pega lote de pendentes
  const { data: pending } = await supabase
    .from("tiny_customers_cache")
    .select("customer_id, nome_normalizado, tiny_contact_id, nome")
    .is("telefone_normalizado", null)
    .eq("sem_telefone", false)
    .not("tiny_contact_id", "is", null)
    .limit(batchSize);

  const list: any[] = pending || [];
  let filled = 0, marked = 0;
  const CONCURRENCY = 10;
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length && Date.now() - started < maxMs) {
      const idx = cursor++;
      const row = list[idx];
      const det = await fetchObter(row.tiny_contact_id);
      const tel = det ? (normalizePhoneBR(det.celular) || normalizePhoneBR(det.fone)) : null;
      if (tel) {
        await supabase.from("tiny_customers_cache").update({
          fone: det?.fone ?? null, celular: det?.celular ?? null,
          telefone_normalizado: tel, sem_telefone: false,
          source: "bulk_sync+obter", synced_at: new Date().toISOString(),
        }).eq("customer_id", row.customer_id);
        filled++;
      } else {
        await supabase.from("tiny_customers_cache").update({
          sem_telefone: true, source: "bulk_sync+obter", synced_at: new Date().toISOString(),
        }).eq("customer_id", row.customer_id);
        marked++;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Pendentes restantes
  const { count: remaining } = await supabase
    .from("tiny_customers_cache")
    .select("customer_id", { count: "exact", head: true })
    .is("telefone_normalizado", null).eq("sem_telefone", false)
    .not("tiny_contact_id", "is", null);

  return { batch_processed: list.length, filled, marked_no_phone: marked, remaining: remaining ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();
  const MAX_MS = 120_000;

  try {
    if (!TINY_TOKEN) {
      return new Response(JSON.stringify({ error: "TINY_API_TOKEN missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let body: any = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const mode = body?.mode || "auto"; // "bulk" | "phones" | "auto"
    const batchSize = Math.min(Number(body?.batch_size) || 150, 400);

    let bulk: any = null, phones: any = null;
    if (mode === "bulk" || mode === "auto") {
      bulk = await runBulk(supabase, started, MAX_MS / 2);
    }
    if (mode === "phones" || mode === "auto") {
      phones = await runPhones(supabase, started, MAX_MS - (Date.now() - started), batchSize);
    }

    const { count: total } = await supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true });
    const { count: withPhoneTotal } = await supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }).not("telefone_normalizado", "is", null);
    const { count: noPhoneTotal } = await supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }).eq("sem_telefone", true);

    return new Response(JSON.stringify({
      status: "ok", mode,
      bulk, phones,
      total: total ?? 0, with_phone: withPhoneTotal ?? 0, no_phone: noPhoneTotal ?? 0,
      remaining: phones?.remaining ?? 0,
      // Compat com UI antiga
      synced: bulk?.synced ?? phones?.batch_processed ?? 0,
      duration_ms: Date.now() - started,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("sync-tiny-contacts error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
