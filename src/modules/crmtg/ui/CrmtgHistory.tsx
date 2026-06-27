import { useState } from "react";
import { useCrmtgHistory } from "../api/useCrmtg";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const CrmtgHistory = () => {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCrmtgHistory(500);
  const rows = (data || []).filter(r =>
    !search || `${r.customer_name} ${r.funnel_nome}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico CRM TG</h1>
        <p className="text-muted-foreground text-sm">Registro completo de disparos</p>
      </div>
      <Card className="p-4">
        <div className="flex gap-3 mb-4">
          <Input placeholder="Buscar cliente ou funil…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72"/>
          <div className="ml-auto text-sm text-muted-foreground self-center">{rows.length} registros</div>
        </div>
        <div className="overflow-auto max-h-[70vh]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data/Hora</TableHead><TableHead>Cliente</TableHead><TableHead>Telefone</TableHead>
              <TableHead>Funil</TableHead><TableHead>Toque</TableHead><TableHead>Versão</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}>Carregando…</TableCell></TableRow>}
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
                  <TableCell className="font-medium">{r.customer_name}</TableCell>
                  <TableCell>{r.telefone_normalizado || "—"}</TableCell>
                  <TableCell>{r.funnel_nome} <span className="text-xs text-muted-foreground">[{r.funnel_categoria}]</span></TableCell>
                  <TableCell>D+{r.touch_ordem ?? 0}</TableCell>
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
