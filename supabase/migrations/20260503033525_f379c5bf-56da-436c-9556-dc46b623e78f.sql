
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  webhook_url TEXT NOT NULL,
  http_method TEXT NOT NULL DEFAULT 'POST',
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  flow_id TEXT,
  match_mode TEXT NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any','all')),
  product_priority BOOLEAN NOT NULL DEFAULT false,
  product_skus TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  exclude_consumidor_final BOOLEAN NOT NULL DEFAULT true,
  require_phone BOOLEAN NOT NULL DEFAULT true,
  require_full_customer BOOLEAN NOT NULL DEFAULT false,
  allow_resend_after_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read automation_rules" ON public.automation_rules FOR SELECT USING (true);
CREATE POLICY "Public insert automation_rules" ON public.automation_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update automation_rules" ON public.automation_rules FOR UPDATE USING (true);
CREATE POLICY "Public delete automation_rules" ON public.automation_rules FOR DELETE USING (true);

CREATE TABLE public.automation_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  tiny_order_id BIGINT,
  customer_name TEXT,
  customer_phone TEXT,
  matched_product TEXT,
  matched_category TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_status INT,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 1,
  is_test BOOLEAN NOT NULL DEFAULT false,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read automation_dispatches" ON public.automation_dispatches FOR SELECT USING (true);
CREATE POLICY "Public insert automation_dispatches" ON public.automation_dispatches FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update automation_dispatches" ON public.automation_dispatches FOR UPDATE USING (true);
CREATE POLICY "Public delete automation_dispatches" ON public.automation_dispatches FOR DELETE USING (true);

CREATE INDEX idx_dispatches_rule_order ON public.automation_dispatches (rule_id, tiny_order_id);
CREATE INDEX idx_dispatches_dispatched_at ON public.automation_dispatches (dispatched_at DESC);

CREATE OR REPLACE FUNCTION public.set_automation_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_automation_rules_updated_at
BEFORE UPDATE ON public.automation_rules
FOR EACH ROW EXECUTE FUNCTION public.set_automation_rules_updated_at();
