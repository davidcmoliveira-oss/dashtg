import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeNome, normalizePhoneBR } from "../_shared/normalizeNome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TINY_TOKEN = Deno.env.get("TINY_API_TOKEN");
const TINY_URL = "https://api.tiny.com.br/api2/contatos.pesquisa.php";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(pagina: number): Promise<any> {
  const body = new URLSearchParams({
    token: TINY_TOKEN ?? "",
    pesquisa: "",
    pagina: String(pagina),
    formato: "JSON",
  });
  const res = await fetch(TINY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  try {
    if (!TINY_TOKEN) {
      return new Response(JSON.stringify({ error: "TINY_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let pagina = 1;
    let totalPages = 1;
    let synced = 0;
    let withPhone = 0;
    let noPhone = 0;
    let consecutiveFails = 0;

    while (pagina <= totalPages) {
      let json: any = null;
      try {
        json = await fetchPage(pagina);
      } catch (e) {
        console.error("fetch error page", pagina, e);
      }

      const status = json?.retorno?.status;
      if (status !== "OK") {
        consecutiveFails++;
        console.warn("page failed", pagina, status, json?.retorno?.erros);
        if (consecutiveFails >= 3) {
          return new Response(
            JSON.stringify({
              status: "partial",
              error: "3 consecutive failures",
              pages_processed: pagina - 1,
              synced,
              with_phone: withPhone,
              no_phone: noPhone,
              duration_ms: Date.now() - started,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        await sleep(2000);
        // retry same page once (loop continues without incrementing)
        const retry = await fetchPage(pagina).catch(() => null);
        if (retry?.retorno?.status !== "OK") {
          pagina++;
          continue;
        }
        json = retry;
      }

      consecutiveFails = 0;
      totalPages = Number(json.retorno.numero_paginas ?? 1);
      const contatos: any[] = json.retorno.contatos ?? [];

      // Dedupe by nome_normalizado within the page (pesquisa.php sometimes
      // returns duplicates and Postgres upsert fails on duplicate keys).
      const seen = new Map<string, any>();
      for (const wrapper of contatos) {
        const c = wrapper?.contato ?? wrapper;
        if (!c?.nome) continue;
        const nomeNorm = normalizeNome(c.nome);
        if (!nomeNorm) continue;
        const tel = normalizePhoneBR(c.fone ?? "");
        // pesquisa.php usually returns empty fone — keep sem_telefone=false so
        // enrich-customer-phones can still fetch contato.obter later using
        // tiny_contact_id. Only flag confirmed-empty when bulk has fone but it
        // doesn't parse.
        seen.set(nomeNorm, {
          customer_id: nomeNorm,
          nome_normalizado: nomeNorm,
          tiny_contact_id: c.id ? String(c.id) : null,
          nome_original: c.nome,
          nome: c.nome,
          fone: c.fone ?? null,
          telefone_normalizado: tel,
          sem_telefone: false,
          match_score: tel ? 100 : 0,
          source: "bulk_sync",
          synced_at: new Date().toISOString(),
        });
      }
      const upserts = [...seen.values()];

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("tiny_customers_cache")
          .upsert(upserts, { onConflict: "nome_normalizado" });
        if (error) {
          console.error("upsert error page", pagina, error);
        } else {
          synced += upserts.length;
          withPhone += upserts.filter((u) => u.telefone_normalizado).length;
          noPhone += upserts.filter((u) => !u.telefone_normalizado).length;
        }
      }

      pagina++;
      if (pagina <= totalPages) await sleep(300);
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        pages_processed: totalPages,
        synced,
        with_phone: withPhone,
        no_phone: noPhone,
        duration_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-tiny-contacts error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
