import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const tinyPost = async (endpoint: string, params: Record<string, string>) => {
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tiny API ${res.status}: ${errText}`);
  }
  return res.json();
};

// Fetch order details with concurrency control
const fetchOrderDetails = async (token: string, ids: number[], concurrency = 5) => {
  const results: Record<number, any> = {};
  const queue = [...ids];

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const data = await tinyPost('https://api.tiny.com.br/api2/pedido.obter.php', {
          token,
          formato: 'JSON',
          id: String(id),
        });
        if (data.retorno?.status === 'OK' && data.retorno?.pedido) {
          const pedido = data.retorno.pedido;
          // Tiny v2 API does not provide hora_pedido field
          results[id] = pedido;
        }
      } catch (e) {
        console.error(`Error fetching order ${id}:`, e);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, ids.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tinyApiToken = Deno.env.get('TINY_API_TOKEN');
    if (!tinyApiToken) throw new Error('TINY_API_TOKEN não configurado');

    const { action = 'list', pagina = 1, id, dataInicial, dataFinal, ids } = await req.json().catch(() => ({}));

    if (action === 'batch-details') {
      // Fetch details for a batch of order IDs (max 20 per call to control credits)
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new Error('ids array is required for batch-details');
      }
      const batchIds = ids.slice(0, 20); // Limit to 20 per request
      console.log(`Fetching details for ${batchIds.length} orders`);
      const details = await fetchOrderDetails(tinyApiToken, batchIds, 5);
      
      // Extract relevant fields: items, time, payment
      const enriched: Record<string, any> = {};
      for (const [orderId, pedido] of Object.entries(details)) {
        const items = (pedido.itens || []).map((item: any) => {
          const i = item.item || item;
          return {
            sku: i.codigo || '',
            product_name: i.descricao || 'Sem nome',
            qty: parseFloat(i.quantidade) || 1,
            unit_price: parseFloat(i.valor_unitario) || 0,
            total: parseFloat(i.valor_unitario) * (parseFloat(i.quantidade) || 1),
          };
        });

        enriched[orderId] = {
          hora: pedido.hora || undefined,
          forma_pagamento: pedido.forma_pagamento || 'Não informado',
          items,
          frete: parseFloat(pedido.valor_frete) || 0,
          desconto: parseFloat(pedido.valor_desconto) || 0,
          total_produtos: parseFloat(pedido.total_produtos) || 0,
          numero_ecommerce: pedido.numero_ecommerce || '',
          obs: pedido.obs || '',
          endereco_entrega: pedido.endereco_entrega ? {
            cidade: pedido.endereco_entrega.cidade || '',
            uf: pedido.endereco_entrega.uf || '',
            cep: pedido.endereco_entrega.cep || '',
          } : null,
        };
      }

      return new Response(JSON.stringify({ enriched }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Original list/get logic
    let endpoint = '';
    const formParams: Record<string, string> = { token: tinyApiToken, formato: 'JSON' };

    switch (action) {
      case 'list':
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formParams.pagina = String(pagina);
        if (dataInicial) {
          formParams.dataInicial = dataInicial;
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          formParams.dataInicial = thirtyDaysAgo.toLocaleDateString('pt-BR');
        }
        if (dataFinal) formParams.dataFinal = dataFinal;
        break;
      case 'get':
        if (!id) throw new Error('ID do pedido é obrigatório');
        endpoint = 'https://api.tiny.com.br/api2/pedido.obter.php';
        formParams.id = String(id);
        break;
      default:
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formParams.pagina = String(pagina);
    }

    console.log(`Fetching from Tiny API V2: ${endpoint}`);
    console.log(`Request params: pagina=${pagina}`);

    const data = await tinyPost(endpoint, formParams);
    console.log('Tiny API Response status:', data.retorno?.status);

    if (data.retorno?.status === 'Erro') {
      const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || 'Erro desconhecido';
      const isRateLimited = erros.includes('Bloqueada') || erros.includes('Excedido');
      if (isRateLimited) {
        return new Response(JSON.stringify({ error: erros, rate_limited: true, fallback: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(erros);
    }

    const result = {
      status: data.retorno?.status,
      pagina: data.retorno?.pagina || 1,
      numero_paginas: data.retorno?.numero_paginas || 1,
      pedidos: data.retorno?.pedidos || [],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error in tiny-orders function:', errorMessage);
    
    const isRateLimited = errorMessage.includes('Bloqueada') || errorMessage.includes('Excedido');
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage, 
        fallback: isRateLimited,
        rate_limited: isRateLimited,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
