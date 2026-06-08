
-- Extend tiny_customers_cache with bulk-sync fields
ALTER TABLE public.tiny_customers_cache
  ADD COLUMN IF NOT EXISTS nome_normalizado text,
  ADD COLUMN IF NOT EXISTS tiny_contact_id text,
  ADD COLUMN IF NOT EXISTS nome_original text,
  ADD COLUMN IF NOT EXISTS match_score int DEFAULT 100,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz DEFAULT now();

-- Backfill nome_normalizado from existing customer_id (which is the customer name)
UPDATE public.tiny_customers_cache
SET nome_normalizado = upper(regexp_replace(
      regexp_replace(translate(customer_id,
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
        'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'),
      '[^A-Za-z0-9 ]', '', 'g'),
      '\s+', ' ', 'g'))
WHERE nome_normalizado IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tiny_customers_nome_norm_unique
  ON public.tiny_customers_cache(nome_normalizado);

CREATE INDEX IF NOT EXISTS idx_tiny_customers_nome
  ON public.tiny_customers_cache(nome_normalizado);

-- Ensure cron + http extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing job if present, then schedule daily run at 06:00 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('sync-tiny-contacts-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-tiny-contacts-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://xabzmirxrvffikkpzphp.supabase.co/functions/v1/sync-tiny-contacts',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhYnptaXJ4cnZmZmlra3B6cGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTkxNDYsImV4cCI6MjA4MTQ5NTE0Nn0.HIotA5_z9OKvNhvW8Tpz8sSrH4dYQ5f0_fbl4m0FP2E"}'::jsonb,
    body:='{}'::jsonb
  );
  $$
);
