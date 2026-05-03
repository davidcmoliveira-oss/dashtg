import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  webhook_url: string;
  http_method: string;
  headers: Record<string, string>;
  flow_id: string | null;
  match_mode: "any" | "all";
  product_priority: boolean;
  product_skus: string[];
  categories: string[];
  exclude_consumidor_final: boolean;
  require_phone: boolean;
  require_full_customer: boolean;
  allow_resend_after_days: number | null;
  created_at: string;
  updated_at: string;
}

export type RuleInput = Omit<AutomationRule, "id" | "created_at" | "updated_at">;

export function useAutomations() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar automações", { description: error.message });
    setRules((data ?? []) as AutomationRule[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const upsert = async (input: Partial<RuleInput> & { id?: string }) => {
    const { id, ...rest } = input;
    if (id) {
      const { error } = await (supabase as any).from("automation_rules").update(rest).eq("id", id);
      if (error) { toast.error("Erro ao salvar", { description: error.message }); return false; }
    } else {
      const { error } = await (supabase as any).from("automation_rules").insert(rest as any);
      if (error) { toast.error("Erro ao criar", { description: error.message }); return false; }
    }
    toast.success("Automação salva");
    await load();
    return true;
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("automation_rules").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir", { description: error.message }); return; }
    toast.success("Automação excluída");
    await load();
  };

  const duplicate = async (rule: AutomationRule) => {
    const { id, created_at, updated_at, ...rest } = rule;
    await upsert({ ...rest, name: `${rule.name} (cópia)`, is_active: false } as RuleInput);
  };

  const toggleActive = async (rule: AutomationRule) => {
    await upsert({ id: rule.id, is_active: !rule.is_active });
  };

  const testWebhook = async (rule: AutomationRule, customPayload?: Record<string, unknown>) => {
    const payload = customPayload ?? {
      cliente_nome: "Cliente Teste",
      cliente_telefone: "+5511999999999",
      produto_comprado: "Produto de Teste",
      categoria_produto: rule.categories[0] ?? "Categoria Teste",
      data_compra: new Date().toISOString(),
      pedido_id: 0,
      valor_total: 99.9,
      quantidade: 1,
      regra_disparada: rule.name,
      flow_id: rule.flow_id ?? undefined,
    };
    const { data, error } = await supabase.functions.invoke("automation-engine", {
      body: { ruleId: rule.id, testPayload: payload },
    });
    if (error) { toast.error("Falha no teste", { description: error.message }); return null; }
    if ((data as any)?.success) toast.success(`Webhook OK (${(data as any).status})`);
    else toast.error(`Falha (${(data as any)?.status ?? "erro"})`, { description: (data as any)?.error });
    return data;
  };

  return { rules, isLoading, reload: load, upsert, remove, duplicate, toggleActive, testWebhook };
}

export interface Dispatch {
  id: string;
  rule_id: string;
  tiny_order_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  matched_product: string | null;
  matched_category: string | null;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  success: boolean;
  error_message: string | null;
  attempts: number;
  is_test: boolean;
  dispatched_at: string;
}

export function useDispatches(ruleId?: string) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    let q = (supabase as any).from("automation_dispatches").select("*").order("dispatched_at", { ascending: false }).limit(500);
    if (ruleId) q = q.eq("rule_id", ruleId);
    const { data, error } = await q;
    if (error) toast.error("Erro ao carregar logs", { description: error.message });
    setDispatches((data ?? []) as Dispatch[]);
    setIsLoading(false);
  }, [ruleId]);

  useEffect(() => { load(); }, [load]);

  const resend = async (d: Dispatch) => {
    if (!d.tiny_order_id) { toast.error("Sem pedido vinculado"); return; }
    const { error } = await supabase.functions.invoke("automation-engine", {
      body: { orderId: d.tiny_order_id, ruleId: d.rule_id, ignoreDedup: true },
    });
    if (error) { toast.error("Falha ao reenviar", { description: error.message }); return; }
    toast.success("Reenvio disparado");
    await load();
  };

  return { dispatches, isLoading, reload: load, resend };
}
