import { useMemo } from "react";
import { UserPlus, Repeat, Info } from "lucide-react";
import { TinyOrder } from "@/types/dashboard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NewVsReturningChartProps {
  /** Pedidos do período filtrado (afetados pelos filtros globais) */
  orders: TinyOrder[];
  /** TODO o histórico de pedidos da base, sem filtros (necessário para saber se é 1ª compra) */
  allOrders: TinyOrder[];
}

const parseDate = (s: string): Date => {
  if (!s) return new Date(NaN);
  const parts = s.split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(s);
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const isConsumerFinal = (name: string) => {
  const n = (name || "").trim().toLowerCase();
  return (
    n === "consumidor final" ||
    n === "consumidor" ||
    n.includes("consumidor final")
  );
};

const formatBRL = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export const NewVsReturningChart = ({ orders, allOrders }: NewVsReturningChartProps) => {
  const data = useMemo(() => {
    // 1) Para cada cliente (exceto consumidor final), calcular a data da PRIMEIRA compra usando TODO o histórico
    const firstOrderByCustomer = new Map<string, number>();
    for (const o of allOrders) {
      if (!o.customer_id) continue;
      if (isConsumerFinal(o.customer_name)) continue;
      const t = parseDate(o.order_date).getTime();
      if (isNaN(t)) continue;
      const prev = firstOrderByCustomer.get(o.customer_id);
      if (prev === undefined || t < prev) {
        firstOrderByCustomer.set(o.customer_id, t);
      }
    }

    // 2) Agrupar pedidos do período (filtrados) por dia
    const dailyMap = new Map<
      string,
      {
        dateLabel: string;
        sortKey: number;
        novosPedidos: number;
        recorrentesPedidos: number;
        novosClientes: Set<string>;
        novosReceita: number;
        recorrentesReceita: number;
      }
    >();

    for (const o of orders) {
      if (!o.customer_id) continue;
      if (isConsumerFinal(o.customer_name)) continue;
      const d = parseDate(o.order_date);
      const t = d.getTime();
      if (isNaN(t)) continue;
      const key = dayKey(d);
      let bucket = dailyMap.get(key);
      if (!bucket) {
        bucket = {
          dateLabel: o.order_date,
          sortKey: t,
          novosPedidos: 0,
          recorrentesPedidos: 0,
          novosClientes: new Set(),
          novosReceita: 0,
          recorrentesReceita: 0,
        };
        dailyMap.set(key, bucket);
      }
      const firstT = firstOrderByCustomer.get(o.customer_id);
      const isNew = firstT !== undefined && firstT === t;
      // Considera "novo" apenas se a primeira compra do cliente em TODA a base é exatamente neste dia
      if (isNew) {
        bucket.novosPedidos += 1;
        bucket.novosClientes.add(o.customer_id);
        bucket.novosReceita += o.total_paid || 0;
      } else {
        bucket.recorrentesPedidos += 1;
        bucket.recorrentesReceita += o.total_paid || 0;
      }
    }

    // 3) Comparativo: novos clientes no MESMO DIA do mês anterior (a partir do histórico completo, sem consumidor final)
    const newCustomersByDayKey = new Map<string, number>();
    firstOrderByCustomer.forEach((t) => {
      const d = new Date(t);
      const k = dayKey(d);
      newCustomersByDayKey.set(k, (newCustomersByDayKey.get(k) || 0) + 1);
    });

    return Array.from(dailyMap.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((b) => {
        const d = new Date(b.sortKey);
        const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate());
        const prevKey = dayKey(prevMonth);
        return {
          date: b.dateLabel,
          novosPedidos: b.novosPedidos,
          recorrentesPedidos: b.recorrentesPedidos,
          novosClientes: b.novosClientes.size,
          novosClientesMesAnterior: newCustomersByDayKey.get(prevKey) || 0,
          novosReceita: b.novosReceita,
          recorrentesReceita: b.recorrentesReceita,
        };
      });
  }, [orders, allOrders]);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, d) => {
        acc.novosClientes += d.novosClientes;
        acc.novosClientesMesAnterior += d.novosClientesMesAnterior;
        acc.novosReceita += d.novosReceita;
        acc.recorrentesReceita += d.recorrentesReceita;
        acc.novosPedidos += d.novosPedidos;
        acc.recorrentesPedidos += d.recorrentesPedidos;
        return acc;
      },
      {
        novosClientes: 0,
        novosClientesMesAnterior: 0,
        novosReceita: 0,
        recorrentesReceita: 0,
        novosPedidos: 0,
        recorrentesPedidos: 0,
      }
    );
  }, [data]);

  const variacao =
    totals.novosClientesMesAnterior > 0
      ? ((totals.novosClientes - totals.novosClientesMesAnterior) /
          totals.novosClientesMesAnterior) *
        100
      : null;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Clientes Novos vs Recorrentes</h3>
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Como é calculado"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm text-xs leading-relaxed">
                  <p className="font-semibold mb-1">Como é calculado</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>
                      Um <b>cliente novo</b> é aquele cujo <b>primeiro pedido em toda a
                      base</b> ocorreu exatamente naquele dia (não apenas no
                      período filtrado).
                    </li>
                    <li>
                      Um <b>cliente recorrente</b> é aquele que já possuía pelo
                      menos um pedido <b>antes</b> daquele dia.
                    </li>
                    <li>
                      Pedidos do <b>“Consumidor Final”</b> são ignorados, pois não
                      identificam um cliente único.
                    </li>
                    <li>
                      A comparação “mesmo dia do mês anterior” usa a contagem de
                      <i> primeiros pedidos </i> registrados nessa data em toda a
                      base.
                    </li>
                    <li>
                      Receita por grupo = soma de <code>total_paid</code> dos
                      pedidos do dia, separados entre novos e recorrentes.
                    </li>
                  </ul>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aquisição × retenção no período filtrado (exclui Consumidor Final).
          </p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-4 mb-4">
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <UserPlus className="h-3.5 w-3.5" />
            Clientes novos
          </div>
          <p className="text-lg font-bold">{totals.novosClientes}</p>
          {variacao !== null && (
            <p
              className={`text-xs ${
                variacao >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(1)}% vs mês
              anterior ({totals.novosClientesMesAnterior})
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Repeat className="h-3.5 w-3.5" />
            Pedidos recorrentes
          </div>
          <p className="text-lg font-bold">{totals.recorrentesPedidos}</p>
          <p className="text-xs text-muted-foreground">
            Pedidos novos: {totals.novosPedidos}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="text-muted-foreground text-xs mb-1">
            Receita — Clientes novos
          </div>
          <p className="text-lg font-bold">{formatBRL(totals.novosReceita)}</p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="text-muted-foreground text-xs mb-1">
            Receita — Recorrentes
          </div>
          <p className="text-lg font-bold">{formatBRL(totals.recorrentesReceita)}</p>
        </div>
      </div>

      <div className="h-[280px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Sem dados no período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 10 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => {
                  if (name.includes("Receita")) return [formatBRL(value), name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                yAxisId="left"
                dataKey="novosPedidos"
                stackId="pedidos"
                name="Pedidos de novos"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="left"
                dataKey="recorrentesPedidos"
                stackId="pedidos"
                name="Pedidos de recorrentes"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="novosClientes"
                name="Clientes novos (dia)"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="novosClientesMesAnterior"
                name="Novos — mesmo dia mês anterior"
                stroke="hsl(var(--chart-4))"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
