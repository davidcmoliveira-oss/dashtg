import { useCrmtgDashboard, useCrmtgSettings, runDailyBuildNow, runSenderNow } from "../api/useCrmtg";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, PlayCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const CrmtgDashboard = () => {
  const dash = useCrmtgDashboard();
  const settings = useCrmtgSettings();
  const [busy, setBusy] = useState(false);

  const d = dash.data;
  const s = settings.data;
  const pending = d?.byStatus.pending || 0;
  const sent = d?.byStatus.sent || 0;
  const cancelled = d?.byStatus.cancelled || 0;
  const failed = d?.byStatus.failed || 0;

  const lote = s?.lote_tamanho ?? 5;
  const avgIntervaloMsg = ((s?.intervalo_min_msg ?? 8) + (s?.intervalo_max_msg ?? 25)) / 2;
  const etaMin = Math.ceil((pending * avgIntervaloMsg) / 60);

  const handleBuild = async () => { setBusy(true); const { error } = await runDailyBuildNow(); setBusy(false); error ? toast.error(error.message) : (toast.success("Fila do dia gerada"), dash.refetch()); };
  const handleSend = async () => { setBusy(true); const { error } = await runSenderNow(); setBusy(false); error ? toast.error(error.message) : (toast.success("Lote disparado"), dash.refetch()); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CRM TG — Painel Inicial</h1>
          <p className="text-muted-foreground text-sm">Visão executiva da operação de recompra • {d?.today}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBuild} disabled={busy} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4"/>Gerar Fila</Button>
          <Button onClick={handleSend} disabled={busy} className="gap-2"><PlayCircle className="h-4 w-4"/>Disparar Lote</Button>
        </div>
      </div>

      {s?.sistema_pausado && (
        <Card className="p-4 border-destructive/50 bg-destructive/5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5"/>
          <div><strong>Sistema pausado.</strong> Nenhum disparo será feito até reativar nas Configurações.</div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Programadas hoje</div><div className="text-2xl font-bold">{d?.totalQueue ?? 0}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Enviadas</div><div className="text-2xl font-bold text-emerald-600">{sent}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-bold text-amber-600">{pending}</div><div className="text-xs text-muted-foreground mt-1">≈ {etaMin} min restantes</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Canceladas / Falhas</div><div className="text-2xl font-bold">{cancelled + failed}</div></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Clientes por fase</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(d?.byFase || {}).map(([k,v]) => (
              <div key={k} className="flex justify-between"><Badge variant="outline">{k}</Badge><span>{v}</span></div>
            ))}
            {!Object.keys(d?.byFase || {}).length && <div className="text-muted-foreground text-sm">Sem dados ainda.</div>}
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Clientes por funil</h3>
          <div className="space-y-1 text-sm">
            {(d?.clientesPorFunil || []).map(f => (
              <div key={f.id} className="flex justify-between items-center gap-2">
                <span className={f.ativo ? "" : "text-muted-foreground line-through"}>{f.nome}</span>
                <Badge variant={f.total > 0 ? "default" : "outline"}>{f.total}</Badge>
              </div>
            ))}
            {!!d?.semFunil && (
              <div className="flex justify-between items-center gap-2 pt-2 border-t mt-2">
                <span className="text-muted-foreground">Sem funil atribuído</span>
                <Badge variant="outline">{d.semFunil}</Badge>
              </div>
            )}
            {!d?.clientesPorFunil?.length && <div className="text-muted-foreground text-sm">Nenhum funil cadastrado.</div>}
          </div>
        </Card>

      </div>

      {d?.runLog && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Última execução diária</h3>
          <div className="text-sm text-muted-foreground">Status: <strong>{d.runLog.status}</strong> • Elegíveis: {d.runLog.elegiveis} • Fila criada: {d.runLog.fila_criada}</div>
          {Array.isArray(d.runLog.alertas) && d.runLog.alertas.length > 0 && (
            <div className="mt-2 text-sm text-amber-700">Alertas: {JSON.stringify(d.runLog.alertas)}</div>
          )}
        </Card>
      )}
    </div>
  );
};
