
DROP TRIGGER IF EXISTS trg_crmtg_reset_on_purchase ON public.tiny_orders_cache;
CREATE TRIGGER trg_crmtg_reset_on_purchase_ins
AFTER INSERT ON public.tiny_orders_cache
FOR EACH ROW EXECUTE FUNCTION public.crmtg_reset_on_purchase();

CREATE TRIGGER trg_crmtg_reset_on_purchase_upd
AFTER UPDATE OF data_pedido ON public.tiny_orders_cache
FOR EACH ROW
WHEN (NEW.data_pedido IS DISTINCT FROM OLD.data_pedido)
EXECUTE FUNCTION public.crmtg_reset_on_purchase();
