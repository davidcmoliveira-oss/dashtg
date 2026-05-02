import { ExecutiveBlock } from "@/hooks/useReportsAnalytics";
import { DeltaCard } from "./shared/DeltaCard";
import { ComparisonSelector } from "./shared/ComparisonSelector";
import { ComparisonPreset } from "@/hooks/useReportsAnalytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from "recharts";
import { ReportInfo } from "./shared/ReportInfo";

interface Props {
  block: ExecutiveBlock;
  preset: ComparisonPreset;
  onPresetChange: (p: ComparisonPreset) => void;
}

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");
const fmtDec = (n: number) => (n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const ReportsExecutivePanel = ({ block, preset, onPresetChange }: Props) => {
  const { current, previous, delta, range, series } = block;

  const altas = (Object.entries(delta) as Array<[keyof typeof delta, { abs: number; pct: number }]>)
    .filter(([k]) => k !== "inactive_customers")
    .sort((a, b) => b[1].pct - a[1].pct)
    .slice(0, 3);
  const quedas = (Object.entries(delta) as Array<[keyof typeof delta, { abs: number; pct: number }]>)
    .filter(([k]) => k !== "inactive_customers")
    .sort((a, b) => a[1].pct - b[1].pct)
    .slice(0, 3);

  const labels: Record<string, string> = {
    revenue: "Faturamento",
    orders: "Pedidos",
    unique_customers: "Clientes únicos",
    avg_ticket: "Ticket médio",
    items_per_order: "Itens / pedido",
    recurring_customers: "Recorrentes",
    new_customers: "Novos",
    inactive_customers: "Inativos",
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1">
            <h2 className="text-xl font-bold">Comparativo executivo</h2>
            <ReportInfo>
              <p>KPIs sobre pedidos com status <strong>faturado</strong> no período selecionado vs período anterior equivalente.</p>
              <p><strong>Receita</strong> = soma de net_revenue. <strong>Ticket</strong> = receita / pedidos. <strong>Itens/pedido</strong> conta cada SKU como 1 item (granéis em kg ainda contam como 1).</p>
              <p><strong>Recorrentes</strong>: clientes com 2+ pedidos no histórico. <strong>Inativos</strong>: sem pedido nos últimos 60 dias.</p>
            </ReportInfo>
          </div>
          <p className="text-sm text-muted-foreground">
            {range.label} vs {range.prevLabel}
          </p>
        </div>
        <ComparisonSelector value={preset} onChange={onPresetChange} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DeltaCard label="Faturamento" value={fmtBRL(current.revenue)} delta={delta.revenue} formatDelta={fmtBRL} />
        <DeltaCard label="Pedidos" value={fmtInt(current.orders)} delta={delta.orders} formatDelta={fmtInt} />
        <DeltaCard label="Clientes únicos" value={fmtInt(current.unique_customers)} delta={delta.unique_customers} formatDelta={fmtInt} />
        <DeltaCard label="Ticket médio" value={fmtBRL(current.avg_ticket)} delta={delta.avg_ticket} formatDelta={fmtBRL} />
        <DeltaCard label="Itens / pedido" value={fmtDec(current.items_per_order)} delta={delta.items_per_order} formatDelta={fmtDec} />
        <DeltaCard label="Clientes recorrentes" value={fmtInt(current.recurring_customers)} delta={delta.recurring_customers} formatDelta={fmtInt} />
        <DeltaCard label="Clientes novos" value={fmtInt(current.new_customers)} delta={delta.new_customers} formatDelta={fmtInt} />
        <DeltaCard label="Clientes inativos (60d+)" value={fmtInt(current.inactive_customers)} delta={delta.inactive_customers} formatDelta={fmtInt} invertColors />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">Evolução diária</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Legend />
              <Line type="monotone" dataKey="current" name={range.label} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="previous" name={range.prevLabel} stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-semibold mb-3">Destaques</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Maiores altas</p>
              {altas.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{labels[k as string]}</span>
                  <span className="text-emerald-600 tabular-nums">+{v.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Maiores quedas</p>
              {quedas.map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span>{labels[k as string]}</span>
                  <span className="text-red-600 tabular-nums">{v.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-semibold mb-2">Variação por indicador</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={Object.entries(delta).map(([k, v]) => ({ name: labels[k] || k, pct: Number(v.pct.toFixed(1)) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v}%`} />
            <Bar dataKey="pct" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
