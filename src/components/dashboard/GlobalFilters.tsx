import { useState } from "react";
import { Calendar as CalendarIcon, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { DashboardFilters, statusLabel } from "@/types/dashboard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface GlobalFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  filterOptions: {
    salesChannels: string[];
    paymentMethods: string[];
    categories: string[];
    customers: string[];
    statuses: string[];
  };
}

export const GlobalFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
}: GlobalFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const activeFiltersCount = [
    filters.salesChannel.length > 0,
    filters.paymentMethod.length > 0,
    filters.productCategory.length > 0,
    filters.status.length > 0,
    filters.customerId !== null,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      salesChannel: [],
      paymentMethod: [],
      productCategory: [],
      status: [],
      customerId: null,
    });
  };

  const filteredCustomers = filterOptions.customers.filter(c =>
    c.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const dateRange: DateRange = {
    from: filters.dateStart,
    to: filters.dateEnd,
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    if (range?.from) {
      const start = new Date(range.from);
      start.setHours(0, 0, 0, 0);
      const end = range.to ? new Date(range.to) : new Date(range.from);
      end.setHours(23, 59, 59, 999);
      onFiltersChange({
        ...filters,
        dateStart: start,
        dateEnd: end,
        period: 'custom',
      });
    }
  };

  const dateLabel = filters.dateStart && filters.dateEnd
    ? filters.dateStart.toDateString() === filters.dateEnd.toDateString()
      ? format(filters.dateStart, "dd/MM/yyyy", { locale: ptBR })
      : `${format(filters.dateStart, "dd/MM", { locale: ptBR })} - ${format(filters.dateEnd, "dd/MM/yyyy", { locale: ptBR })}`
    : "Selecionar data";

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[180px] justify-start gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              numberOfMonths={2}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Expand Filters Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-4 border-t border-border">
          {/* Sales Channel */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Canal de Venda</Label>
            <Select
              value={filters.salesChannel[0] || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                salesChannel: v === "all" ? [] : [v] 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterOptions.salesChannels.map(channel => (
                  <SelectItem key={channel} value={channel}>
                    {channel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Forma de Pagamento</Label>
            <Select
              value={filters.paymentMethod[0] || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                paymentMethod: v === "all" ? [] : [v] 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterOptions.paymentMethods.map(method => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Categoria</Label>
            <Select
              value={filters.productCategory[0] || "all"}
              onValueChange={(v) => onFiltersChange({ 
                ...filters, 
                productCategory: v === "all" ? [] : [v] 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {filterOptions.categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Search */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Cliente</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Search className="h-4 w-4" />
                  {filters.customerId || "Buscar cliente..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-2" align="start">
                <Input
                  placeholder="Buscar..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="max-h-[200px] overflow-auto space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      onFiltersChange({ ...filters, customerId: null });
                      setCustomerSearch("");
                    }}
                  >
                    Todos os clientes
                  </Button>
                  {filteredCustomers.slice(0, 20).map(customer => (
                    <Button
                      key={customer}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start truncate"
                      onClick={() => {
                        onFiltersChange({ ...filters, customerId: customer });
                        setCustomerSearch("");
                      }}
                    >
                      {customer}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
};
