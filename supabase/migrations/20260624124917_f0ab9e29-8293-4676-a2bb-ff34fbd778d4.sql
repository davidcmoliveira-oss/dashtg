
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
  v_order record;
  v_tel text;
  v_produtos text[];
BEGIN
  SELECT value INTO v_secret FROM public._ingest_config WHERE key = 'crmtg_hmac';
  IF v_secret IS NULL THEN
    RAISE WARNING 'push_to_crmtg: crmtg_hmac não configurado';
    RETURN NEW;
  END IF;

  SELECT numero, data_pedido, situacao, valor, nome
    INTO v_order
    FROM public.tiny_orders_cache
   WHERE tiny_order_id = NEW.tiny_order_id;

  SELECT telefone_normalizado INTO v_tel
    FROM public.tiny_customers_cache
   WHERE lower(nome) = lower(v_order.nome)
   LIMIT 1;

  SELECT array_agg(DISTINCT (item->>'product_name'))
    INTO v_produtos
    FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS item
   WHERE item->>'product_name' IS NOT NULL;

  v_payload := jsonb_build_object(
    'pedido_id', NEW.tiny_order_id::text,
    'numero', v_order.numero,
    'data_pedido', v_order.data_pedido,
    'situacao', v_order.situacao,
    'valor', v_order.valor,
    'forma_pagamento', NEW.forma_pagamento,
    'cliente_nome', v_order.nome,
    'telefone_normalizado', v_tel,
    'itens', COALESCE(NEW.items, '[]'::jsonb),
    'categorias', ARRAY[]::text[],
    'produtos', COALESCE(v_produtos, ARRAY[]::text[])
  );

  v_body := v_payload::text;
  v_sig := encode(extensions.hmac(v_body::bytea, v_secret::bytea, 'sha256'), 'hex');

  PERFORM net.http_post(
    url := 'https://crmtg.lovable.app/api/public/ingest-pedido',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-signature', v_sig
    ),
    body := v_payload,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'push_to_crmtg falhou: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.push_to_crmtg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_to_crmtg() TO service_role;
