## Escopo

Sem alterar layout, lógica, filtros ou dados existentes das telas afetadas. Apenas:
1. Botão "Exportar para BotConversa" em 4 relatórios.
2. Modal 2-passos (seleção de clientes → etiqueta) e geração de `.xlsx`.
3. Novas colunas e filtros no Ranking de Clientes.
4. Cache de telefones com enriquecimento a partir do `raw_json` já salvo.

---

## 1. Cache de telefones

Nova tabela `public.tiny_customers_cache`:
- `customer_id text PK` (mesmo id usado em `CustomerData.customer_id`)
- `nome text`
- `fone text`, `celular text`
- `telefone_normalizado text` (DDI 55 + DDD + número, só dígitos)
- `sem_telefone boolean default false` (marca quando o raw_json não tinha número, evita reprocessar)
- `source text` ("raw_json" | "api")
- `created_at`, `updated_at` + trigger updated_at
- RLS: leitura pública (segue padrão das outras tabelas de cache); INSERT/UPDATE apenas via `service_role`
- GRANTs para `anon`, `authenticated`, `service_role`

### Edge function `enrich-customer-phones`
- Recebe `{ customer_ids: string[] }`.
- Para cada id ainda não em cache: lê todos os `tiny_orders_cache.raw_json` desse cliente, extrai `cliente.celular` ou `cliente.fone` (prioridade celular). Normaliza para `55DDDNNNNNNNN` (remove não-dígitos, adiciona 55 quando faltar, evita duplicar).
- Sem telefone no raw_json → marca `sem_telefone = true`.
- Faz upsert em `tiny_customers_cache`.
- Retorna `{ phones: Record<customer_id, string | null> }`.
- CORS + validação Zod.

> Observação: o `raw_json` atual visto em `tiny_orders_cache` só traz `pedido` resumido (sem `cliente`). Os dados completos do cliente vêm em `tiny_order_details_cache.raw_json` (quando `cliente` foi incluído no enriquecimento). A função tentará ambos. Se nem o details cache tiver `cliente`, marcará `sem_telefone = true` — esse cliente aparecerá no modal com aviso "sem telefone" e será ignorado na exportação (como pede a especificação).

---

## 2. Componente de exportação reutilizável

`src/components/dashboard/botconversa/BotConversaExportButton.tsx`
- Props: `reportSlug: string` (ex: `top-reativacao`), `customers: { customer_id: string; customer_name: string }[]`, `disabled?: boolean`.
- Botão `outline` + ícone `Download`/`FileSpreadsheet`, tooltip "Nenhum cliente disponível para exportar" quando lista vazia.
- Abre `BotConversaExportDialog`.

`BotConversaExportDialog.tsx` (shadcn `Dialog`, 2 passos internos):

**Passo 1 — Seleção**
- Ao abrir, chama `enrich-customer-phones` com os ids → loading "Buscando telefones…".
- Lista com checkbox por cliente: nome + telefone formatado, ou badge "sem telefone" (cinza, checkbox desabilitado opcional? Não — permite marcar mas será ignorado, conforme spec).
- "Selecionar todos" / "Desmarcar todos" / contador "X contatos selecionados".
- `max-height` com `overflow-y: auto`.
- Botão "Continuar →" desabilitado quando 0 selecionados.

**Passo 2 — Etiqueta**
- Input opcional, placeholder `Ex: reativacao_maio`, contador, regra "Máx 20 chars por etiqueta; separe por vírgula".
- Validação: cada item separado por vírgula `.trim()` ≤ 20 chars.
- Botões "← Voltar" e "Exportar arquivo" (spinner durante geração).
- Foco inicial no input.

### Geração XLSX
- Adicionar dependência `xlsx` (SheetJS).
- Helper `buildBotConversaXlsx(selected, etiqueta, reportSlug)`:
  - Cabeçalho `Primeiro nome | Sobrenome | Telefone | Etiquetas`.
  - Split nome no primeiro espaço.
  - Filtra clientes sem telefone (ignorados).
  - Download via `XLSX.writeFile` com `botconversa_<slug>_<ddmmyyyy>.xlsx`.
