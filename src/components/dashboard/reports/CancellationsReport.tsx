import { CancellationStats } from "@/hooks/useReportsAnalytics";

interface Props { data: CancellationStats; }

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const CancellationsReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Cancelamentos</h2>
        <p className="text-sm text-muted-foreground">Onde a operação está perdendo receita</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Total de pedidos cancelados</p>
          <p className="text-2xl font-bold">{data.count}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Valor cancelado</p>
          <p className="text-2xl font-bold tabular-nums">{fmtBRL(data.value)}</p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Cancelamentos recentes</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Pedido</th>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Cliente</th>
                <th className="text-right p-2">Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2 text-xs">{c.id}</td>
                  <td className="p-2 text-xs">{c.date}</td>
                  <td className="p-2">{c.customer}</td>
                  <td className="p-2 text-right tabular-nums">{fmtBRL(c.value)}</td>
                </tr>
              ))}
              {data.recent.length === 0 && (
                <tr><td className="p-4 text-center text-muted-foreground" colSpan={4}>Sem cancelamentos no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
