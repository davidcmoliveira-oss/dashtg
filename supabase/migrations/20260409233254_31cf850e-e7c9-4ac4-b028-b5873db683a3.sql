
ALTER TABLE public.tiny_orders_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiny_order_details_cache ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default, so no policies needed for edge functions.
-- No public access policies = no anonymous/authenticated user can access these tables.
