import { useCrmtgSettings, runDailyBuildNow, runSenderNow } from "../api/useCrmtg";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const CrmtgSettings = () => {
  const { data, isLoading, error, update } = useCrmtgSettings();
  const [form, setForm] = useState<any>({});
  const [running, setRunning] = useState<"build" | "sender" | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = async () => {
    try { await update.mutateAsync(form); toast.success("Configurações salvas"); }
    catch (e: any) { toast.error(e.message); }
  };

  const doRunBuild = async () => {
    setRunning("build");
    try {
      const { data: r, error } = await runDailyBuildNow();
      if (error) throw error;
      if ((r as any)?.skipped) toast.warning(`Build pulado: ${(r as any).reason}`);
      else toast.success(`Build ok — ${(r as any)?.fila_criada ?? 0} mensagens na fila`);
    } catch (e: any) { toast.error(`Falha no build: ${e.message}`); }
    finally { setRunning(null); }
  };
  const doRunSender = async () => {
    setRunning("sender");
    try {
      const { error } = await runSenderNow();
      if (error) throw error;
      toast.success("Sender executado");
    } catch (e: any) { toast.error(`Falha no sender: ${e.message}`); }
    finally { setRunning(null); }
  };

  if (isLoading) return <div className="text-muted-foreground">Carregando configurações…</div>;
  if (error) return <div className="text-destructive">Erro: {String((error as Error).message)}</div>;
  if (!data) return <div className="text-muted-foreground">Nenhuma configuração encontrada. Recarregue a página.</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Configurações CRM TG</h1>
        <p className="text-muted-foreground text-sm">Controle global do sistema de recompra</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div><Label>Sistema pausado</Label><p className="text-sm text-muted-foreground">Bloqueia todos os disparos.</p></div>
          <Switch checked={!!form.sistema_pausado} onCheckedChange={(v) => setForm({ ...form, sistema_pausado: v })}/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Horário início</Label><Input type="time" value={form.horario_inicio?.slice(0,5) || "09:00"} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })}/></div>
          <div><Label>Horário fim</Label><Input type="time" value={form.horario_fim?.slice(0,5) || "20:00"} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })}/></div>
        </div>

        <div>
          <Label>Tamanho do lote</Label>
          <Input type="number" min={1} max={30} value={form.lote_tamanho ?? 5} onChange={(e) => setForm({ ...form, lote_tamanho: Number(e.target.value) })}/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Intervalo min msg (s)</Label><Input type="number" value={form.intervalo_min_msg ?? 8} onChange={(e) => setForm({ ...form, intervalo_min_msg: Number(e.target.value) })}/></div>
          <div><Label>Intervalo max msg (s)</Label><Input type="number" value={form.intervalo_max_msg ?? 25} onChange={(e) => setForm({ ...form, intervalo_max_msg: Number(e.target.value) })}/></div>
          <div><Label>Intervalo min lote (s)</Label><Input type="number" value={form.intervalo_min_lote ?? 60} onChange={(e) => setForm({ ...form, intervalo_min_lote: Number(e.target.value) })}/></div>
          <div><Label>Intervalo max lote (s)</Label><Input type="number" value={form.intervalo_max_lote ?? 180} onChange={(e) => setForm({ ...form, intervalo_max_lote: Number(e.target.value) })}/></div>
        </div>

        <Button onClick={save} className="w-full">Salvar configurações</Button>
        <p className="text-xs text-muted-foreground">Timezone fixo: America/Sao_Paulo. Última execução diária: {data.ultima_execucao_diaria ? new Date(data.ultima_execucao_diaria).toLocaleString("pt-BR") : "—"}</p>
      </Card>
    </div>
  );
};
