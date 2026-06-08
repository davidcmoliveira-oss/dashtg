import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeNome, normalizePhoneBR, similarityScore } from "../_shared/normalizeNome.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TINY_TOKEN = Deno.env.get("TINY_API_TOKEN");
const TINY_BASE = "https://api.tiny.com.br/api2";

async function fetchTinyContato(id: string): Promise<{ fone: string | null; celular: string | null } | null> {
  if (!TINY_TOKEN || !id) return null;
  try {
    const body = new URLSearchParams({ token: TINY_TOKEN, formato: "json", id });
    const res = await fetch(`${TINY_BASE}/contato.obter.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = await res.json();
    const contato = json?.retorno?.contato;
    if (!contato) return null;
    return { fone: contato.fone || null, celular: contato.celular || null };
  } catch (e) {
    console.error("tiny contato fetch error", id, e);
    return null;
  }
}

async function searchTinyContatos(nome: string): Promise<any[]> {
  if (!TINY_TOKEN || !nome) return [];
  try {
    const body = new URLSearchParams({ token: TINY_TOKEN, formato: "JSON", pesquisa: nome });
    const res = await fetch(`${TINY_BASE}/contatos.pesquisa.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = await res.json();
    const contatos = json?.retorno?.contatos ?? [];
    return contatos.map((c: any) => c.contato ?? c).filter(Boolean);
  } catch (e) {
    console.error("tiny contato search error", nome, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { customer_ids } = await req.json();
    if (!Array.isArray(customer_ids)) {
      return new Response(JSON.stringify({ error: "customer_ids must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids: string[] = customer_ids.filter((x) => typeof x === "string" && x.trim().length > 0);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const phones: Record<string, string | null> = {};

    // Build normalized lookup for incoming names
    const idToNorm = new Map<string, string>();
    ids.forEach((id) => idToNorm.set(id, normalizeNome(id)));
    const normValues = [...new Set([...idToNorm.values()].filter(Boolean))];

    // 1. Bulk lookup by nome_normalizado
    const cacheMap = new Map<string, { phone: string | null; missing: boolean; score: number; tinyId: string | null; source: string | null }>();
    if (normValues.length > 0) {
      const { data: cached } = await supabase
        .from("tiny_customers_cache")
        .select("nome_normalizado, telefone_normalizado, sem_telefone, match_score, tiny_contact_id, source")
        .in("nome_normalizado", normValues);
      (cached ?? []).forEach((r: any) => {
        if (r.nome_normalizado) {
          cacheMap.set(r.nome_normalizado, {
            phone: r.telefone_normalizado ?? null,
            missing: !!r.sem_telefone,
            score: r.match_score ?? 0,
            tinyId: r.tiny_contact_id ?? null,
            source: r.source ?? null,
          });
        }
      });
    }

    const toFallback: string[] = [];
    for (const id of ids) {
      const norm = idToNorm.get(id) ?? "";
      const c = cacheMap.get(norm);
      if (c?.phone) {
        phones[id] = c.phone;
        continue;
      }
      if (c?.missing && c.score >= 100) {
        phones[id] = null;
        continue;
      }
      toFallback.push(id);
    }

    // 2. Fallback: prefer tiny_contact_id from cache (bulk_sync stored ID but no phone).
    //    Otherwise search by name. Cap work per invocation and run in parallel
    //    to stay within the 150s edge runtime limit.
    const MAX_FALLBACK = 80;
    const CONCURRENCY = 8;
    const capped = toFallback.slice(0, MAX_FALLBACK);
    // Mark unhandled ones as null so the client doesn't block on them.
    for (const id of toFallback.slice(MAX_FALLBACK)) phones[id] = null;

    const processOne = async (id: string) => {
      const nomeNorm = idToNorm.get(id) ?? "";
      if (!nomeNorm) {
        phones[id] = null;
        return;
      }
      const cached = cacheMap.get(nomeNorm);

      if (cached?.tinyId) {
        const det = await fetchTinyContato(cached.tinyId);
        const tel = det
          ? normalizePhoneBR(det.celular) || normalizePhoneBR(det.fone)
          : null;
        await supabase.from("tiny_customers_cache").upsert(
          {
            customer_id: nomeNorm,
            nome_normalizado: nomeNorm,
            tiny_contact_id: cached.tinyId,
            nome: id,
            fone: det?.fone ?? null,
            celular: det?.celular ?? null,
            telefone_normalizado: tel,
            sem_telefone: !tel,
            match_score: 100,
            source: "bulk_sync+obter",
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nome_normalizado" },
        );
        phones[id] = tel;
        return;
      }

      const contatos = await searchTinyContatos(id);
      let bestMatch: any = null;
      let bestScore = 0;
      for (const contato of contatos) {
        const s = similarityScore(normalizeNome(contato.nome), nomeNorm);
        if (s > bestScore) {
          bestScore = s;
          bestMatch = contato;
        }
      }

      if (bestMatch && bestScore >= 85) {
        let fone = bestMatch.fone ?? null;
        let celular = bestMatch.celular ?? null;
        let tel = normalizePhoneBR(celular) || normalizePhoneBR(fone);
        if (!tel && bestMatch.id) {
          const det = await fetchTinyContato(String(bestMatch.id));
          if (det) {
            fone = det.fone || fone;
            celular = det.celular || celular;
            tel = normalizePhoneBR(celular) || normalizePhoneBR(fone);
          }
        }
        await supabase.from("tiny_customers_cache").upsert(
          {
            customer_id: nomeNorm,
            nome_normalizado: nomeNorm,
            tiny_contact_id: bestMatch.id ? String(bestMatch.id) : null,
            nome_original: bestMatch.nome,
            nome: id,
            fone,
            celular,
            telefone_normalizado: tel,
            sem_telefone: !tel,
            match_score: bestScore,
            source: "individual_search",
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nome_normalizado" },
        );
        phones[id] = tel;
      } else {
        await supabase.from("tiny_customers_cache").upsert(
          {
            customer_id: nomeNorm,
            nome_normalizado: nomeNorm,
            nome: id,
            sem_telefone: true,
            telefone_normalizado: null,
            match_score: bestScore,
            source: "individual_search",
            synced_at: new Date().toISOString(),
          },
          { onConflict: "nome_normalizado" },
        );
        phones[id] = null;
      }
    };

    // Run with a small concurrency pool
    let cursor = 0;
    const workers = Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < capped.length) {
        const idx = cursor++;
        try {
          await processOne(capped[idx]);
        } catch (e) {
          console.error("processOne error", capped[idx], e);
          phones[capped[idx]] = null;
        }
      }
    });
    await Promise.all(workers);

    return new Response(JSON.stringify({ phones }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("enrich-customer-phones error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
