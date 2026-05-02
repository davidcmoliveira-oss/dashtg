import { useState } from "react";
import { InactivityBucket, InactiveCustomer } from "@/hooks/useReportsAnalytics";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Props {
  buckets: InactivityBucket[];
  customers: InactiveCustomer[];
}

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const InactiveCustomersReport = ({ buckets, customers }: Props) => {
  const [bucket, setBucket] = useState<string | null>(null);
  const filtered = bucket
    ? customers.filter((c) => {
        const b = buckets.find((x) => x.label === bucket);
        if (!b) return false;
        return c.days_inactive >= b.min && (b.max === null || c.days_inactive <= b.max);
      })
    : customers;

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Clientes inativos</h2>
        <p className="text-sm text-muted-foreground">Risco de perda e oportunidades de reativação</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {buckets.map((b) => (
          <button
            key={b.label}
            onClick={() => setBucket(bucket === b.label ? null : b.label)}
            className={`text-left rounded-lg border p-3 transition ${bucket === b.label ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          >
            <p className="text-xs text-muted-foreground">{b.label}</p>
            <p className="text-xl font-bold">{b.customers}</p>
            <p className="text-xs text-muted-foreground">Potencial: {fmtBRL(b.potential_value)}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Distribuição por faixa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets.map((b) => ({ name: b.label, clientes: b.customers }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="clientes" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Valor potencial perdido por faixa</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={buckets.map((b) => ({ name: b.label, valor: Math.round(b.potential_value) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} />
              <Bar dataKey="valor" fill="hsl(var(--secondary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-sm">Top clientes para reativação {bucket ? `(${bucket})` : ""}</h3>
          {bucket && (
            <Button size="sm" variant="ghost" onClick={() => setBucket(null)}>
              Limpar filtro
            </Button>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Cliente</th>
                <th className="text-right p-2">Última compra</th>
                <th className="text-right p-2">Dias inativo</th>
                <th className="text-right p-2">Ticket médio</th>
                <th className="text-right p-2">Total gasto</th>
                <th className="text-left p-2">Categoria top</th>
                <th className="text-left p-2">Pagamento top</th>
                <th className="text-right p-2">Valor potencial</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((c) => (
                <tr key={c.customer_id} className="border-t border-border">
                  <td className="p-2 font-medium">{c.customer_name}</td>
                  <td className="p-2 text-right">{c.last_order_date}</td>
                  <td className="p-2 text-right tabular-nums">{c.days_inactive}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBRL(c.avg_ticket)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBRL(c.total_spend)}</td>
                  <td className="p-2 text-xs">{c.top_category || "-"}</td>
                  <td className="p-2 text-xs">{c.top_payment || "-"}</td>
                  <td className="p-2 text-right tabular-nums text-primary font-semibold">{fmtBRL(c.potential_lost)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                    Nenhum cliente nesta faixa
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
