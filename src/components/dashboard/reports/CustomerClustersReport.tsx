import { useState } from "react";
import { CustomerCluster } from "@/hooks/useReportsAnalytics";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ZAxis,
  Legend,
} from "recharts";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReportHeader } from "./shared/ReportInfo";
import { CHART_DEFAULTS, CHART_SERIES, fmtBRL } from "@/lib/chartColors";

interface Props {
  clusters: CustomerCluster[];
}

export const CustomerClustersReport = ({ clusters }: Props) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalSpend = clusters.reduce((a, c) => a + c.total_spend, 0) || 1;

  const scatter = clusters.map((cl, i) => ({
    name: cl.label,
    color: CHART_SERIES[i % CHART_SERIES.length],
    data: cl.customers.slice(0, 100).map((c) => ({
      x: c.avg_days_between_purchases || 0,
      y: c.total_spend,
      cluster: cl.label,
      name: c.customer_name,
    })),
  }));

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <ReportHeader
        title="Clusters de clientes"
        subtitle="Segmentação por frequência e valor — clique para ver clientes e produtos"
        info={
          <>
            <p>
              Cada cluster é definido por <strong>regras combinadas</strong> de frequência (dias entre compras) e ticket médio em relação à mediana.
            </p>
            <p>
              Ex.: <em>Semanais</em> = avg_days_between entre 7 e 10. <em>Alto valor / baixa freq</em> = ticket ≥ 1,5× a mediana e &gt;30 dias entre compras.
            </p>
            <p>Apenas clientes com ao menos 1 pedido faturado são incluídos.</p>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {clusters.map((cl, i) => {
          const isOpen = expanded === cl.id;
          const color = CHART_SERIES[i % CHART_SERIES.length];
          const sharePct = (cl.total_spend / totalSpend) * 100;
          return (
            <div
              key={cl.id}
              className={cn(
                "rounded-lg border bg-background overflow-hidden transition",
                isOpen ? "border-primary shadow-sm" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : cl.id)}
                className="w-full text-left p-3 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                    <p className="text-sm font-semibold truncate">{cl.label}</p>
                  </div>
                  <ChevronDown
                    className={cn("h-4 w-4 text-muted-foreground transition", isOpen && "rotate-180")}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{cl.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>
                    <p className="text-muted-foreground">Clientes</p>
                    <p className="font-semibold tabular-nums">{cl.count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ticket</p>
                    <p className="font-semibold tabular-nums">{fmtBRL(cl.avg_ticket)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold tabular-nums">{fmtBRL(cl.total_spend)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">% receita</p>
                    <p className="font-semibold tabular-nums">{sharePct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full" style={{ width: `${sharePct}%`, background: color }} />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {expanded && (() => {
        const cl = clusters.find((c) => c.id === expanded);
        if (!cl) return null;
        // Aggregate top products in cluster
        const productMap = new Map<string, { qty: number; revenue: number }>();
        cl.customers.forEach((c) => {
          c.products?.forEach((p) => {
            const cur = productMap.get(p.product_name) || { qty: 0, revenue: 0 };
            cur.qty += p.qty_total;
            cur.revenue += p.spend_total;
            productMap.set(p.product_name, cur);
          });
        });
        const topProducts = [...productMap.entries()]
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 10);
        const topCustomers = [...cl.customers]
          .sort((a, b) => b.total_spend - a.total_spend)
          .slice(0, 15);
        return (
          <div className="rounded-lg border border-border bg-muted/20 p-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2 text-sm">Top clientes do cluster</h3>
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Cliente</th>
                      <th className="text-right p-2">Pedidos</th>
                      <th className="text-right p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c) => (
                      <tr key={c.customer_id} className="border-t border-border">
                        <td className="p-2 truncate max-w-[180px]">{c.customer_name}</td>
                        <td className="p-2 text-right tabular-nums">{c.total_orders}</td>
                        <td className="p-2 text-right tabular-nums">{fmtBRL(c.total_spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {cl.customers.length > 15 && (
                <p className="text-xs text-muted-foreground mt-1">+{cl.customers.length - 15} clientes</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-sm">Top produtos do cluster</h3>
              <div className="rounded-md border border-border bg-card overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Produto</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-right p-2">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map(([name, v]) => (
                      <tr key={name} className="border-t border-border">
                        <td className="p-2 truncate max-w-[200px]">{name}</td>
                        <td className="p-2 text-right tabular-nums">{v.qty.toFixed(0)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtBRL(v.revenue)}</td>
                      </tr>
                    ))}
                    {topProducts.length === 0 && (
                      <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">Sem dados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      <div>
        <h3 className="font-semibold mb-2 text-sm">Dispersão Frequência × Valor</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid {...CHART_DEFAULTS.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name="Dias entre compras"
              tick={CHART_DEFAULTS.axisTick}
              label={{ value: "Dias entre compras", position: "insideBottom", offset: -5, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Valor total"
              tick={CHART_DEFAULTS.axisTick}
              tickFormatter={(v) => `R$${Math.round(v / 1000)}k`}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const p: any = payload[0].payload;
                return (
                  <div className="bg-card border border-border p-2 rounded text-xs shadow-md">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-muted-foreground">{p.cluster}</p>
                    <p>{p.x} dias entre compras</p>
                    <p>{fmtBRL(p.y)}</p>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {scatter.map((s) => (
              <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