- Toast: `Arquivo exportado com sucesso — X contatos` (+ `· Y ignorados por ausência de telefone` quando aplicável). Erro → toast vermelho.

---

## 3. Integração nos 4 relatórios (apenas adicionar botão no header)

| Arquivo | Onde | reportSlug | Dataset passado |
|---|---|---|---|
| `src/components/dashboard/reports/InactiveCustomersReport.tsx` | header do bloco "Top clientes para reativação" (linha do `<h3>` + botão "Limpar filtro") | `top-reativacao` | `filtered` (respeita filtro de faixa) |
| `src/components/dashboard/reports/RepurchaseReport.tsx` | header "Top 10 clientes recompradores" | `top-recompradores` | **todos** `data.top_repurchasers` mapeados a customers (precisa expor `customer_id` — hoje só tem `name`/`orders`/`spend`; ver ajuste em `useReportsAnalytics`) |
| `src/components/dashboard/reports/CustomerTrendsReport.tsx` | header "Maiores mudanças de comportamento" | `mudancas-comportamento` | `filtered` (com filtro e ordenação atuais) |
| `src/components/dashboard/CustomersListView.tsx` | header da tabela Ranking de Clientes (mesma linha do search/sort) | `ranking-clientes` | `filteredCustomers` (após search + novos filtros) |

Ajustes mínimos em `useReportsAnalytics.ts`:
- `RepurchaseStats.top_repurchasers` → incluir `customer_id` (já existe internamente).

Sem mexer em nenhum outro comportamento, layout, gráfico ou filtro.

---

## 4. Ranking de Clientes — colunas e filtros novos

Em `CustomersListView.tsx` (apenas extensão; nenhum filtro/coluna existente é removido):

### Colunas adicionadas
- **Última compra (dias)** — usa `customer.days_since_last_purchase` (já existe).
- **Média entre compras (dias)** — usa `customer.avg_days_between_purchases` (já existe); exibe `—` se `total_orders < 2` ou valor `0`.

### Filtros adicionados (acima da tabela, em uma faixa nova)
- "Dias desde última compra": dois `Input type="number"` (`De:` / `Até:`).
- "Média de dias entre compras": dois `Input type="number"` (`De:` / `Até:`).
- Combina com `search` existente em `filteredCustomers` (apenas estendendo o `.filter()`).
- Clientes com `avg_days_between_purchases = 0` são incluídos somente quando o range "Média entre compras" estiver vazio.

---

## 5. Detalhes técnicos

- **Telefone normalizado** (helper `normalizePhoneBR`):
  ```
  digits = phone.replace(/\D/g,'')
  if digits.startsWith('55') && digits.length >= 12 → digits
  else if digits.length in [10,11] → '55' + digits
  else → null  // inválido
  ```
- **Split nome**: `const [first, ...rest] = nome.trim().split(/\s+/); sobrenome = rest.join(' ')`.
- **xlsx**: `bun add xlsx`. Browser-only, sem dependência de servidor para a geração.
- **Edge function**: registrada automaticamente; sem alteração em `config.toml`.
- **RLS/GRANT** da nova tabela seguem o padrão dos outros caches (`public read`, escrita via service_role).

---

## 6. Diagrama do fluxo

```text
[Botão] → Dialog
  ├─ Passo 1: fetch enrich-customer-phones(ids) → checkbox list
  │            └─ Continuar (≥1 selecionado)
  └─ Passo 2: input etiqueta (opcional, ≤20 por item)
               └─ Exportar → XLSX.writeFile → toast → fecha
```

---

## 7. Fora do escopo

- Não altera nenhum gráfico, KPI, lógica de cálculo, navegação ou filtros existentes.
- Não toca em `automation-*`, dashboards de vendas, produtos ou tela de detalhes do cliente.
- Não muda layout das telas — apenas adiciona o botão no header dos blocos indicados, as novas colunas/filtros no Ranking, e a nova tabela/edge function.
