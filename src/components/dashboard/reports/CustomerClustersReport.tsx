import { CustomerCluster } from "@/hooks/useReportsAnalytics";
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ZAxis } from "recharts";

interface Props {
  clusters: CustomerCluster[];
}

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CustomerClustersReport = ({ clusters }: Props) => {
  const scatter = clusters.flatMap((cl) =>
    cl.customers.slice(0, 100).map((c) => ({
      cluster: cl.label,
      x: c.avg_days_between_purchases || 0,
      y: c.total_spend,
      name: c.customer_name,
    })),
  );

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Clusters de clientes</h2>
        <p className="text-sm text-muted-foreground">Segmentação por frequência e valor</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {clusters.map((cl) => (
          <div key={cl.id} className="rounded-lg border border-border bg-background p-3 space-y-1">
            <p className="text-sm font-semibold">{cl.label}</p>
            <p className="text-xs text-muted-foreground">{cl.description}</p>
            <div className="grid grid-cols-2 gap-1 text-xs mt-2">
              <div>
                <p className="text-muted-foreground">Clientes</p>
                <p className="font-semibold">{cl.count}</p>
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
                <p className="text-muted-foreground">Pedidos/cliente</p>
                <p className="font-semibold tabular-nums">{cl.avg_orders.toFixed(1)}</p>
              </div>
            </div>
            <div className="text-xs space-y-0.5 pt-2 border-t border-border mt-2">
              <p><span className="text-muted-foreground">Categoria top:</span> {cl.top_category || "-"}</p>
              <p><span className="text-muted-foreground">Pagamento:</span> {cl.top_payment || "-"}</p>
              <p className="truncate"><span className="text-muted-foreground">Produto:</span> {cl.top_product || "-"}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Dispersão Frequência × Valor</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" dataKey="x" name="Dias entre compras" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Valor total" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
            <ZAxis range={[40, 40]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              formatter={(value: number, name: string) => name === "y" ? fmtBRL(value) : `${value} dias`}
              labelFormatter={() => ""}
              content={({ payload }) => {
                if (!payload?.length) return null;
                const p: any = payload[0].payload;
                return (
                  <div className="bg-card border border-border p-2 rounded text-xs">
                    <p className="font-semibold">{p.name}</p>
                    <p>{p.cluster}</p>
                    <p>{p.x} dias entre compras</p>
                    <p>{fmtBRL(p.y)}</p>
                  </div>
                );
              }}
            />
            <Scatter data={scatter} fill="hsl(var(--primary))" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
