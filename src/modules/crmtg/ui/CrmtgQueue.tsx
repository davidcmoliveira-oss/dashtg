import { useState } from "react";
import { useCrmtgQueue } from "../api/useCrmtg";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const CrmtgQueue = () => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const { data, isLoading } = useCrmtgQueue(date);

  const rows = (data || []).filter(r => {
    if (statusF !== "all" && r.status !== statusF) return false;
    if (search && !`${r.customer_name} ${r.funnel_nome}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Fila do Dia</h1>
        <p className="text-muted-foreground text-sm">Mensagens programadas e enviadas</p>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44"/>
          <Input placeholder="Buscar cliente ou funil…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64"/>
          <select className="border rounded px-3 text-sm" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
            <option value="all">Todos status</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviado</option>
            <option value="cancelled">Cancelado</option>
            <option value="failed">Falhou</option>
          </select>
          <div className="ml-auto text-sm text-muted-foreground self-center">{rows.length} itens</div>
        </div>
        <div className="overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Cliente</TableHead><TableHead>Telefone</TableHead><TableHead>Funil</TableHead>
              <TableHead>Toque</TableHead><TableHead>Horário</TableHead><TableHead>Versão</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}>Carregando…</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground">Nenhum item.</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell>{r.telefone_normalizado || "—"}</TableCell>
                  <TableCell><span className="text-xs text-muted-foreground mr-1">[{r.funnel_categoria}]</span>{r.funnel_nome}</TableCell>
                  <TableCell>D+{r.touch_ordem ?? 0}</TableCell>
                  <TableCell>{r.horario_previsto ? new Date(r.horario_previsto).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell>v{r.mensagem_versao}</TableCell>
                  <TableCell><Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};
