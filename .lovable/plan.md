## Objetivo

Substituir a atual `ReportsView.tsx` (genérica, baseada apenas em status de pedidos) por um **painel executivo de decisão**, com leitura rápida no topo e blocos analíticos profundos abaixo, terminando em um relatório dinâmico gerado por IA. Toda a tela usa os dados já disponíveis em `useDashboardData` (orders, customers, products, items, categorias normalizadas, formas de pagamento normalizadas) e respeita os filtros globais.

## Estrutura da nova tela

```text
┌─────────────────────────────────────────────────────────┐
│ Header + Seletor de comparação (Mês vs anterior /        │
│ Semana vs mesma sem. mês passado / Hoje vs ontem / Custom)│
├─────────────────────────────────────────────────────────┤
│ 1. BLOCO COMPARATIVO PRINCIPAL                           │
│    Cards (Δ abs + %): Faturamento, Pedidos, Clientes     │
│    únicos, Ticket médio, Itens/pedido, Recorrentes,      │
│    Novos, Inativos                                       │
│    + Gráfico linha (atual vs anterior) + barras Δ        │
│    + Tabela curta de altas/quedas                        │
├─────────────────────────────────────────────────────────┤
│ 2. CLIENTES INATIVOS        │ 3. PRODUTOS SEM VENDAS    │
│    Faixas 15/30/45/60/90+   │    Faixas 7/15/30/60/90   │
│    Ranking valor potencial  │    Tabela c/ semáforo     │
│    Curva inatividade        │    Barras dias sem venda  │
├─────────────────────────────────────────────────────────┤
│ 4. CLUSTERS DE CLIENTES                                  │
│    Cards por grupo + tabela comparativa + dispersão      │
│    Frequência × Valor + top categorias por cluster       │
├─────────────────────────────────────────────────────────┤
│ 5. TENDÊNCIAS DE CLIENTES                                │
│    Série temporal frequência/ticket/mix                  │
│    Heatmap frequência + ranking de mudanças              │
├─────────────────────────────────────────────────────────┤
│ 6. RELATÓRIO PERSONALIZADO POR IA                        │
│    Prompt + período + nível + comparação                 │
│    Saída: resumo, variações, anomalias, oportunidades,   │
│    riscos, recomendações + tabelas/gráficos de evidência │
├─────────────────────────────────────────────────────────┤
│ RELATÓRIOS COMPLEMENTARES (abas/accordion):              │
│  • Recompra  • Concentração de receita  • Cesta média    │
│    por categoria  • Recorrência por canal  • Sazonalidade│
│  • Produtos âncora & complementares  • Cancelamentos     │
└─────────────────────────────────────────────────────────┘
```

## Arquivos a criar

Sob `src/components/dashboard/reports/`:

- `ReportsExecutivePanel.tsx` — bloco 1 (comparativo principal + seletor de comparação)
- `InactiveCustomersReport.tsx` — bloco 2
- `StaleProductsReport.tsx` — bloco 3
- `CustomerClustersReport.tsx` — bloco 4
- `CustomerTrendsReport.tsx` — bloco 5
- `AiCustomReport.tsx` — bloco 6 (prompt + período + nível + comparação)
- `RepurchaseReport.tsx`
- `RevenueConcentrationReport.tsx` (curva de Pareto)
- `BasketByCategoryReport.tsx`
- `ChannelRecurrenceReport.tsx`
- `SeasonalityReport.tsx`
- `AnchorProductsReport.tsx`
- `CancellationsReport.tsx`
- `shared/ComparisonSelector.tsx` (Mês vs anterior / Semana / Hoje / Custom)
- `shared/DeltaCard.tsx` (card com Δ absoluto e %)

Hook utilitário:

- `src/hooks/useReportsAnalytics.ts` — recebe `orders`, `customers`, `products`, `items` + período e retorna agregados memoizados para todos os blocos (faixas de inatividade, clusters, recompra, Pareto, coocorrência de categorias, séries com período anterior, etc.). Mantém a regra de venda válida (`faturado`, ignora `cancelled` e datas futuras).

Edge function:

- `supabase/functions/reports-ai/index.ts` — recebe `{ prompt, period, level, comparison, snapshot }` e chama Lovable AI Gateway (`google/gemini-3-flash-preview`) com system prompt focado em saída estruturada (resumo executivo, variações, anomalias, oportunidades, riscos, recomendações). Trata 429/402. Sem streaming (resposta única, mais simples para o painel). Adicionar bloco em `supabase/config.toml` se necessário.

## Arquivos a editar

