

## Plan: Tooltips em todos os cards + Campo de Insights com IA

### 1. Criar componente `MetricTooltip`
Componente reutilizável que renderiza um ícone `Info` (lucide) no canto superior direito do card. Ao passar o mouse (`Tooltip` do Radix), exibe descrição da métrica e como é calculada.

### 2. Adicionar tooltips a TODOS os cards do sistema

| Tela | Cards | Exemplo de tooltip |
|------|-------|--------------------|
| **Dashboard (KPICards)** | Receita Total, Nº Pedidos, Ticket Médio, Clientes Únicos | "Receita Total: soma de total_paid de todos os pedidos faturados no período" |
| **Clientes lista (CustomersListView)** | Total de Clientes, Clientes Ativos, Taxa de Recorrência | "Cliente ativo: fez pelo menos uma compra nos últimos 60 dias" |
| **Cliente detalhe (CustomerDetailView)** | Ticket Médio, Total Gasto, Qtd Pedidos, Média Itens/Pedido, Dias s/ Compra, Média Dias entre Compras, Pagamento Mais Usado | "Ticket Médio: total gasto dividido pelo número de pedidos" |

Manter os 3 cards originais (Total de Clientes, Clientes Ativos, Taxa de Recorrência) na tela de lista de clientes.

### 3. Criar Edge Function `ai-insights`
- Nova edge function `supabase/functions/ai-insights/index.ts`
- Recebe `{ prompt, context }` via POST
- Usa `LOVABLE_API_KEY` + Lovable AI Gateway (`google/gemini-3-flash-preview`)
- Retorna a análise como texto (streaming não necessário para este caso)
- Inclui CORS headers e tratamento de 429/402

### 4. Criar componente `AiInsightsPanel`
- Componente reutilizável usado em ambas as telas de clientes
- Área de texto com prompt pré-preenchido:
  - **Nível externo (lista)**: "Analise os indicadores gerais da base de clientes: [total clientes], [ativos], [taxa recorrência], [ticket médio geral], [receita total]. Identifique padrões, oportunidades e riscos."
  - **Nível cliente**: "Analise os indicadores deste cliente: [nome], ticket médio [X], total gasto [X], [N] pedidos, última compra há [X] dias, média [X] dias entre compras. Identifique padrões de comportamento e sugestões."
- Botão "Gerar Insights" que envia o prompt + dados contextuais para a edge function
- Renderiza resposta com markdown (`react-markdown`)
- Estado de loading com skeleton

### 5. Integrar `AiInsightsPanel` nas telas
- **CustomersListView**: após os 3 stat cards e antes do ranking
- **CustomerDetailView**: após os 7 summary cards e antes dos gráficos

### Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `src/components/dashboard/MetricTooltip.tsx` | Criar — componente de tooltip informativo |
| `src/components/dashboard/AiInsightsPanel.tsx` | Criar — painel de insights com IA |
| `src/components/dashboard/KPICards.tsx` | Modificar — adicionar tooltips nos 4 cards |
| `src/components/dashboard/CustomersListView.tsx` | Modificar — adicionar tooltips nos 3 cards + integrar AiInsightsPanel |
| `src/components/dashboard/CustomerDetailView.tsx` | Modificar — adicionar tooltips nos 7 cards + integrar AiInsightsPanel |
| `supabase/functions/ai-insights/index.ts` | Criar — edge function para chamadas à IA |

### Detalhes técnicos

**MetricTooltip**: Usa `Tooltip`/`TooltipTrigger`/`TooltipContent` do Radix (já existem em `src/components/ui/tooltip.tsx`). Ícone `Info` do Lucide, posicionado `absolute top-2 right-2`.

**AiInsightsPanel**: 
- Props: `defaultPrompt: string`, `contextData: Record<string, any>`
- O prompt enviado ao backend combina o texto do usuário + JSON dos dados contextuais como system message
- Usa `supabase.functions.invoke('ai-insights', { body: { prompt, context } })`
- Resposta renderizada com `react-markdown` (precisará instalar o pacote)

**Edge Function ai-insights**:
```typescript
// Usa LOVABLE_API_KEY para chamar https://ai.gateway.lovable.dev/v1/chat/completions
// System prompt instrui a IA a analisar dados de dashboard de vendas
// Não streaming — resposta completa em JSON { analysis: string }
```

