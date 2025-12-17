import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Settings, 
  Webhook, 
  Users,
  Package
} from "lucide-react";

interface SidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "customers", label: "Clientes", icon: Users },
  { id: "products", label: "Produtos", icon: Package },
];

const bottomItems = [
  { id: "webhooks", label: "API & Webhooks", icon: Webhook },
  { id: "settings", label: "Configurações", icon: Settings },
];

export const Sidebar = ({ activeItem, onItemClick }: SidebarProps) => {
  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-foreground">Tiny Dashboard</span>
        </div>

        {/* Navigation */}
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
              <item.icon className={cn(
                "h-5 w-5 transition-colors",
                activeItem === item.id ? "text-primary" : ""
              )} />
              {item.label}
              {activeItem === item.id && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="border-t border-sidebar-border px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sistema
          </p>
          {bottomItems.map((item) => (
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
              <item.icon className={cn(
                "h-5 w-5 transition-colors",
                activeItem === item.id ? "text-primary" : ""
              )} />
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
