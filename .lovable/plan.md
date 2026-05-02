## Reestruturação da página de Relatórios

Reorganizar o painel em **abas temáticas** (em vez de uma página longa), remover relatórios não desejados, melhorar gráficos/cores, enriquecer Clusters e Mudanças de Comportamento, adicionar tooltip de "Como é calculado" em todos os blocos e introduzir o relatório principal de **Cross-sell / Recomendação**.

### 1. Nova estrutura em abas

Header fixo com título + `ComparisonSelector` + chip de período. Abaixo, um único `Tabs` com 6 abas:

```text
┌─ Relatórios ──────────────────────────────────────────┐
│  [ Visão Executiva ] [ Cross-sell ★ ] [ Clientes ]    │
│  [ Produtos ] [ Comportamento ] [ IA ]                │
└───────────────────────────────────────────────────────┘
```

- **Visão Executiva**: `ReportsExecutivePanel` + `RevenueConcentrationReport` (Pareto resumido).
- **Cross-sell ★** (NOVA — relatório principal, abre por padrão): ver seção 4.
- **Clientes**: `InactiveCustomersReport` + `CustomerClustersReport` (versão melhorada) + `RepurchaseReport`.
- **Produtos**: `StaleProductsReport` + `AnchorProductsReport` + `BasketByCategoryReport`.
- **Comportamento**: `CustomerTrendsReport` (versão melhorada) + `SeasonalityReport`.
- **IA**: `AiCustomReport`.

### 2. Remoções

- Excluir `ChannelRecurrenceReport` da UI e do `useReportsAnalytics` (`channelRecurrence`).
- Excluir `CancellationsReport` da UI e do `useReportsAnalytics` (`cancellations`).
- Remover imports e snapshot AI correspondentes.

### 3. Melhorias visuais e de UX (todos os relatórios)

- **Paleta unificada por tokens semânticos** (HSL via `hsl(var(--primary))`, `--secondary`, `--accent`, `--destructive`, `--muted`). Definir paleta de séries em `src/lib/chartColors.ts` com 6 cores acessíveis derivadas dos tokens (sem cores fixas).
- Padronizar Recharts: `CartesianGrid` discreto, eixos com `fontSize: 11`, tooltip customizado branco com borda `--border`, legend abaixo.
- Espaçamento consistente: cada bloco em `Card` (shadcn) com `CardHeader` + ícone + **InfoTooltip** "Como é calculado?".
- Criar `src/components/dashboard/reports/shared/ReportInfo.tsx`: ícone `Info` (lucide) com `HoverCard` exibindo texto explicativo passado por prop.
- Adoção em **todos** os relatórios — texto curto descrevendo fonte de dados, filtros aplicados (faturado, período) e fórmula.

### 4. Novo relatório: Cross-sell e Recomendação (principal)

Componente `src/components/dashboard/reports/CrossSellReport.tsx` com dois modos via `Tabs` interno:

**Modo A — Por produto**
- Combobox (shadcn `Command`) para selecionar produto da base.
- Calcular co-ocorrência: para cada pedido faturado contendo o produto X, contar SKUs co-presentes; agrupar por SKU e ordenar.
- Exibir top 5 produtos comprados em conjunto: nome, categoria, nº de pedidos juntos, % de pedidos com X que também levam Y, receita total combinada.
- Gráfico de barras horizontal (top 5) + tabela detalhada.

**Modo B — Por cliente**
- Combobox de cliente.
- Pegar SKUs já comprados pelo cliente; para cada um, montar lista de co-ocorrência global; somar score (frequência ponderada × receita); excluir SKUs já comprados; retornar top 5.
- Para cada recomendação mostrar: produto, "porque está sendo recomendado" (ex.: "vendido junto com Whey 900g em 47 pedidos"), preço médio, categoria.
- Botão "Copiar lista" / "Exportar CSV".

