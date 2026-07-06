ALTER TABLE public.crmtg_funnel_touches
  ADD COLUMN IF NOT EXISTS flow_id_v1 text,
  ADD COLUMN IF NOT EXISTS flow_id_v2 text,
  ADD COLUMN IF NOT EXISTS flow_id_v3 text;