## Causa raiz encontrada

Rodei duas queries no banco:

- **Nenhum registro tem `source = 'xlsx_upload'`** — os dois uploads não gravaram nada.
- Verificando as permissões da tabela `tiny_customers_cache`:
  - Existe **apenas 1 política**: `Allow public read access` (só leitura).
  - **Não existe política de UPDATE** para o usuário anônimo do navegador.
  - **Não existe GRANT** de UPDATE para os papéis `anon`/`authenticated`.

Resultado: o navegador dispara o `UPDATE`, o banco recusa silenciosamente (afeta 0 linhas / erro de permissão), e o card mostra "concluído" porque o código atual conta como sucesso quando não vem erro claro. Por isso o contador ficou parado.

Somando: o card também **engole erros de permissão** — o `if (!error) updated++` mascara o problema real.

## Plano de correção

### 1. Migração de permissões na tabela `tiny_customers_cache`
Uma migração única fazendo:
- `GRANT SELECT, UPDATE ON public.tiny_customers_cache TO anon, authenticated;`
- `GRANT ALL ON public.tiny_customers_cache TO service_role;`
- Nova política de UPDATE liberando o preenchimento pelo dashboard (mesma postura pública já usada na SELECT):
  ```sql
  CREATE POLICY "Allow public update customers cache"
  ON public.tiny_customers_cache
  FOR UPDATE USING (true) WITH CHECK (true);
  ```
- (Segurança: como o app é privado e a tabela já é pública para leitura, manter o padrão. Se você preferir travar depois, dá para restringir por token; hoje não faz sentido travar sem quebrar o resto.)

### 2. Ajustar o `PhoneUploadCard`
- **Deixar de engolir erro**: se qualquer chunk retornar erro, exibir toast vermelho com a mensagem exata do banco.
- Contar somente linhas realmente atualizadas usando `.select('customer_id')` no retorno do `update`, que devolve o array das linhas afetadas — assim o número no card reflete a realidade.
- Trocar terminologia visível de "cache" para **"cadastro"**:
  - "No cache" → "Clientes cadastrados"
  - "Clientes encontrados no cache" → "Clientes encontrados no cadastro"
  - Descrição do card reescrita: deixa claro que grava direto no cadastro de cada cliente no banco.

### 3. Devolutiva pós-fix
Depois da migração aprovada e do próximo upload que você fizer, eu:
- Rodo `SELECT count(*) FILTER (WHERE source='xlsx_upload')` e reporto o total.
- Devolvo 3 nomes aleatórios recém-preenchidos, com telefone formatado, para você abrir na tela de Clientes do dashboard e conferir se aparece igual à planilha.

## O que **não** muda
- Estrutura das tabelas, chaves, relações — nada.
- CRM TG, BotConversa e demais telas — continuam lendo do mesmo lugar e ganham os telefones automaticamente.
- Fluxo de upload manual pela aba **API & Webhooks** — segue igual, só passa a funcionar.
