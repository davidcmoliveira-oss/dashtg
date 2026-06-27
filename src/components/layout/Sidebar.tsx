import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Settings, 
  Webhook, 
  Users,
  Package,
  FileBarChart2,
  Zap,
  MessageCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "products", label: "Produtos", icon: Package },
  { id: "reports", label: "Relatórios", icon: FileBarChart2 },
  { id: "automations", label: "Automações", icon: Zap },
];

const crmtgChildren = [
  { id: "crmtg:dashboard", label: "Painel Inicial" },
  { id: "crmtg:queue", label: "Fila do Dia" },
  { id: "crmtg:funnels", label: "Funis" },
  { id: "crmtg:history", label: "Histórico" },
  { id: "crmtg:settings", label: "Configurações" },
];

const bottomItems = [
  { id: "webhooks", label: "API & Webhooks", icon: Webhook },
  { id: "settings", label: "Configurações", icon: Settings },
];

export const Sidebar = ({ activeItem, onItemClick }: SidebarProps) => {
  const isCrmtg = activeItem.startsWith("crmtg");
  const [crmtgOpen, setCrmtgOpen] = useState(isCrmtg);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border overflow-y-auto">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">Tiny Dashboard</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Menu Principal
          </p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                activeItem === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", activeItem === item.id ? "text-primary" : "")}/>
              {item.label}
            </button>
          ))}

          {/* CRM TG group */}
          <button
            onClick={() => setCrmtgOpen(!crmtgOpen)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isCrmtg ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <MessageCircle className={cn("h-5 w-5", isCrmtg ? "text-primary" : "")}/>
            CRM TG
            {crmtgOpen ? <ChevronDown className="h-4 w-4 ml-auto"/> : <ChevronRight className="h-4 w-4 ml-auto"/>}
          </button>
          {crmtgOpen && (
            <div className="ml-8 mt-1 space-y-1 border-l border-sidebar-border pl-3">
              {crmtgChildren.map(c => (
                <button
                  key={c.id}
                  onClick={() => onItemClick(c.id)}
                  className={cn(
                    "block w-full text-left rounded px-2 py-1.5 text-sm transition",
                    activeItem === c.id ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                >{c.label}</button>
              ))}
            </div>
          )}
        </nav>

        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Sistema</p>
          {bottomItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                activeItem === item.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className={cn("h-5 w-5", activeItem === item.id ? "text-primary" : "")}/>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
