
CREATE POLICY "Allow public read access to orders cache"
ON public.tiny_orders_cache
FOR SELECT
USING (true);

CREATE POLICY "Allow public read access to order details cache"
ON public.tiny_order_details_cache
FOR SELECT
USING (true);
