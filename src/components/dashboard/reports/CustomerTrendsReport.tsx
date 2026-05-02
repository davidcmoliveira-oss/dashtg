import { ReportsAnalytics } from "@/hooks/useReportsAnalytics";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Props {
  trendSeries: ReportsAnalytics["trendSeries"];
  behaviorChange: ReportsAnalytics["behaviorChange"];
}

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CustomerTrendsReport = ({ trendSeries, behaviorChange }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Tendências de clientes</h2>
        <p className="text-sm text-muted-foreground">Mudanças de comportamento ao longo do período</p>
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Pedidos, receita e ticket por semana</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="orders" name="Pedidos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--secondary))" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="avgTicket" name="Ticket médio" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Maiores mudanças de comportamento (1ª metade vs 2ª metade do período)</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Cliente</th>
                <th className="text-right p-2">Δ Frequência</th>
                <th className="text-right p-2">Δ Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {behaviorChange.map((b) => (
                <tr key={b.name} className="border-t border-border">
                  <td className="p-2">{b.name}</td>
                  <td className={`p-2 text-right tabular-nums ${b.deltaFreq < 0 ? "text-red-600" : b.deltaFreq > 0 ? "text-emerald-600" : ""}`}>
                    {b.deltaFreq > 0 ? "+" : ""}{b.deltaFreq}
                  </td>
                  <td className={`p-2 text-right tabular-nums ${b.deltaTicket < 0 ? "text-red-600" : b.deltaTicket > 0 ? "text-emerald-600" : ""}`}>
                    {b.deltaTicket > 0 ? "+" : ""}{fmtBRL(b.deltaTicket)}
                  </td>
                </tr>
              ))}
              {behaviorChange.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={3}>
                    Sem mudanças relevantes no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
