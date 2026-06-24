
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public._ingest_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public._ingest_config TO service_role;
REVOKE ALL ON public._ingest_config FROM PUBLIC, anon, authenticated;
ALTER TABLE public._ingest_config ENABLE ROW LEVEL SECURITY;
-- sem policies: só service_role acessa (bypassa RLS)

CREATE OR REPLACE FUNCTION public.push_to_crmtg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_payload jsonb;
  v_body text;
  v_sig text;
  v_raw jsonb;
  v_cli jsonb;
BEGIN
  SELECT value INTO v_secret FROM public._ingest_config WHERE key = 'crmtg_hmac';
  IF v_secret IS NULL THEN
    RAISE WARNING 'push_to_crmtg: crmtg_hmac não configurado em _ingest_config';
    RETURN NEW;
  END IF;

  v_raw := COALESCE(NEW.raw_json, '{}'::jsonb);
  v_cli := COALESCE(v_raw->'cliente', '{}'::jsonb);

  v_payload := jsonb_build_object(
    'pedido_id', NEW.order_id,
    'numero', NEW.numero,
    'data_pedido', NEW.order_date,
    'situacao', NEW.situacao,
    'valor', NEW.total_paid,
    'forma_pagamento', NEW.forma_pagamento,
    'cliente_nome', COALESCE(NEW.cliente_nome, v_cli->>'nome'),
    'telefone', COALESCE(v_cli->>'fone', v_cli->>'celular'),
    'telefone_normalizado', NEW.telefone_normalizado,
    'itens', COALESCE(NEW.itens, '[]'::jsonb),
    'categorias', COALESCE(NEW.categorias, ARRAY[]::text[]),
    'produtos', COALESCE(NEW.produtos, ARRAY[]::text[])
  );

  v_body := v_payload::text;
  v_sig := encode(extensions.hmac(v_body::bytea, v_secret::bytea, 'sha256'), 'hex');

  PERFORM net.http_post(
    url := 'https://crmtg.lovable.app/api/public/ingest-pedido',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-signature', v_sig
    ),
    body := v_body::jsonb,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_to_crmtg falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_to_crmtg ON public.tiny_order_details_cache;
CREATE TRIGGER trg_push_to_crmtg
AFTER INSERT OR UPDATE ON public.tiny_order_details_cache
FOR EACH ROW EXECUTE FUNCTION public.push_to_crmtg();
