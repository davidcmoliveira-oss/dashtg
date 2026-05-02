import { Info } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface ReportInfoProps {
  title?: string;
  children: React.ReactNode;
}

export const ReportInfo = ({ title = "Como é calculado?", children }: ReportInfoProps) => {
  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          aria-label={title}
        >
          <Info className="h-4 w-4" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 text-xs leading-relaxed">
        <p className="font-semibold mb-1 text-foreground">{title}</p>
        <div className="text-muted-foreground space-y-1">{children}</div>
      </HoverCardContent>
    </HoverCard>
  );
};

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  info: React.ReactNode;
  actions?: React.ReactNode;
}

export const ReportHeader = ({ title, subtitle, info, actions }: ReportHeaderProps) => (
  <div className="flex flex-wrap items-start justify-between gap-2">
    <div>
      <div className="flex items-center gap-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <ReportInfo>{info}</ReportInfo>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