**Lógica adicionada em `useReportsAnalytics.ts`**:
- Construir `coOccurrenceMap: Map<sku, Map<sku, { count, revenue }>>` uma única vez (memoizado) iterando `validOrders` e seus `_items`.
- Construir `productIndex: Map<sku, { name, category, avg_price }>` a partir de `products`.
- Expor helpers `getRelatedBySku(sku, n=5)` e `getRecommendationsForCustomer(customerId, n=5)`.

### 5. Melhorias em Clusters de Clientes

- Substituir grid atual por **cards expansíveis** (`Collapsible` shadcn). Header mostra nome + count + ticket médio + barra de % do total.
- Ao expandir: 2 colunas — esquerda lista de clientes do cluster (paginada, com link para detalhe); direita lista dos top 10 produtos do cluster (com qty e receita).
- Manter o scatter, porém com cores por cluster usando paleta semântica e legenda clicável.
- Adicionar `ReportInfo` explicando regras de cada cluster.

### 6. Melhorias em "Maiores mudanças de comportamento"

- Em `CustomerTrendsReport` enriquecer cada linha com: nome, ticket antes/depois, frequência antes/depois, **classificação** ("Acelerando", "Desacelerando", "Subindo ticket", "Em risco"), última compra, ação sugerida.
- Adicionar mini sparkline de receita por cliente (últimas 8 semanas).
- Filtros locais: tipo de mudança (chips) e ordenação (delta freq, delta ticket, valor absoluto).
- Top 20 em vez de 8.

### 7. Tooltip "Como é calculado" — textos por relatório

- **Executivo**: "KPIs sobre pedidos faturados no período X comparados a Y. Receita = soma de net_revenue. Ticket = receita / pedidos."
- **Pareto**: "% acumulado de receita atribuída ao top N de clientes/produtos faturados."
- **Inativos**: "Clientes com última compra ≥ 15 dias. Potencial perdido = ticket médio × frequência anual × (dias inativo / 365)."
- **Clusters**: "Segmentação por regras: frequência (dias entre compras) × valor (acima/abaixo da mediana)."
- **Recompra**: "% de clientes com 2+ pedidos. Tempo até 2ª compra é a média entre 1º e 2º pedido."
- **Estagnados**: "Produtos sem venda nos últimos N dias. Crítico ≥ 60, Alerta ≥ 30, Atenção ≥ 7."
- **Cesta por categoria / Âncoras**: "Co-ocorrência de itens em pedidos faturados."
- **Sazonalidade**: "Distribuição de pedidos por dia da semana × janela de 3h."
- **Tendências**: "Compara primeira metade vs segunda metade do período por cliente."
- **Cross-sell**: "Produtos comprados no mesmo pedido que o item selecionado, agregados em todo o histórico faturado."

### Detalhes técnicos

- **Arquivos novos**:
  - `src/components/dashboard/reports/CrossSellReport.tsx`
  - `src/components/dashboard/reports/shared/ReportInfo.tsx`
  - `src/lib/chartColors.ts`
- **Arquivos editados**:
  - `src/components/dashboard/ReportsView.tsx` — nova estrutura em abas, remoção de Cancelamentos/Canal.
  - `src/hooks/useReportsAnalytics.ts` — remover `cancellations`/`channelRecurrence`; adicionar `coOccurrenceMap`, `productIndex`, helpers `getRelatedBySku`/`getRecommendationsForCustomer`; enriquecer `behaviorChange` (ticket antes/depois, freq antes/depois, classificação, sparkline).
  - `src/components/dashboard/reports/CustomerClustersReport.tsx` — cards colapsáveis com listas de clientes e produtos.
  - `src/components/dashboard/reports/CustomerTrendsReport.tsx` — tabela enriquecida + filtros + sparkline.
  - Todos os componentes `reports/*.tsx` — adicionar `<ReportInfo />` no header e aplicar paleta de `chartColors.ts`.
- **Arquivos a deletar**: `CancellationsReport.tsx`, `ChannelRecurrenceReport.tsx`.
- **Performance**: o cross-sell map é O(itens²) por pedido; aceitável até ~50k pedidos. Memoizar por hash de orders length + último `fetched_at`.
- **Sem mudanças no banco** — tudo client-side a partir de `_items` já presentes em `tiny_order_details_cache`.