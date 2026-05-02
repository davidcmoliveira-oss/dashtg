import { ChannelRecurrenceStats } from "@/hooks/useReportsAnalytics";

interface Props { data: ChannelRecurrenceStats; }

export const ChannelRecurrenceReport = ({ data }: Props) => {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-lg font-bold">Recorrência por canal</h2>
        <p className="text-sm text-muted-foreground">Qual canal traz cliente que volta</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-2">Canal</th>
              <th className="text-right p-2">Clientes únicos</th>
              <th className="text-right p-2">Taxa de recompra</th>
              <th className="text-right p-2">Pedidos / cliente</th>
            </tr>
          </thead>
          <tbody>
            {data.by_channel.map((c) => (
              <tr key={c.channel} className="border-t border-border">
                <td className="p-2 font-medium">{c.channel}</td>
                <td className="p-2 text-right tabular-nums">{c.customers}</td>
                <td className="p-2 text-right tabular-nums">{(c.repurchase_rate * 100).toFixed(1)}%</td>
                <td className="p-2 text-right tabular-nums">{c.avg_orders.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
