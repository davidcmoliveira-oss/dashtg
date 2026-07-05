GRANT SELECT, UPDATE ON public.tiny_customers_cache TO anon, authenticated;
GRANT ALL ON public.tiny_customers_cache TO service_role;

DROP POLICY IF EXISTS "Allow public update customers cache" ON public.tiny_customers_cache;
CREATE POLICY "Allow public update customers cache"
ON public.tiny_customers_cache
FOR UPDATE
USING (true)
WITH CHECK (true);