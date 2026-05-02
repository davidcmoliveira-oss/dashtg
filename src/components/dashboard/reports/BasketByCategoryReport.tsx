import { BasketStats } from "@/hooks/useReportsAnalytics";

interface Props { data: BasketStats; }

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const BasketByCategoryReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Cesta média por categoria</h2>
        <p className="text-sm text-muted-foreground">Categorias âncora e oportunidades de cross-sell</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Ticket e itens médios quando categoria está presente</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Categoria</th>
                  <th className="text-right p-2">Ticket médio</th>
                  <th className="text-right p-2">Itens médios</th>
                  <th className="text-right p-2">Aparições</th>
                </tr>
              </thead>
              <tbody>
                {data.by_category.slice(0, 15).map((c) => (
                  <tr key={c.category} className="border-t border-border">
                    <td className="p-2">{c.category}</td>
                    <td className="p-2 text-right tabular-nums">{fmtBRL(c.avg_ticket_with)}</td>
                    <td className="p-2 text-right tabular-nums">{c.avg_items_with.toFixed(1)}</td>
                    <td className="p-2 text-right tabular-nums">{c.appearances}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-sm">Pares de categorias mais frequentes</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Categoria A</th>
                  <th className="text-left p-2">Categoria B</th>
                  <th className="text-right p-2">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {data.cooccurrence.slice(0, 15).map((p, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2">{p.a}</td>
                    <td className="p-2">{p.b}</td>
                    <td className="p-2 text-right tabular-nums">{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
