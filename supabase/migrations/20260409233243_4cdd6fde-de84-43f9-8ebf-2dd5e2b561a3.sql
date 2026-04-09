
-- Cache for order listings from pedidos.pesquisa.php
CREATE TABLE public.tiny_orders_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tiny_order_id BIGINT NOT NULL UNIQUE,
  numero BIGINT,
  numero_ecommerce TEXT,
  data_pedido TEXT,
  nome TEXT,
  valor NUMERIC DEFAULT 0,
  situacao TEXT,
  codigo_rastreamento TEXT,
  raw_json JSONB,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiny_orders_cache_order_id ON public.tiny_orders_cache (tiny_order_id);
CREATE INDEX idx_tiny_orders_cache_fetched_at ON public.tiny_orders_cache (fetched_at);

-- Cache for order details from pedido.obter.php
CREATE TABLE public.tiny_order_details_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tiny_order_id BIGINT NOT NULL UNIQUE,
  hora TEXT,
  forma_pagamento TEXT DEFAULT 'Não informado',
  items JSONB DEFAULT '[]'::jsonb,
  frete NUMERIC DEFAULT 0,
  desconto NUMERIC DEFAULT 0,
  total_produtos NUMERIC DEFAULT 0,
  numero_ecommerce TEXT,
  obs TEXT,
  endereco_entrega JSONB,
  raw_json JSONB,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiny_order_details_cache_order_id ON public.tiny_order_details_cache (tiny_order_id);
CREATE INDEX idx_tiny_order_details_cache_fetched_at ON public.tiny_order_details_cache (fetched_at);
