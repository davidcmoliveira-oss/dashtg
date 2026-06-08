import { RepurchaseStats } from "@/hooks/useReportsAnalytics";
import { ReportHeader } from "./shared/ReportInfo";
import { BotConversaExportButton } from "../botconversa/BotConversaExportButton";

interface Props { data: RepurchaseStats; }

const fmtBRL = (n: number) => `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const RepurchaseReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <ReportHeader
        title="Recompra"
        subtitle="Quem volta a comprar, em quanto tempo e com que valor"
        info={
          <>
            <p><strong>Taxa de recompra</strong> = clientes com 2+ pedidos faturados ÷ total de clientes.</p>
            <p><strong>Tempo até 2ª compra</strong> = média da diferença em dias entre o 1º e o 2º pedido.</p>
            <p><strong>Coorte</strong>: agrupa clientes pelo mês da 1ª compra; M+N = % desses clientes que voltaram a comprar no mês N seguinte.</p>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Taxa de recompra</p>
          <p className="text-2xl font-bold">{(data.rate * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Tempo médio até 2ª compra</p>
          <p className="text-2xl font-bold tabular-nums">{Math.round(data.avg_days_to_second)} dias</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">Ticket médio na recompra</p>
          <p className="text-2xl font-bold tabular-nums">{fmtBRL(data.avg_repurchase_ticket)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2 text-sm">Top 10 clientes recompradores</h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="text-left p-2">Cliente</th><th className="text-right p-2">Pedidos</th><th className="text-right p-2">Total</th></tr>
              </thead>
              <tbody>
                {data.top_repurchasers.map((r) => (
                  <tr key={r.name} className="border-t border-border">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-right tabular-nums">{r.orders}</td>
                    <td className="p-2 text-right tabular-nums">{fmtBRL(r.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-2 text-sm">Coorte de retenção (% retornaram)</h3>
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Coorte</th>
                  <th className="p-2">M0</th><th className="p-2">M1</th><th className="p-2">M2</th><th className="p-2">M3</th><th className="p-2">M6</th><th className="p-2">M12</th>
                </tr>
              </thead>
              <tbody>
                {data.cohort.map((c) => (
                  <tr key={c.cohort} className="border-t border-border">
                    <td className="p-2 font-medium">{c.cohort}</td>
                    {[c.m0, c.m1, c.m2, c.m3, c.m6, c.m12].map((v, i) => (
                      <td key={i} className="p-2 text-center tabular-nums" style={{ background: `hsla(var(--primary), ${v / 100})` }}>
                        {v}%
                      </td>
                    ))}
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
