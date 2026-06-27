
-- ===== Settings (singleton) =====
CREATE TABLE public.crmtg_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  sistema_pausado boolean NOT NULL DEFAULT false,
  horario_inicio time NOT NULL DEFAULT '09:00',
  horario_fim time NOT NULL DEFAULT '20:00',
  lote_tamanho int NOT NULL DEFAULT 5,
  intervalo_min_msg int NOT NULL DEFAULT 8,
  intervalo_max_msg int NOT NULL DEFAULT 25,
  intervalo_min_lote int NOT NULL DEFAULT 60,
  intervalo_max_lote int NOT NULL DEFAULT 180,
  ultima_execucao_diaria timestamptz,
  ultimo_alerta_tiny timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_settings TO authenticated;
GRANT ALL ON public.crmtg_settings TO service_role;
ALTER TABLE public.crmtg_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_settings_auth_all" ON public.crmtg_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.crmtg_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ===== Funnels =====
CREATE TABLE public.crmtg_funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('reativacao','suplementacao','granel','generico')),
  prioridade int NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  produtos_gatilho text[] NOT NULL DEFAULT ARRAY[]::text[],
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_funnels TO authenticated;
GRANT ALL ON public.crmtg_funnels TO service_role;
ALTER TABLE public.crmtg_funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_funnels_auth_all" ON public.crmtg_funnels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_crmtg_funnels_cat_ativo ON public.crmtg_funnels(categoria, ativo);