- `src/components/dashboard/ReportsView.tsx` — reescrito como contêiner que recebe `orders/customers/products/filters` do `Index` e compõe os blocos acima. Aproveita `GlobalFilters` já existente no topo.
- `src/pages/Index.tsx` — passa `customers`, `products`, `filters`, `setFilters` para `ReportsView` (hoje só passa `orders` simplificados). A entrada do menu “Relatórios” já existe na sidebar.
- `src/types/dashboard.ts` — adicionar tipos auxiliares: `ComparisonPreset`, `CustomerCluster`, `InactivityBucket`, `StaleProductBucket`, `ReportSnapshot` (payload enviado à IA).

## Regras de negócio aplicadas

- **Vendas válidas**: somente `situacao = 'faturado'`, ignora `cancelled` e `data_pedido` futura (regra já existente em `useDashboardData`).
- **Cliente ativo**: última compra histórica < 30 dias (não restrito ao filtro), conforme memória do projeto.
- **Itens por pedido**: contar linhas distintas (`items.length`), não somar `qty` (granéis).
- **Categoria/forma de pagamento**: usar `resolveProductCategory` e `normalizePaymentMethod` já implementados; ignorar “Não informado” em rankings de pagamento.
- **Comparações**: período anterior calculado pelo mesmo tamanho de janela; YoY = mesma janela ano anterior.
- **Cancelamentos**: relatório dedicado usa pedidos com status `cancelled`, fora das demais métricas.

## Definições dos blocos analíticos

### 1. Comparativo principal

KPIs com Δ absoluto e %. Clientes recorrentes = têm ≥ 2 compras no histórico e compraram no período. Novos = primeira compra dentro do período. Inativos = sem compra há > 60 dias na data fim do período.

### 2. Clientes inativos

Buckets 15/30/45/60/90+ dias. Ranking ordenado por “valor potencial perdido” = ticket médio histórico × frequência média estimada no período de inatividade. Filtros: faixa de inatividade, segmento de valor (quartis), categoria mais comprada, forma de pagamento mais usada.

### 3. Produtos sem vendas

Para cada SKU vendido alguma vez: dias desde última venda; semáforo verde (<7), amarelo (7-30), laranja (30-60), vermelho (>60). Inclui receita histórica e quantidade no período anterior comparável. Filtros por categoria, marca, canal, faixa de valor.

### 4. Clusters

Regras determinísticas (sem ML) baseadas em frequência média e valor:

- ≥1×/semana, semanal, mensal, one-shot, alto valor + baixa frequência, baixo valor + alta frequência, inativos com histórico forte.
Para cada cluster: nº clientes, ticket médio, valor total, frequência média, intervalo médio, top categorias, forma pagamento mais usada, produto mais recorrente. Gráfico de dispersão Frequência × Valor (recharts ScatterChart).

### 5. Tendências

Série temporal (semanal/mensal) de frequência média, ticket médio, mix por categoria. Heatmap dia da semana × hora. Ranking de “mudança de comportamento”: clientes com maior variação Δ frequência ou Δ ticket entre dois subperíodos da janela.

### 6. IA personalizada

Form: Textarea de prompt, presets de período (atual filtro / 7d / 30d / custom), nível (geral, clientes, produtos, pedidos, mix, tendência), comparação (período anterior / YoY / custom). Envia para `reports-ai` snapshot resumido (KPIs + top N por categoria/cliente/produto + buckets de inatividade) — nunca dados crus completos. Renderiza Markdown + tabela de evidências quando o modelo retornar bloco `evidence` em JSON.

### Relatórios complementares

- **Recompra**: taxa, tempo médio entre 1ª e 2ª compra, ticket de recompra, retenção por coorte mensal até M+12.
- **Concentração**: curva de Pareto clientes/produtos, % top10, distribuição por categoria.
- **Cesta por categoria**: ticket médio quando categoria está presente, coocorrência (heatmap), categorias âncora vs complementares.
- **Sazonalidade**: heatmap dia da semana × hora (buckets 3h), padrão por dia do mês.
- **Âncora & complementares**: produtos que mais aparecem em pedidos de alto ticket + pares mais frequentes.

## Notas técnicas

- Reutilizar `recharts` (já no projeto) para line/bar/scatter/heatmap (heatmap via grid Tailwind + escala de cor).
- Toda agregação no client (dados já vêm do cache local) via `useMemo` no novo `useReportsAnalytics`.
- Loading states com `Skeleton`.
- Exportação CSV reaproveita helper já existente em `OrdersTable.tsx` (extrair para `src/lib/csv.ts` se necessário).
- Sem alterações de schema do banco.