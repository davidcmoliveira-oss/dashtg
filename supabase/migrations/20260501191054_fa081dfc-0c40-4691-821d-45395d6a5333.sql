CREATE TABLE public.tiny_products_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  tiny_product_id BIGINT,
  nome TEXT,
  categoria TEXT,
  marca TEXT,
  unidade TEXT,
  preco NUMERIC DEFAULT 0,
  raw_json JSONB,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_tiny_products_cache_sku ON public.tiny_products_cache(sku);

ALTER TABLE public.tiny_products_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to products cache"
ON public.tiny_products_cache
FOR SELECT
TO public
USING (true);