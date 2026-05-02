import { ParetoStats } from "@/hooks/useReportsAnalytics";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Props { data: ParetoStats; }

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const RevenueConcentrationReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Concentração de receita</h2>
        <p className="text-sm text-muted-foreground">Risco e dependência de clientes e produtos</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Top 10 clientes</p>
          <p className="text-2xl font-bold">{data.top10_customers_pct.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">da receita total</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Top 10 produtos</p>
          <p className="text-2xl font-bold">{data.top10_products_pct.toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">da receita total</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Top categoria</p>
          <p className="text-2xl font-bold truncate">{data.by_category[0]?.category || "-"}</p>
          <p className="text-xs text-muted-foreground">{data.by_category[0]?.pct.toFixed(1) || 0}% da receita</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Curva de Pareto - Clientes</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data.customers}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={2} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="value" name="Receita" fill="hsl(var(--primary))" />
              <Line yAxisId="right" type="monotone" dataKey="cumPct" name="% acumulado" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Curva de Pareto - Produtos</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data.products}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={2} angle={-30} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="value" name="Receita" fill="hsl(var(--primary))" />
              <Line yAxisId="right" type="monotone" dataKey="cumPct" name="% acumulado" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Receita por categoria</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr><th className="text-left p-2">Categoria</th><th className="text-right p-2">Receita</th><th className="text-right p-2">% total</th></tr>
            </thead>
            <tbody>
              {data.by_category.slice(0, 15).map((c) => (
                <tr key={c.category} className="border-t border-border">
                  <td className="p-2">{c.category}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBRL(c.value)}</td>
                  <td className="p-2 text-right tabular-nums">{c.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
