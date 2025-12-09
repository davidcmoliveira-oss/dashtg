import { Bell, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdate: Date | null;
}

export const Header = ({ onRefresh, isRefreshing, lastUpdate }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="w-64 bg-secondary/50 border-border pl-10 focus:bg-secondary"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {lastUpdate && (
          <span className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </span>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            3
          </span>
        </Button>

        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium text-primary">AD</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">admin@empresa.com</p>
          </div>
        </div>
      </div>
    </header>
  );
};
