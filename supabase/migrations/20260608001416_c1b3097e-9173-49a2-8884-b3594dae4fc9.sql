CREATE TABLE public.tiny_customers_cache (
  customer_id text PRIMARY KEY,
  nome text,
  fone text,
  celular text,
  telefone_normalizado text,
  sem_telefone boolean NOT NULL DEFAULT false,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tiny_customers_cache TO anon;
GRANT SELECT ON public.tiny_customers_cache TO authenticated;
GRANT ALL ON public.tiny_customers_cache TO service_role;

ALTER TABLE public.tiny_customers_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to customers cache"
  ON public.tiny_customers_cache FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.set_tiny_customers_cache_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tiny_customers_cache_updated_at
BEFORE UPDATE ON public.tiny_customers_cache
FOR EACH ROW EXECUTE FUNCTION public.set_tiny_customers_cache_updated_at();