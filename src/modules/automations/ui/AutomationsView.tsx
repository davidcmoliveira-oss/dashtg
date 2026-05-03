import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Copy, Trash2, Send, RefreshCw, Zap, CheckCircle2, XCircle } from "lucide-react";
import { useAutomations, useDispatches, type AutomationRule, type RuleInput } from "../api/useAutomations";
import { toast } from "sonner";

const emptyRule: RuleInput = {
  name: "",
  description: "",
  is_active: true,
  priority: 0,
  webhook_url: "",
  http_method: "POST",
  headers: {},
  flow_id: null,
  match_mode: "any",
  product_priority: false,
  product_skus: [],
  categories: [],
  exclude_consumidor_final: true,
  require_phone: true,
  require_full_customer: false,
  allow_resend_after_days: null,
};

interface Props {
  productOptions: { sku: string; nome: string; categoria: string }[];
  categoryOptions: string[];
}

export function AutomationsView({ productOptions, categoryOptions }: Props) {
  const { rules, isLoading, upsert, remove, duplicate, toggleActive, testWebhook } = useAutomations();
  const { dispatches, isLoading: dispatchesLoading, isSyncing, reload: reloadDispatches, resend, forceAutomationSync } = useDispatches();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<(Partial<AutomationRule> & { id?: string }) | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  const filtered = useMemo(
    () => rules.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())),
    [rules, search]
  );

  const summary = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todays = dispatches.filter((d) => new Date(d.dispatched_at).getTime() >= todayStart);
    const last7 = dispatches.filter((d) => Date.now() - new Date(d.dispatched_at).getTime() < 7 * 86400_000);
    const success7 = last7.filter((d) => d.success).length;
    const rate = last7.length ? (success7 / last7.length) * 100 : 0;
    return {
      activeRules: rules.filter((r) => r.is_active).length,
      dispatchesToday: todays.length,
      successRate: rate,
      lastDispatch: dispatches[0]?.dispatched_at ?? null,
    };
  }, [rules, dispatches]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="h-6 w-6 text-primary" /> Automações de Funis</h1>
          <p className="text-muted-foreground">Integração com BotConversa e webhooks externos baseada em regras.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={forceAutomationSync} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} /> Forçar atualização
          </Button>
          <Button onClick={() => setEditing({ ...emptyRule })}><Plus className="h-4 w-4" /> Nova automação</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Regras ativas" value={summary.activeRules.toString()} />
        <SummaryCard label="Disparos hoje" value={summary.dispatchesToday.toString()} />
        <SummaryCard label="Taxa de sucesso (7d)" value={`${summary.successRate.toFixed(0)}%`} />
        <SummaryCard label="Último disparo" value={summary.lastDispatch ? new Date(summary.lastDispatch).toLocaleString("pt-BR") : "—"} />
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Regras ({rules.length})</TabsTrigger>
          <TabsTrigger value="logs">Logs / Auditoria ({dispatches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <Input placeholder="Buscar automação..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filtros</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>}
                  {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma automação cadastrada.</TableCell></TableRow>}
                  {filtered.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        {rule.description && <div className="text-xs text-muted-foreground">{rule.description}</div>}
                      </TableCell>
                      <TableCell><Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} /></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.product_skus.length > 0 && <Badge variant="secondary">{rule.product_skus.length} produto(s)</Badge>}
                          {rule.categories.length > 0 && <Badge variant="secondary">{rule.categories.length} categoria(s)</Badge>}
                          <Badge variant="outline">{rule.match_mode.toUpperCase()}</Badge>
                        </div>
                      </TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => testWebhook(rule).then(setTestResult)}><Send className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(rule)}><Edit2 className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate(rule)}><Copy className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => confirm("Excluir esta automação?") && remove(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" onClick={reloadDispatches} disabled={dispatchesLoading}>
              <RefreshCw className={`h-4 w-4 ${dispatchesLoading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Produto / Categoria</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HTTP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatches.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem disparos.</TableCell></TableRow>}
                  {dispatches.map((d) => {
                    const rule = rules.find((r) => r.id === d.rule_id);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{new Date(d.dispatched_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>{rule?.name ?? "—"} {d.is_test && <Badge variant="outline">teste</Badge>}</TableCell>
                        <TableCell className="text-xs">{d.customer_name}<br/><span className="text-muted-foreground">{d.customer_phone}</span></TableCell>
                        <TableCell className="text-xs">{d.matched_product}<br/><span className="text-muted-foreground">{d.matched_category}</span></TableCell>
                        <TableCell>
                          {d.success
                            ? <Badge className="bg-accent text-accent-foreground gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>
                            : <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Falha</Badge>}
                        </TableCell>
                        <TableCell>{d.response_status ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => toast.message("Payload", { description: <pre className="text-xs max-w-md overflow-auto">{JSON.stringify(d.payload, null, 2)}</pre> })}>Ver</Button>
                          {d.tiny_order_id && <Button size="sm" variant="ghost" onClick={() => resend(d)}><RefreshCw className="h-4 w-4" /></Button>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editing && (
        <RuleDialog
          initial={editing}
          productOptions={productOptions}
          categoryOptions={categoryOptions}
          onClose={() => setEditing(null)}
          onSave={async (data) => { const ok = await upsert(data); if (ok) setEditing(null); }}
          onTest={async (data) => {
            // need persisted rule to test; require save first if new
            if (!data.id) { toast.message("Salve a automação antes de testar."); return; }
            const found = rules.find((r) => r.id === data.id);
            if (found) setTestResult(await testWebhook(found));
          }}
          testResult={testResult}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

interface DialogProps {
  initial: Partial<AutomationRule> & { id?: string };
  productOptions: { sku: string; nome: string; categoria: string }[];
  categoryOptions: string[];
  onClose: () => void;
  onSave: (data: Partial<RuleInput> & { id?: string }) => Promise<void>;
  onTest: (data: Partial<AutomationRule> & { id?: string }) => void;
  testResult: any;
}

function RuleDialog({ initial, productOptions, categoryOptions, onClose, onSave, onTest, testResult }: DialogProps) {
  const [data, setData] = useState<any>({ ...emptyRule, ...initial });
  const [headersJson, setHeadersJson] = useState(JSON.stringify(data.headers ?? {}, null, 2));
  const update = (patch: any) => setData((d: any) => ({ ...d, ...patch }));

  const submit = async () => {
    let parsedHeaders = {};
    try { parsedHeaders = headersJson.trim() ? JSON.parse(headersJson) : {}; }
    catch { toast.error("Headers JSON inválido"); return; }
    if (!data.name || !data.webhook_url) { toast.error("Nome e Webhook URL são obrigatórios"); return; }
    await onSave({ ...data, headers: parsedHeaders });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{data.id ? "Editar automação" : "Nova automação"}</DialogTitle></DialogHeader>
        <Tabs defaultValue="general">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="filters">Filtros</TabsTrigger>
            <TabsTrigger value="eligibility">Elegibilidade</TabsTrigger>
            <TabsTrigger value="test">Teste</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 pt-4">
            <Field label="Nome"><Input value={data.name} onChange={(e) => update({ name: e.target.value })} /></Field>
            <Field label="Descrição"><Textarea value={data.description ?? ""} onChange={(e) => update({ description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prioridade"><Input type="number" value={data.priority} onChange={(e) => update({ priority: Number(e.target.value) })} /></Field>
              <Field label="Status">
                <div className="flex items-center gap-2 h-10"><Switch checked={data.is_active} onCheckedChange={(v) => update({ is_active: v })} /><span className="text-sm">{data.is_active ? "Ativa" : "Inativa"}</span></div>
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="webhook" className="space-y-4 pt-4">
            <Field label="Webhook URL"><Input value={data.webhook_url} onChange={(e) => update({ webhook_url: e.target.value })} placeholder="https://backend.botconversa.com.br/api/v1/webhook/..." /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Método HTTP">
                <Select value={data.http_method} onValueChange={(v) => update({ http_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="POST">POST</SelectItem><SelectItem value="PUT">PUT</SelectItem><SelectItem value="PATCH">PATCH</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Flow ID (opcional)"><Input value={data.flow_id ?? ""} onChange={(e) => update({ flow_id: e.target.value || null })} /></Field>
            </div>
            <Field label="Headers (JSON)"><Textarea rows={4} className="font-mono text-xs" value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} placeholder='{"Authorization": "Bearer ..."}' /></Field>
          </TabsContent>

          <TabsContent value="filters" className="space-y-4 pt-4">
            <Field label="Produtos (SKUs separados por vírgula)">
              <Textarea rows={3} value={data.product_skus.join(", ")} onChange={(e) => update({ product_skus: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
              <p className="text-xs text-muted-foreground mt-1">{productOptions.length} produtos disponíveis no catálogo. Use o SKU exato.</p>
            </Field>
            <Field label="Categorias (separadas por vírgula)">
              <Textarea rows={3} value={data.categories.join(", ")} onChange={(e) => update({ categories: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
              <p className="text-xs text-muted-foreground mt-1">Disponíveis: {categoryOptions.slice(0, 10).join(", ")}{categoryOptions.length > 10 ? "..." : ""}</p>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Modo de correspondência">
                <Select value={data.match_mode} onValueChange={(v) => update({ match_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="any">ANY (qualquer item)</SelectItem><SelectItem value="all">ALL (todos itens)</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Priorizar produto sobre categoria">
                <div className="flex items-center gap-2 h-10"><Switch checked={data.product_priority} onCheckedChange={(v) => update({ product_priority: v })} /></div>
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="eligibility" className="space-y-4 pt-4">
            <ToggleRow label="Excluir Consumidor Final" checked={data.exclude_consumidor_final} onChange={(v) => update({ exclude_consumidor_final: v })} />
            <ToggleRow label="Exigir telefone" checked={data.require_phone} onChange={(v) => update({ require_phone: v })} />
            <ToggleRow label="Exigir cadastro completo" checked={data.require_full_customer} onChange={(v) => update({ require_full_customer: v })} />
            <Field label="Permitir reenvio após (dias) — vazio = nunca">
              <Input type="number" value={data.allow_resend_after_days ?? ""} onChange={(e) => update({ allow_resend_after_days: e.target.value ? Number(e.target.value) : null })} />
            </Field>
          </TabsContent>

          <TabsContent value="test" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">Salve a automação primeiro, depois clique em testar para enviar um payload mockado ao webhook.</p>
            <Button onClick={() => onTest(data)} disabled={!data.id} className="gap-2"><Send className="h-4 w-4" /> Testar webhook</Button>
            {testResult && (
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">{JSON.stringify(testResult, null, 2)}</pre>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label>{children}</div>;
}
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center justify-between border rounded p-3"><span className="text-sm">{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
