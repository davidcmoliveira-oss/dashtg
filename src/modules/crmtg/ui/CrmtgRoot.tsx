import { useState } from "react";
import { CrmtgDashboard } from "./CrmtgDashboard";
import { CrmtgQueue } from "./CrmtgQueue";
import { CrmtgFunnels } from "./CrmtgFunnels";
import { CrmtgHistory } from "./CrmtgHistory";
import { CrmtgSettings } from "./CrmtgSettings";

const TABS = [
  { id: "dashboard", label: "Painel Inicial" },
  { id: "queue", label: "Fila do Dia" },
  { id: "funnels", label: "Funis" },
  { id: "history", label: "Histórico" },
  { id: "settings", label: "Configurações" },
];

interface Props { initialTab?: string }

export const CrmtgRoot = ({ initialTab = "dashboard" }: Props) => {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <CrmtgDashboard/>}
      {tab === "queue" && <CrmtgQueue/>}
      {tab === "funnels" && <CrmtgFunnels/>}
      {tab === "history" && <CrmtgHistory/>}
      {tab === "settings" && <CrmtgSettings/>}
    </div>
  );
};
