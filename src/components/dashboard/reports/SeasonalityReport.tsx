import { SeasonalityStats } from "@/hooks/useReportsAnalytics";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ReportHeader } from "./shared/ReportInfo";
import { CHART_COLORS, CHART_DEFAULTS } from "@/lib/chartColors";

interface Props { data: SeasonalityStats; }

const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const buckets = ["0-3", "3-6", "6-9", "9-12", "12-15", "15-18", "18-21", "21-24"];

export const SeasonalityReport = ({ data }: Props) => {
  const max = Math.max(...data.weekday_hour.flat(), 1);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <ReportHeader
        title="Sazonalidade"
        subtitle="Padrão por dia da semana, horário e dia do mês"
        info={
          <>
            <p>Conta pedidos faturados em todo o histórico por dia da semana × janela de 3 horas (00-03, 03-06, ...).</p>
            <p>Quando o horário não está disponível na origem, é estimado em 12h. Ajuste sua operação a partir dos picos.</p>
          </>
        }
      />

      <div>
        <h3 className="font-semibold mb-2 text-sm">Heatmap dia × horário (faixas de 3h)</h3>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="p-1"></th>
                {buckets.map((b) => <th key={b} className="p-1 text-center text-muted-foreground font-normal">{b}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => (
                <tr key={d}>
                  <td className="p-1 text-muted-foreground pr-2">{d}</td>
                  {data.weekday_hour[i].map((v, j) => (
                    <td key={j} className="p-0.5">
                      <div
                        className="w-12 h-8 rounded flex items-center justify-center text-[10px]"
                        style={{ background: `hsla(var(--primary), ${v / max})`, color: v / max > 0.5 ? "white" : "inherit" }}
                      >
                        {v}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-2 text-sm">Pedidos por dia do mês</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.by_monthday}>
            <CartesianGrid {...CHART_DEFAULTS.grid} />
            <XAxis dataKey="day" tick={CHART_DEFAULTS.axisTick} />
            <YAxis tick={CHART_DEFAULTS.axisTick} />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipContentStyle} />
            <Bar dataKey="orders" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
