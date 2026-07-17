## Objetivo
Alinhar os totais do dashboard com o ERP Tiny considerando **todos os status** de pedidos por padrão, e adicionar um filtro global de Status para segmentação quando necessário.

## Mudanças

### 1. `src/types/dashboard.ts`
- Ajustar `normalizeStatus` para preservar os status reais da Tiny (faturado, aprovado, enviado, em_aberto, cancelado, etc.) em vez de colapsar tudo em poucos rótulos.
- Ajustar `isValidOrder` para considerar todos os status **exceto** os explicitamente inválidos (cancelado, em digitação/rascunho) — para bater com o total do ERP.
- Adicionar `statusFilter: string[]` no tipo `DashboardFilters`.

### 2. `src/hooks/useDashboardData.ts`
- Aplicar `filters.statusFilter` sobre `filteredOrders` (quando vazio = todos).
- Popular `filterOptions.statuses` com a lista distinta de status presentes em `allOrders`.
- Recalcular KPIs (receita, pedidos, ticket médio, clientes únicos) sobre esse conjunto ampliado.

### 3. `src/components/dashboard/GlobalFilters.tsx`
- Adicionar novo Select "Status do pedido" ao lado dos filtros de Canal/Pagamento/Categoria.
- Incluir no contador `activeFiltersCount` e no `clearAllFilters`.
- Aceitar `filterOptions.statuses: string[]`.

### 4. `src/pages/Index.tsx`
- Inicializar `statusFilter: []` no estado dos filtros.
- Passar `filterOptions.statuses` para o `GlobalFilters`.

### 5. Componentes que usam status para rótulos (Sales/Orders/Analytics)
- Atualizar mapeamentos de badges de status para lidar com o conjunto ampliado (fallback genérico para status desconhecidos), sem alterar lógica de negócio.

## Detalhes técnicos
- Cancelados continuam excluídos das somas de receita por padrão (padrão ERP), mas ficam disponíveis via filtro para auditoria.
- Nenhuma migração de banco necessária — mudança 100% frontend/presentação.
- Após aplicar, o total de julho/2026 deve bater com os ~1948 pedidos e R$ 47.182,69 exibidos pelo Tiny.
