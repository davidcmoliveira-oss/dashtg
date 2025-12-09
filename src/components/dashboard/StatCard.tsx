import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  delay?: number;
}

export const StatCard = ({ title, value, change, changeLabel, icon: Icon, delay = 0 }: StatCardProps) => {
  const isPositive = change >= 0;

  return (
    <div 
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-lg animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
      </div>

      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <div className="flex items-center gap-1.5">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
            <span className={cn(
              "text-sm font-medium",
              isPositive ? "text-success" : "text-destructive"
            )}>
              {isPositive ? "+" : ""}{change}%
            </span>
            <span className="text-sm text-muted-foreground">{changeLabel}</span>
          </div>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};
