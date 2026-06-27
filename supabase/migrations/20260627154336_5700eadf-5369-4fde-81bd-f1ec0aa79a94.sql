
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname='public'
       AND tablename LIKE 'crmtg%'
       AND policyname LIKE '%auth_all%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.crmtg_daily_queue DROP CONSTRAINT IF EXISTS crmtg_daily_queue_status_check;
ALTER TABLE public.crmtg_daily_queue ADD CONSTRAINT crmtg_daily_queue_status_check
  CHECK (status = ANY (ARRAY['pending','sent','cancelled','failed','blocked_no_phone']));