-- ===== Touches =====
CREATE TABLE public.crmtg_funnel_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid NOT NULL REFERENCES public.crmtg_funnels(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  dia_offset int NOT NULL,
  botconversa_flow_id text,
  mensagem_v1 text NOT NULL DEFAULT '',
  mensagem_v2 text NOT NULL DEFAULT '',
  mensagem_v3 text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_funnel_touches TO authenticated;
GRANT ALL ON public.crmtg_funnel_touches TO service_role;
ALTER TABLE public.crmtg_funnel_touches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_touches_auth_all" ON public.crmtg_funnel_touches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_crmtg_touches_funnel ON public.crmtg_funnel_touches(funnel_id, dia_offset);

-- ===== Customer state =====
CREATE TABLE public.crmtg_customer_state (
  customer_id text PRIMARY KEY,
  fase text,
  funnel_atual_id uuid REFERENCES public.crmtg_funnels(id) ON DELETE SET NULL,
  entrada_funnel_em date,
  ultimo_pedido_em date,
  ultima_avaliacao_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_customer_state TO authenticated;
GRANT ALL ON public.crmtg_customer_state TO service_role;
ALTER TABLE public.crmtg_customer_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_cstate_auth_all" ON public.crmtg_customer_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== Daily queue =====
CREATE TABLE public.crmtg_daily_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL,
  customer_id text NOT NULL,
  customer_name text,
  telefone_normalizado text,
  funnel_id uuid REFERENCES public.crmtg_funnels(id) ON DELETE SET NULL,
  funnel_nome text,
  funnel_categoria text,
  touch_id uuid REFERENCES public.crmtg_funnel_touches(id) ON DELETE SET NULL,
  touch_ordem int,
  horario_previsto timestamptz NOT NULL,
  flow_id text,
  mensagem_versao int NOT NULL DEFAULT 1,
  texto_render text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','cancelled','failed')),
  motivo_cancelamento text,
  enviado_em timestamptz,
  botconversa_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_daily_queue TO authenticated;
GRANT ALL ON public.crmtg_daily_queue TO service_role;
ALTER TABLE public.crmtg_daily_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_queue_auth_all" ON public.crmtg_daily_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_crmtg_queue_run_status ON public.crmtg_daily_queue(run_date, status, horario_previsto);
CREATE INDEX idx_crmtg_queue_customer ON public.crmtg_daily_queue(customer_id, run_date);
CREATE UNIQUE INDEX uq_crmtg_queue_daily_customer ON public.crmtg_daily_queue(run_date, customer_id) WHERE status IN ('pending','sent');

-- ===== History =====
CREATE TABLE public.crmtg_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid,
  run_date date NOT NULL,
  customer_id text NOT NULL,
  customer_name text,
  telefone_normalizado text,
  funnel_id uuid,
  funnel_nome text,
  funnel_categoria text,
  touch_ordem int,
  flow_id text,
  mensagem_versao int,
  texto_enviado text,
  status text NOT NULL,
  motivo_cancelamento text,
  enviado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_history TO authenticated;
GRANT ALL ON public.crmtg_history TO service_role;
ALTER TABLE public.crmtg_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_history_auth_all" ON public.crmtg_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_crmtg_history_customer ON public.crmtg_history(customer_id, created_at DESC);
CREATE INDEX idx_crmtg_history_run ON public.crmtg_history(run_date);

-- ===== Daily run log =====
CREATE TABLE public.crmtg_daily_run_log (
  run_date date PRIMARY KEY,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  elegiveis int NOT NULL DEFAULT 0,
  fila_criada int NOT NULL DEFAULT 0,
  alertas jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'running'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crmtg_daily_run_log TO authenticated;
GRANT ALL ON public.crmtg_daily_run_log TO service_role;
ALTER TABLE public.crmtg_daily_run_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crmtg_runlog_auth_all" ON public.crmtg_daily_run_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ===== updated_at trigger fn (reuse padrão) =====
CREATE OR REPLACE FUNCTION public.set_crmtg_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_crmtg_settings_uat BEFORE UPDATE ON public.crmtg_settings FOR EACH ROW EXECUTE FUNCTION public.set_crmtg_updated_at();
CREATE TRIGGER trg_crmtg_funnels_uat BEFORE UPDATE ON public.crmtg_funnels FOR EACH ROW EXECUTE FUNCTION public.set_crmtg_updated_at();
CREATE TRIGGER trg_crmtg_touches_uat BEFORE UPDATE ON public.crmtg_funnel_touches FOR EACH ROW EXECUTE FUNCTION public.set_crmtg_updated_at();
CREATE TRIGGER trg_crmtg_cstate_uat BEFORE UPDATE ON public.crmtg_customer_state FOR EACH ROW EXECUTE FUNCTION public.set_crmtg_updated_at();

-- ===== Reset on purchase trigger =====
CREATE OR REPLACE FUNCTION public.crmtg_reset_on_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust text;
BEGIN
  v_cust := NEW.id_cliente;
  IF v_cust IS NULL OR v_cust = '' THEN RETURN NEW; END IF;

  UPDATE public.crmtg_customer_state
     SET funnel_atual_id = NULL, fase = NULL, entrada_funnel_em = NULL,
         ultimo_pedido_em = NEW.data_pedido::date, ultima_avaliacao_em = now()
   WHERE customer_id = v_cust;

  UPDATE public.crmtg_daily_queue
     SET status = 'cancelled', motivo_cancelamento = 'nova compra detectada'
   WHERE customer_id = v_cust AND status = 'pending';

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

CREATE TRIGGER trg_crmtg_reset_on_purchase
AFTER INSERT OR UPDATE ON public.tiny_orders_cache
FOR EACH ROW EXECUTE FUNCTION public.crmtg_reset_on_purchase();

-- ===== pg_cron + pg_net jobs =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'crmtg-daily-build',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xabzmirxrvffikkpzphp.supabase.co/functions/v1/crmtg-daily-build',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhYnptaXJ4cnZmZmlra3B6cGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTkxNDYsImV4cCI6MjA4MTQ5NTE0Nn0.HIotA5_z9OKvNhvW8Tpz8sSrH4dYQ5f0_fbl4m0FP2E'),
    body := jsonb_build_object('source','cron')
  );
  $$
);

SELECT cron.schedule(
  'crmtg-sender',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xabzmirxrvffikkpzphp.supabase.co/functions/v1/crmtg-sender',
    headers := jsonb_build_object('Content-Type','application/json','apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhYnptaXJ4cnZmZmlra3B6cGhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTkxNDYsImV4cCI6MjA4MTQ5NTE0Nn0.HIotA5_z9OKvNhvW8Tpz8sSrH4dYQ5f0_fbl4m0FP2E'),
    body := jsonb_build_object('source','cron')
  );
  $$
);
