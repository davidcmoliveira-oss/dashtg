import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const tinyApiToken = Deno.env.get('TINY_API_TOKEN');
    
    if (!tinyApiToken) {
      throw new Error('TINY_API_TOKEN não configurado');
    }

    const { action = 'list', pagina = 1, id, dataInicial, dataFinal } = await req.json().catch(() => ({}));

    let endpoint = '';
    let formData = new URLSearchParams();
    formData.append('token', tinyApiToken);
    formData.append('formato', 'JSON');

    switch (action) {
      case 'list':
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formData.append('pagina', String(pagina));
        // Buscar pedidos dos últimos 30 dias por padrão
        if (dataInicial) {
          formData.append('dataInicial', dataInicial);
        } else {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          formData.append('dataInicial', thirtyDaysAgo.toLocaleDateString('pt-BR'));
        }
        if (dataFinal) {
          formData.append('dataFinal', dataFinal);
        }
        break;
      case 'get':
        if (!id) throw new Error('ID do pedido é obrigatório');
        endpoint = 'https://api.tiny.com.br/api2/pedido.obter.php';
        formData.append('id', String(id));
        break;
      default:
        endpoint = 'https://api.tiny.com.br/api2/pedidos.pesquisa.php';
        formData.append('pagina', String(pagina));
    }

    console.log(`Fetching from Tiny API V2: ${endpoint}`);
    console.log(`Request params: pagina=${pagina}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tiny API Error:', response.status, errorText);
      throw new Error(`Erro na API Tiny: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Tiny API Response status:', data.retorno?.status);
    
    // Verificar se houve erro na resposta do Tiny
    if (data.retorno?.status === 'Erro') {
      const erros = data.retorno.erros?.map((e: { erro: string }) => e.erro).join(', ') || 'Erro desconhecido';
      console.error('Tiny API returned error:', erros);
      throw new Error(erros);
    }

    // Transformar resposta para formato padronizado
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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
