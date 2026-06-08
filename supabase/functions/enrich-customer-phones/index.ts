import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  // Some entries may have 9 digits without DDD — invalid
  return null;
}

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

    // Load existing cache
    const { data: existing } = await supabase
      .from("tiny_customers_cache")
      .select("customer_id, telefone_normalizado, sem_telefone")
      .in("customer_id", ids);

    const existingMap = new Map<string, { phone: string | null; missing: boolean }>();
    (existing ?? []).forEach((r: any) => {
      existingMap.set(r.customer_id, {
        phone: r.telefone_normalizado ?? null,
        missing: !!r.sem_telefone,
      });
    });

    const toFetch = ids.filter((id) => !existingMap.has(id));

    if (toFetch.length > 0) {
      // Query order details cache for each customer name. Use raw SQL via rpc would be ideal,
      // but we can do this in chunks using filter on raw_json->cliente->>nome.
      const upserts: any[] = [];

      // Process in chunks of 20 to avoid huge OR queries
      const chunkSize = 20;
      for (let i = 0; i < toFetch.length; i += chunkSize) {
        const chunk = toFetch.slice(i, i + chunkSize);
        // For each name in chunk, query details cache
        const results = await Promise.all(
          chunk.map(async (name) => {
            const { data } = await supabase
              .from("tiny_order_details_cache")
              .select("raw_json")
              .filter("raw_json->cliente->>nome", "eq", name)
              .limit(5);
            return { name, rows: data ?? [] };
          }),
        );

        for (const { name, rows } of results) {
          let fone: string | null = null;
          let celular: string | null = null;
          let codigo: string | null = null;
          for (const row of rows) {
            const cliente = (row as any).raw_json?.cliente;
            if (!cliente) continue;
            if (!codigo && cliente.codigo) codigo = String(cliente.codigo);
            if (!fone && cliente.fone) fone = String(cliente.fone);
            if (!celular && cliente.celular) celular = String(cliente.celular);
            if (fone || celular) break;
          }
          // Fallback: fetch contact details from Tiny API when phones missing
          let source = "raw_json";
          if (!normalizePhoneBR(fone) && !normalizePhoneBR(celular) && codigo) {
            const contato = await fetchTinyContato(codigo);
            if (contato) {
              fone = contato.fone || fone;
              celular = contato.celular || celular;
              source = "tiny_api";
            }
          }
          const normalized = normalizePhoneBR(celular) || normalizePhoneBR(fone);
          upserts.push({
            customer_id: name,
            nome: name,
            fone,
            celular,
            telefone_normalizado: normalized,
            sem_telefone: !normalized,
            source,
          });
          existingMap.set(name, { phone: normalized, missing: !normalized });
        }
      }

      if (upserts.length > 0) {
        await supabase.from("tiny_customers_cache").upsert(upserts, { onConflict: "customer_id" });
      }
    }

    const phones: Record<string, string | null> = {};
    ids.forEach((id) => {
      const v = existingMap.get(id);
      phones[id] = v?.phone ?? null;
    });

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
