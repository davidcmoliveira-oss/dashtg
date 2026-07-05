## O que entendi
- Você fará upload manual da planilha `contatos.xlsx` (mesmo modelo) todos os dias no dashboard.
- O sistema lê o XLSX no navegador, normaliza e atualiza **apenas** clientes com `telefone_normalizado` em branco (ignora quem já tem).
- Remover todo o fluxo antigo de sync de telefones via API Tiny (botões, cards, edge function).
- Exibir o telefone na tela de **Clientes do Dashboard** (lista e detalhe).

## Verificação já feita
Cruzei 3 IDs da planilha com o banco — match 100% via `ID` (planilha) ↔ `tiny_contact_id` (DB). Dos 500 registros da planilha, 481 têm Celular/Fone.

## Plano

### 1. Novo componente: `PhoneUploadCard`
- Substitui `PhoneSyncCard` na aba **API & Webhooks**.
- Input `<input type="file" accept=".xlsx">`.
- Parse client-side com **SheetJS (`xlsx`)** — biblioteca leve, sem edge function.
- Para cada linha: extrai `ID`, `Celular` (fallback `Fone`), normaliza para formato BR (`55DDDNXXXXXXXX` — mesma regra de `normalizePhoneBR`).
- Chama update em lote no Supabase:
  - `UPDATE tiny_customers_cache SET telefone_normalizado=?, fone=?, celular=?, sem_telefone=false, source='xlsx_upload', synced_at=now() WHERE tiny_contact_id=? AND telefone_normalizado IS NULL`
  - Processa em chunks de 100 para não estourar limites.
- Feedback: total lido, atualizados, ignorados (já tinham telefone), sem match, sem telefone na planilha.
- KPIs no card: `total no cache`, `com telefone`, `sem telefone` (mesmas contagens do card atual).

### 2. Remover o fluxo antigo de sync por API
- Deletar arquivo `src/components/dashboard/PhoneSyncCard.tsx`.
- Deletar edge function `supabase/functions/sync-tiny-contacts/` e `supabase/functions/enrich-customer-phones/`.
- Remover entradas correspondentes de `supabase/config.toml`.
- Remover qualquer botão/import residual em `WebhookConfig.tsx` e `Index.tsx`.

### 3. Exibir telefone na tela de Clientes do Dashboard
- `CustomersListView.tsx`: adicionar coluna **Telefone** na tabela; badge cinza "sem telefone" quando null; formatar como `(DDD) 9XXXX-XXXX`.
- `CustomerDetailView.tsx`: exibir telefone no header, ao lado do nome/ID.
- Fonte de dados: join client-side por `nome` normalizado com `tiny_customers_cache.telefone_normalizado` (mesmo padrão de `CrmtgCustomers.tsx`). Fazer 1 query única no carregamento e criar um `Map<nomeNormalizado, telefone>`.

### 4. Não mexer
- CRM TG continua funcionando; consome o mesmo `tiny_customers_cache.telefone_normalizado`, então ganha os telefones do upload automaticamente.
- Nenhuma mudança em RLS ou schema — só grava em coluna já existente.

## Detalhes técnicos
- Dependência nova: `xlsx` (SheetJS) — parse XLSX no browser.
- Normalização de nome/telefone replicada em `src/lib/normalize.ts` (espelhando `_shared/normalizeNome.ts`), para reuso no componente.
- Update em batch usa `.upsert()` com `onConflict: 'tiny_contact_id'` filtrando previamente as linhas onde já existe telefone (busca prévia dos `tiny_contact_id` que estão NULL, faz interseção com a planilha).

## Confirmação final
1. Upload manual de XLSX no dashboard → preenche só telefones em branco.
2. Toda captura de telefone via API Tiny (botões + edge functions) removida.
3. Telefone passa a aparecer na tela de Clientes do dashboard (lista + detalhe).