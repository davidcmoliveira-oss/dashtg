import { useState, useMemo } from "react";
import { ReportsAnalytics, BehaviorClassification } from "@/hooks/useReportsAnalytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { ReportHeader } from "./shared/ReportInfo";
import { CHART_COLORS, CHART_DEFAULTS, fmtBRL, fmtBRLk } from "@/lib/chartColors";
import { cn } from "@/lib/utils";
import { BotConversaExportButton } from "../botconversa/BotConversaExportButton";

interface Props {
  trendSeries: ReportsAnalytics["trendSeries"];
  behaviorChange: ReportsAnalytics["behaviorChange"];
}

const labelMap: Record<BehaviorClassification, { text: string; cls: string; action: string }> = {
  acelerando: {
    text: "Acelerando",
    cls: "bg-emerald-100 text-emerald-700",
    action: "Garantir estoque e oferecer combos",
  },
  desacelerando: {
    text: "Desacelerando",
    cls: "bg-orange-100 text-orange-700",
    action: "Contatar e oferecer recompra",
  },
  subindo_ticket: {
    text: "Subindo ticket",
    cls: "bg-emerald-100 text-emerald-700",
    action: "Cross-sell de itens premium",
  },
  caindo_ticket: {
    text: "Caindo ticket",
    cls: "bg-yellow-100 text-yellow-700",
    action: "Investigar mix e oferta",
  },
  em_risco: {
    text: "Em risco",
    cls: "bg-red-100 text-red-700",
    action: "Reativação imediata",
  },
  estavel: {
    text: "Estável",
    cls: "bg-muted text-muted-foreground",
    action: "Manter cadência",
  },
};

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const max = Math.max(...data, 1);
  const w = 80;
  const h = 24;
  const step = w / Math.max(1, data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

type SortKey = "total" | "freq" | "ticket";

export const CustomerTrendsReport = ({ trendSeries, behaviorChange }: Props) => {
  const [filter, setFilter] = useState<BehaviorClassification | "all">("all");
  const [sort, setSort] = useState<SortKey>("total");

  const filtered = useMemo(() => {
    let rows = [...behaviorChange];
    if (filter !== "all") rows = rows.filter((r) => r.classification === filter);
    rows.sort((a, b) => {
      if (sort === "freq") return Math.abs(b.deltaFreq) - Math.abs(a.deltaFreq);
      if (sort === "ticket") return Math.abs(b.deltaTicket) - Math.abs(a.deltaTicket);
      return Math.abs(b.deltaFreq) * 100 + Math.abs(b.deltaTicket) - (Math.abs(a.deltaFreq) * 100 + Math.abs(a.deltaTicket));
    });
    return rows.slice(0, 20);
  }, [behaviorChange, filter, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: behaviorChange.length };
    behaviorChange.forEach((r) => {
      c[r.classification] = (c[r.classification] || 0) + 1;
    });
    return c;
  }, [behaviorChange]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <ReportHeader
        title="Tendências de clientes"
        subtitle="Evolução do período e mudanças de comportamento por cliente"
        info={
          <>
            <p>
              <strong>Evolução semanal:</strong> agrupa pedidos faturados por semana (segunda como início) dentro do período selecionado.
            </p>
            <p>
              <strong>Mudanças de comportamento:</strong> divide o período em duas metades e compara, por cliente, frequência (nº de pedidos) e ticket médio.
            </p>
            <p>Classificação: ≥2 pedidos a mais = Acelerando; ≥2 a menos = Desacelerando; ±20% no ticket = Subindo/Caindo ticket; sem pedidos na 2ª metade = Em risco.</p>
          </>
        }
      />

      <div>
        <h3 className="font-semibold mb-2 text-sm">Pedidos, receita e ticket por semana</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendSeries}>
            <CartesianGrid {...CHART_DEFAULTS.grid} />
            <XAxis dataKey="bucket" tick={CHART_DEFAULTS.axisTick} />
            <YAxis yAxisId="left" tick={CHART_DEFAULTS.axisTick} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={CHART_DEFAULTS.axisTick}
              tickFormatter={fmtBRLk}
            />
            <Tooltip contentStyle={CHART_DEFAULTS.tooltipContentStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="orders" name="Pedidos" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="revenue" name="Receita" stroke={CHART_COLORS.secondary} strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="avgTicket" name="Ticket médio" stroke={CHART_COLORS.warning} strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-sm mr-2">Maiores mudanças de comportamento</h3>
          <div className="flex flex-wrap gap-1">
            {(["all", "acelerando", "desacelerando", "subindo_ticket", "caindo_ticket", "em_risco"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-2 py-0.5 text-xs rounded-full border transition",
                  filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
                )}
              >
                {f === "all" ? "Todos" : labelMap[f as BehaviorClassification].text}
                <span className="ml-1 opacity-60">({counts[f] || 0})</span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">Ordenar:</span>
            {(["total", "freq", "ticket"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  "px-2 py-0.5 rounded border transition",
                  sort === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
                )}
              >
                {s === "total" ? "Impacto" : s === "freq" ? "Frequência" : "Ticket"}
              </button>
            ))}
          </div>
          <BotConversaExportButton
            reportSlug="mudancas-comportamento"
            customers={filtered.map((b) => ({ customer_id: b.customer_id, customer_name: b.name }))}
          />
        </div>


        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2">Cliente</th>
                <th className="text-left p-2">Status</th>
                <th className="text-right p-2">Freq antes → depois</th>
                <th className="text-right p-2">Ticket antes → depois</th>
                <th className="text-right p-2">Δ Freq</th>
                <th className="text-right p-2">Δ Ticket</th>
                <th className="text-center p-2">8 sem.</th>
                <th className="text-left p-2">Ação sugerida</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const meta = labelMap[b.classification];
                return (
                  <tr key={b.customer_id} className="border-t border-border">
                    <td className="p-2 font-medium">{b.name}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${meta.cls}`}>{meta.text}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums text-xs">
                      {b.freqBefore} → <span className="font-semibold">{b.freqAfter}</span>
                    </td>
                    <td className="p-2 text-right tabular-nums text-xs">
                      {fmtBRL(b.ticketBefore)} → <span className="font-semibold">{fmtBRL(b.ticketAfter)}</span>
                    </td>
                    <td className={cn("p-2 text-right tabular-nums", b.deltaFreq < 0 ? "text-red-600" : b.deltaFreq > 0 ? "text-emerald-600" : "")}>
                      {b.deltaFreq > 0 ? "+" : ""}{b.deltaFreq}
                    </td>
                    <td className={cn("p-2 text-right tabular-nums", b.deltaTicket < 0 ? "text-red-600" : b.deltaTicket > 0 ? "text-emerald-600" : "")}>
                      {b.deltaTicket > 0 ? "+" : ""}{fmtBRL(b.deltaTicket)}
                    </td>
                    <td className="p-2 text-center">
                      <Sparkline
                        data={b.spark}
                        color={b.deltaFreq < 0 ? "hsl(var(--destructive))" : "hsl(var(--chart-2))"}
                      />
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{meta.action}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                    Sem mudanças relevantes nesta categoria
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
