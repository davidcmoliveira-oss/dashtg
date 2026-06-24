REVOKE EXECUTE ON FUNCTION public.push_to_crmtg() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_to_crmtg() TO service_role;