import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FunnelCategoria = "reativacao" | "suplementacao" | "granel" | "generico";
export interface CrmtgFunnel {
  id: string; nome: string; categoria: FunnelCategoria; prioridade: number;
  ativo: boolean; produtos_gatilho: string[]; observacoes: string | null;
}
export interface CrmtgTouch {
  id: string; funnel_id: string; ordem: number; dia_offset: number;
  botconversa_flow_id: string | null;
  flow_id_v1: string | null; flow_id_v2: string | null; flow_id_v3: string | null;
  mensagem_v1: string; mensagem_v2: string; mensagem_v3: string;
}
export interface CrmtgSettings {
  id: boolean; sistema_pausado: boolean;
  horario_inicio: string; horario_fim: string;
  lote_tamanho: number; intervalo_min_msg: number; intervalo_max_msg: number;
  intervalo_min_lote: number; intervalo_max_lote: number;
  ultima_execucao_diaria: string | null;
}

export function useCrmtgSettings() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["crmtg-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crmtg_settings").select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return data as CrmtgSettings | null;
    },
  });
  const update = useMutation({
    mutationFn: async (patch: Partial<CrmtgSettings>) => {
      const { error } = await supabase.from("crmtg_settings").update(patch).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crmtg-settings"] }),
  });
  return { ...q, update };
}

export function useCrmtgFunnels() {
  const qc = useQueryClient();
  const funnels = useQuery({
    queryKey: ["crmtg-funnels"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crmtg_funnels").select("*").order("prioridade");
      if (error) throw error;
      return (data || []) as CrmtgFunnel[];
    },
  });
  const touches = useQuery({
    queryKey: ["crmtg-touches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crmtg_funnel_touches").select("*").order("dia_offset");
      if (error) throw error;
      return (data || []) as CrmtgTouch[];
    },
  });
  const saveFunnel = useMutation({
    mutationFn: async (f: Partial<CrmtgFunnel> & { id?: string }) => {
      const { id, ...rest } = f;
      if (id && id.length > 0) {
        const { error } = await supabase.from("crmtg_funnels").update(rest).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from("crmtg_funnels").insert(rest as any).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crmtg-funnels"] }),
  });
  const deleteFunnel = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crmtg_funnels").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crmtg-funnels"] }); qc.invalidateQueries({ queryKey: ["crmtg-touches"] }); },
  });
  const saveTouch = useMutation({
    mutationFn: async (t: Partial<CrmtgTouch> & { id?: string; funnel_id: string }) => {
      if (t.id) { const { error } = await supabase.from("crmtg_funnel_touches").update(t).eq("id", t.id); if (error) throw error; return t.id; }
      const { data, error } = await supabase.from("crmtg_funnel_touches").insert(t as any).select("id").single(); if (error) throw error; return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crmtg-touches"] }),
  });
  const deleteTouch = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crmtg_funnel_touches").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crmtg-touches"] }),
  });
  return { funnels, touches, saveFunnel, deleteFunnel, saveTouch, deleteTouch };
}

export function useCrmtgQueue(runDate?: string) {
  return useQuery({
    queryKey: ["crmtg-queue", runDate],
    queryFn: async () => {
      let q = supabase.from("crmtg_daily_queue").select("*").order("horario_previsto", { ascending: true }).limit(500);
      if (runDate) q = q.eq("run_date", runDate);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCrmtgHistory(limit = 200) {
  return useQuery({
    queryKey: ["crmtg-history", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("crmtg_history").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCrmtgDashboard() {
  return useQuery({
    queryKey: ["crmtg-dashboard"],
    queryFn: async () => {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

      // paginate customer_state to avoid 1000-row cap
      const PAGE = 1000;
      let from = 0;
      const states: { fase: string | null; funnel_atual_id: string | null }[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("crmtg_customer_state")
          .select("fase, funnel_atual_id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        states.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
      }

      const [funnelsRes, queue, runLog] = await Promise.all([
        supabase.from("crmtg_funnels").select("id, nome, categoria, ativo").order("prioridade"),
        supabase.from("crmtg_daily_queue").select("status").eq("run_date", today),
        supabase.from("crmtg_daily_run_log").select("*").eq("run_date", today).maybeSingle(),
      ]);
      const queueRows = queue.data || [];
      const byStatus: Record<string, number> = {};
      for (const r of queueRows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      const byFase: Record<string, number> = {};
      for (const r of states) byFase[r.fase || "—"] = (byFase[r.fase || "—"] || 0) + 1;

      const countByFunnelId: Record<string, number> = {};
      for (const r of states) if (r.funnel_atual_id) countByFunnelId[r.funnel_atual_id] = (countByFunnelId[r.funnel_atual_id] || 0) + 1;
      const funnels = (funnelsRes.data || []) as { id: string; nome: string; categoria: string; ativo: boolean }[];
      const clientesPorFunil = funnels.map(f => ({
        id: f.id, nome: f.nome, categoria: f.categoria, ativo: f.ativo,
        total: countByFunnelId[f.id] || 0,
      }));
      const semFunil = states.filter(r => !r.funnel_atual_id).length;

      return { today, byStatus, byFase, clientesPorFunil, semFunil, runLog: runLog.data, totalQueue: queueRows.length };
    },
  });
}


export async function runDailyBuildNow() {
  return supabase.functions.invoke("crmtg-daily-build", { body: { source: "manual" } });
}
export async function runSenderNow() {
  return supabase.functions.invoke("crmtg-sender", { body: { source: "manual" } });
}
export async function simulateFunnel(funnelId?: string) {
  return supabase.functions.invoke("crmtg-simulate", { body: funnelId ? { funnel_id: funnelId } : {} });
}
export async function generateAiMessages(payload: { categoria: string; dia_offset: number; produto?: string; contexto?: string }) {
  return supabase.functions.invoke("crmtg-ai-messages", { body: payload });
}
