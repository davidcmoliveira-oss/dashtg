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

    const { action = 'list', pagina = 1, id } = await req.json().catch(() => ({}));

    let endpoint = '';
    let method = 'GET';

    switch (action) {
      case 'list':
        endpoint = `https://api.tiny.com.br/public-api/v3/pedidos?pagina=${pagina}`;
        break;
      case 'get':
        if (!id) throw new Error('ID do pedido é obrigatório');
        endpoint = `https://api.tiny.com.br/public-api/v3/pedidos/${id}`;
        break;
      default:
        endpoint = `https://api.tiny.com.br/public-api/v3/pedidos?pagina=${pagina}`;
    }

    console.log(`Fetching from Tiny API: ${endpoint}`);

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${tinyApiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tiny API Error:', response.status, errorText);
      throw new Error(`Erro na API Tiny: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Tiny API Response:', JSON.stringify(data).substring(0, 500));

    return new Response(JSON.stringify(data), {
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
