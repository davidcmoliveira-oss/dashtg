// Paleta semântica de gráficos - usa tokens HSL do design system
// Sempre referenciada como hsl(var(--chart-N)) ou as variáveis abaixo.

export const CHART_COLORS = {
  primary: "hsl(var(--chart-1))",
  secondary: "hsl(var(--chart-2))",
  warning: "hsl(var(--chart-3))",
  purple: "hsl(var(--chart-4))",
  pink: "hsl(var(--chart-5))",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
} as const;

// Sequência ordenada para series múltiplas
export const CHART_SERIES = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.warning,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.muted,
];

// Estilos padrão para gráficos Recharts
export const CHART_DEFAULTS = {
  axisTick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
  grid: {
    stroke: "hsl(var(--border))",
    strokeDasharray: "3 3",
  },
  tooltipContentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.5rem",
    fontSize: "12px",
  },
};

export const fmtBRL = (n: number) =>
  `R$ ${(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const fmtBRLk = (n: number) => `R$${Math.round((n || 0) / 1000)}k`;

export const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("pt-BR");

export const fmtPct = (n: number, digits = 1) => `${(n || 0).toFixed(digits)}%`;
