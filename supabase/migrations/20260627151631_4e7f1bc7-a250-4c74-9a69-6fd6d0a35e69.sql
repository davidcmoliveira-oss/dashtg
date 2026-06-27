
CREATE OR REPLACE FUNCTION public.crmtg_reset_on_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust text;
  v_date date;
BEGIN
  v_cust := NEW.nome;
  IF v_cust IS NULL OR v_cust = '' THEN RETURN NEW; END IF;

  BEGIN
    v_date := to_date(NEW.data_pedido, 'DD/MM/YYYY');
  EXCEPTION WHEN OTHERS THEN v_date := current_date;
  END;

  UPDATE public.crmtg_customer_state
     SET funnel_atual_id = NULL, fase = NULL, entrada_funnel_em = NULL,
         ultimo_pedido_em = v_date, ultima_avaliacao_em = now()
   WHERE customer_id = v_cust;

  UPDATE public.crmtg_daily_queue
     SET status = 'cancelled', motivo_cancelamento = 'nova compra detectada'
   WHERE customer_id = v_cust AND status = 'pending';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
