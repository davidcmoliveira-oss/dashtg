import { Button } from "@/components/ui/button";
import { ComparisonPreset } from "@/hooks/useReportsAnalytics";

interface Props {
  value: ComparisonPreset;
  onChange: (v: ComparisonPreset) => void;
}

const options: Array<{ value: ComparisonPreset; label: string }> = [
  { value: "today_vs_yesterday", label: "Hoje vs ontem" },
  { value: "week_vs_prev_month_week", label: "Semana vs mesma sem. mês passado" },
  { value: "month_vs_prev", label: "Mês atual vs anterior" },
  { value: "custom_vs_prev_equal", label: "Custom vs anterior equivalente" },
];

export const ComparisonSelector = ({ value, onChange }: Props) => {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Button
          key={o.value}
          size="sm"
          variant={value === o.value ? "default" : "outline"}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
};
