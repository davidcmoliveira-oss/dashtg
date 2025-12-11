import { useState } from "react";
import { Calendar, Filter, Search, X } from "lucide-react";
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
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { DashboardFilters } from "@/types/dashboard";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GlobalFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  filterOptions: {
    salesChannels: string[];
    paymentMethods: string[];
    categories: string[];
    customers: string[];
  };
}

export const GlobalFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
}: GlobalFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const periodOptions = [
    { value: 'today', label: 'Hoje' },
    { value: 'mtd', label: 'Mês até hoje' },
    { value: 'last30', label: 'Últimos 30 dias' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const granularityOptions = [
    { value: 'daily', label: 'Diário' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'monthly', label: 'Mensal' },
  ];

  const handlePeriodChange = (period: string) => {
    const today = new Date();
    let dateStart = new Date();
    let dateEnd = new Date();

    switch (period) {
      case 'today':
        dateStart = today;
        dateEnd = today;
        break;
      case 'mtd':
        dateStart = new Date(today.getFullYear(), today.getMonth(), 1);
        dateEnd = today;
        break;
      case 'last30':
        dateStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateEnd = today;
        break;
      case 'custom':
        // Keep current dates for custom
        dateStart = filters.dateStart;
        dateEnd = filters.dateEnd;
        break;
    }

    onFiltersChange({
      ...filters,
      period: period as DashboardFilters['period'],
      dateStart,
      dateEnd,
    });
  };

  const activeFiltersCount = [
    filters.salesChannel.length > 0,
    filters.paymentMethod.length > 0,
    filters.productCategory.length > 0,
    filters.customerId !== null,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      salesChannel: [],
      paymentMethod: [],
      productCategory: [],
      customerId: null,
    });
  };

  const filteredCustomers = filterOptions.customers.filter(c =>
    c.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-6 space-y-4">
      {/* Main Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period Selector */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                {format(filters.dateStart, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateStart}
                onSelect={(date) => date && onFiltersChange({ ...filters, dateStart: date, period: 'custom' })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">até</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                {format(filters.dateEnd, "dd/MM/yyyy", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.dateEnd}
                onSelect={(date) => date && onFiltersChange({ ...filters, dateEnd: date, period: 'custom' })}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Granularity */}
        <Select 
          value={filters.granularity} 
          onValueChange={(v) => onFiltersChange({ ...filters, granularity: v as DashboardFilters['granularity'] })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Granularidade" />
          </SelectTrigger>
          <SelectContent>
            {granularityOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
