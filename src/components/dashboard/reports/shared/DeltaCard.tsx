import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaCardProps {
  label: string;
  value: string;
  delta?: { abs: number; pct: number };
  formatDelta?: (n: number) => string;
  invertColors?: boolean; // for "inactive" where higher = worse
}

export const DeltaCard = ({ label, value, delta, formatDelta, invertColors }: DeltaCardProps) => {
  const pct = delta?.pct ?? 0;
  const positive = pct > 0.5;
  const negative = pct < -0.5;
  const isGood = invertColors ? negative : positive;
  const isBad = invertColors ? positive : negative;

  const color = isGood
    ? "text-emerald-600"
    : isBad
    ? "text-red-600"
    : "text-muted-foreground";
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {delta && (
        <div className={cn("mt-2 flex items-center gap-1 text-sm", color)}>
          <Icon className="h-4 w-4" />
          <span className="tabular-nums">
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(1)}%
          </span>
          {formatDelta && (
            <span className="text-xs text-muted-foreground ml-1">
              ({delta.abs >= 0 ? "+" : ""}
              {formatDelta(delta.abs)})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
