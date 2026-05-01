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
        await delay(350);
        // Etapa A: pesquisa para descobrir id do produto pelo código
        const search = await tinyPost('https://api.tiny.com.br/api2/produtos.pesquisa.php', {
          token, formato: 'JSON', pesquisa: sku,
        });
        if (search.retorno?.status === 'Erro') {
          const erros = search.retorno.erros?.map((e: any) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) { rateLimited = true; break; }
          rows.push({
            sku, nome: null, categoria: null, marca: null, unidade: null, preco: 0,
            raw_json: { not_found: true, stage: 'search', error: erros },
            fetched_at: new Date().toISOString(),
          });
          continue;
        }
        const produtos = search.retorno?.produtos || [];
        // achar match exato pelo codigo
        const match = produtos.find((p: any) => {
          const pp = p.produto || p;
          return String(pp.codigo || '').trim() === sku;
        }) || produtos[0];
        const found = match?.produto || match;
        if (!found?.id) {
          rows.push({
            sku, nome: null, categoria: null, marca: null, unidade: null, preco: 0,
            raw_json: { not_found: true, stage: 'search', error: 'no match' },
            fetched_at: new Date().toISOString(),
          });
          continue;
        }

        // Etapa B: obter detalhes (categoria etc.)
        await delay(350);
        const det = await tinyPost('https://api.tiny.com.br/api2/produto.obter.php', {
          token, formato: 'JSON', id: String(found.id),
        });
        if (det.retorno?.status === 'Erro') {
          const erros = det.retorno.erros?.map((e: any) => e.erro).join(', ') || '';
          if (isRateLimitError(erros)) { rateLimited = true; break; }
          // fallback: usa dados básicos da pesquisa
          rows.push({
            sku,
            tiny_product_id: parseInt(found.id),
            nome: found.nome || null,
            categoria: null,
            marca: found.marca || null,
            unidade: found.unidade || null,
            preco: parseFloat(found.preco) || 0,
            raw_json: { search_only: true, search: found, error: erros },
            fetched_at: new Date().toISOString(),
          });
          fetched++;
          continue;
        }
        const p = det.retorno?.produto;
        if (p) {
          rows.push({
            sku,
            tiny_product_id: p.id ? parseInt(p.id) : parseInt(found.id),
            nome: p.nome || found.nome || null,
            categoria: p.categoria || null,
            marca: p.marca || found.marca || null,
            unidade: p.unidade || found.unidade || null,
            preco: parseFloat(p.preco) || parseFloat(found.preco) || 0,
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
