import { AnchorStats } from "@/hooks/useReportsAnalytics";
import { ReportHeader } from "./shared/ReportInfo";

interface Props { data: AnchorStats; }

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const AnchorProductsReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <ReportHeader
        title="Produtos âncora e complementares"
        subtitle="Produtos que puxam ticket alto e pares mais frequentes"
        info={
          <>
            <p><strong>Âncoras</strong>: produtos mais presentes em pedidos do <em>quartil superior</em> de ticket (top 25%).</p>
            <p><strong>Pares</strong>: combinações de SKUs que mais aparecem juntas em pedidos faturados — ideias de kits.</p>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Âncoras (mais presentes em pedidos de alto ticket)</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Produto</th>
                  <th className="text-right p-2">Aparições alto ticket</th>
                  <th className="text-right p-2">Receita</th>
                </tr>
              </thead>
              <tbody>
                {data.anchors.map((a) => (
                  <tr key={a.name} className="border-t border-border">
                    <td className="p-2">{a.name}</td>
                    <td className="p-2 text-right tabular-nums">{a.appearances_high_ticket}</td>
                    <td className="p-2 text-right tabular-nums">{fmtBRL(a.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Pares mais frequentes (oportunidades de kit)</h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Produto A</th>
                  <th className="text-left p-2">Produto B</th>
                  <th className="text-right p-2">Pedidos</th>
                </tr>
              </thead>
              <tbody>
                {data.pairs.map((p, i) => (
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
