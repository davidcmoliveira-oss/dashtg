import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getSupabaseAdmin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const tinyPost = async (endpoint: string, params: Record<string, string>) => {
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) throw new Error(`Tiny API ${res.status}: ${await res.text()}`);
  return res.json();
};

const isRateLimitError = (msg: string) => msg.includes('Bloqueada') || msg.includes('Excedido');
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get('TINY_API_TOKEN');
    if (!token) throw new Error('TINY_API_TOKEN não configurado');
    const db = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 200, 500);

    // 1. Coletar SKUs únicos dos itens já cacheados
    const skuSet = new Set<string>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await db
        .from('tiny_order_details_cache')
        .select('items')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      data.forEach((row: any) => {
        (row.items || []).forEach((it: any) => {
          if (it.sku && String(it.sku).trim()) skuSet.add(String(it.sku).trim());
        });
      });
      if (data.length < PAGE) break;
      from += PAGE;
    }

    // 2. Filtrar SKUs já presentes no cache de produtos
    const allSkus = Array.from(skuSet);
    const { data: existing } = await db.from('tiny_products_cache').select('sku');
    const existingSet = new Set((existing || []).map((r: any) => r.sku));
    const toFetch = allSkus.filter(s => !existingSet.has(s)).slice(0, limit);

    console.log(`Total SKUs: ${allSkus.length}, cached: ${existingSet.size}, fetching: ${toFetch.length}`);

    let fetched = 0;
    let rateLimited = false;
    const rows: any[] = [];

    for (const sku of toFetch) {
      try {
        await delay(300);
        const data = await tinyPost('https://api.tiny.com.br/api2/produto.obter.php', {
          token, formato: 'JSON', pesquisa: sku,
        });
        if (data.retorno?.status === 'Erro') {
          const erros = data.retorno.erros?.map((e: any) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) {
            console.error('Rate limited');
            rateLimited = true;
            break;
          }
          // Produto não encontrado — guardar entrada mínima para não tentar de novo
          rows.push({
            sku, nome: null, categoria: null, marca: null, unidade: null, preco: 0,
            raw_json: { not_found: true, error: erros },
            fetched_at: new Date().toISOString(),
          });
          continue;
        }
        const p = data.retorno?.produto;
        if (p) {
          rows.push({
            sku,
            tiny_product_id: p.id ? parseInt(p.id) : null,
            nome: p.nome || null,
            categoria: p.categoria || null,
            marca: p.marca || null,
            unidade: p.unidade || null,
            preco: parseFloat(p.preco) || 0,
            raw_json: p,
            fetched_at: new Date().toISOString(),
          });
          fetched++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (isRateLimitError(msg)) { rateLimited = true; break; }
        console.error(`Error fetching SKU ${sku}:`, msg);
      }
    }

    if (rows.length > 0) {
      const { error } = await db.from('tiny_products_cache').upsert(rows, { onConflict: 'sku' });
      if (error) console.error('Upsert error:', error.message);
    }

    return new Response(JSON.stringify({
      success: true,
      total_skus: allSkus.length,
      cached_before: existingSet.size,
      attempted: toFetch.length,
      fetched,
      saved: rows.length,
      rate_limited: rateLimited,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Products sync error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
