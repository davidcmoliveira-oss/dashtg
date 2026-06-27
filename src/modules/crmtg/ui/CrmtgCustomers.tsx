import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, PhoneOff } from "lucide-react";

interface Row {
  customer_id: string;
  fase: string | null;
  funnel_atual_id: string | null;
  entrada_funnel_em: string | null;
  ultimo_pedido_em: string | null;
  telefone_normalizado: string | null;
  funnel_nome?: string | null;
}

export const CrmtgCustomers = () => {
  const [search, setSearch] = useState("");
  const [fase, setFase] = useState<string>("all");
  const [phone, setPhone] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["crmtg-customers-view"],
    queryFn: async () => {
      const [states, funnels, phones] = await Promise.all([
        supabase.from("crmtg_customer_state").select("*").limit(5000),
        supabase.from("crmtg_funnels").select("id, nome"),
        supabase.from("tiny_customers_cache").select("nome, telefone_normalizado").not("telefone_normalizado", "is", null).limit(5000),
      ]);
      const funnelById = new Map((funnels.data || []).map(f => [f.id, f.nome]));
      const phoneByName = new Map<string, string>();
      for (const p of phones.data || []) if (p.nome) phoneByName.set(p.nome.toLowerCase(), p.telefone_normalizado!);
      const rows: Row[] = (states.data || []).map(s => ({
        customer_id: s.customer_id,
        fase: s.fase,
        funnel_atual_id: s.funnel_atual_id,
        entrada_funnel_em: s.entrada_funnel_em,
        ultimo_pedido_em: s.ultimo_pedido_em,
        telefone_normalizado: phoneByName.get(s.customer_id.toLowerCase()) || null,
        funnel_nome: s.funnel_atual_id ? funnelById.get(s.funnel_atual_id) || null : null,
      }));
      return rows;
    },
  });

  const filtered = useMemo(() => {
    let r = data || [];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(x => x.customer_id.toLowerCase().includes(q) || (x.telefone_normalizado || "").includes(q));
    }
    if (fase !== "all") r = r.filter(x => (x.fase || "—") === fase);
    if (phone === "with") r = r.filter(x => !!x.telefone_normalizado);
    if (phone === "without") r = r.filter(x => !x.telefone_normalizado);
    return r.sort((a, b) => (b.ultimo_pedido_em || "").localeCompare(a.ultimo_pedido_em || ""));
  }, [data, search, fase, phone]);

  const fases = useMemo(() => {
    const s = new Set<string>();
    (data || []).forEach(r => s.add(r.fase || "—"));
    return Array.from(s);
  }, [data]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold">Clientes CRM TG</h1>
        <p className="text-muted-foreground text-sm">Estado atual de cada cliente: fase, funil, telefone e última compra.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar nome ou telefone…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={fase} onValueChange={setFase}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Fase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            {fases.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={phone} onValueChange={setPhone}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Telefone" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="with">Com telefone</SelectItem>
            <SelectItem value="without">Sem telefone</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="self-center">{filtered.length} clientes</Badge>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-muted-foreground text-sm">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-muted-foreground text-sm">Nenhum cliente no estado do CRM ainda. Rode o build diário (Painel Inicial) para popular.</div>
        ) : (
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Telefone</th>
                  <th className="p-2">Fase</th>
                  <th className="p-2">Funil</th>
                  <th className="p-2">Entrada</th>
                  <th className="p-2">Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 1000).map(r => (
                  <tr key={r.customer_id} className="border-t hover:bg-muted/30">
                    <td className="p-2">{r.customer_id}</td>
                    <td className="p-2">
                      {r.telefone_normalizado
                        ? <span className="inline-flex items-center gap-1 text-green-600"><Phone className="h-3 w-3" />{r.telefone_normalizado}</span>
                        : <span className="inline-flex items-center gap-1 text-muted-foreground"><PhoneOff className="h-3 w-3" />sem telefone</span>}
                    </td>
                    <td className="p-2"><Badge variant="secondary">{r.fase || "—"}</Badge></td>
                    <td className="p-2">{r.funnel_nome || "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.entrada_funnel_em || "—"}</td>
                    <td className="p-2 text-muted-foreground">{r.ultimo_pedido_em || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 1000 && (
              <div className="p-2 text-xs text-muted-foreground">Mostrando 1000 de {filtered.length}.</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
