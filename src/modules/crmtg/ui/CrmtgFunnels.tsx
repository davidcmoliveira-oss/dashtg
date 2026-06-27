import { useState } from "react";
import { useCrmtgFunnels, simulateFunnel, generateAiMessages, type CrmtgFunnel, type CrmtgTouch, type FunnelCategoria } from "../api/useCrmtg";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Sparkles, Play, Pencil } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_TOUCHES: Record<FunnelCategoria, number[]> = {
  reativacao: [0,3,7,10,14], suplementacao: [20,25,28,30], granel: [7,10,13], generico: [1,3,7,10,14,17,21,25,28],
};

export const CrmtgFunnels = () => {
  const { funnels, touches, saveFunnel, deleteFunnel, saveTouch, deleteTouch } = useCrmtgFunnels();
  const [editing, setEditing] = useState<CrmtgFunnel | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [simOpen, setSimOpen] = useState(false);

  const handleNew = (categoria: FunnelCategoria) => {
    setEditing({ id: "", nome: `Novo funil ${categoria}`, categoria, prioridade: categoria === "reativacao" ? 10 : categoria === "suplementacao" ? 20 : categoria === "granel" ? 30 : 90, ativo: true, produtos_gatilho: [], observacoes: "" });
  };

  const handleSim = async (id?: string) => {
    setSimResult(null); setSimOpen(true);
    const { data, error } = await simulateFunnel(id);
    if (error) toast.error(error.message); else setSimResult(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funis CRM TG</h1>
          <p className="text-muted-foreground text-sm">Cadastro, toques e regras de roteamento</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["reativacao","suplementacao","granel","generico"] as FunnelCategoria[]).map(c => (
            <Button key={c} variant="outline" size="sm" onClick={() => handleNew(c)} className="gap-1"><Plus className="h-4 w-4"/>{c}</Button>
          ))}
          <Button variant="default" size="sm" onClick={() => handleSim()} className="gap-1"><Play className="h-4 w-4"/>Simular tudo</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {(funnels.data || []).map(f => {
          const fTouches = (touches.data || []).filter(t => t.funnel_id === f.id);
          return (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2"><Badge variant="outline">{f.categoria}</Badge><strong>{f.nome}</strong>{!f.ativo && <Badge variant="secondary">inativo</Badge>}</div>
                  <div className="text-xs text-muted-foreground mt-1">Prioridade {f.prioridade} • {fTouches.length} toques • {f.produtos_gatilho.length} SKUs gatilho</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleSim(f.id)}><Play className="h-4 w-4"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="h-4 w-4"/></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir funil?")) deleteFunnel.mutate(f.id); }}><Trash2 className="h-4 w-4"/></Button>
                </div>
              </div>
            </Card>
          );
        })}
        {!funnels.data?.length && <Card className="p-6 text-center text-muted-foreground md:col-span-2">Nenhum funil cadastrado. Crie um pelos botões acima.</Card>}
      </div>

      {editing && (
        <FunnelEditor
          funnel={editing}
          touches={(touches.data || []).filter(t => t.funnel_id === editing.id)}
          onClose={() => setEditing(null)}
          onSaveFunnel={async (f) => {
            const id = await saveFunnel.mutateAsync(f);
            if (!editing.id) {
              // seed touches default
              for (let i = 0; i < DEFAULT_TOUCHES[f.categoria as FunnelCategoria].length; i++) {
                const off = DEFAULT_TOUCHES[f.categoria as FunnelCategoria][i];
                await saveTouch.mutateAsync({ funnel_id: id as string, ordem: i, dia_offset: off, botconversa_flow_id: "", mensagem_v1: "", mensagem_v2: "", mensagem_v3: "" });
              }
            }
            setEditing({ ...editing!, ...f, id: id as string } as CrmtgFunnel);
            toast.success("Funil salvo");
          }}
          onSaveTouch={async (t) => { await saveTouch.mutateAsync(t); toast.success("Toque salvo"); }}
          onDeleteTouch={async (id) => { await deleteTouch.mutateAsync(id); }}
        />
      )}

      <Dialog open={simOpen} onOpenChange={setSimOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Simulação de Funis</DialogTitle></DialogHeader>
          {!simResult ? <div>Simulando…</div> : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">{simResult.total} clientes elegíveis</div>
              <div className="max-h-[60vh] overflow-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0"><tr><th className="text-left p-2">Cliente</th><th className="text-left p-2">Telefone</th><th className="text-left p-2">Funil</th><th className="text-left p-2">Motivo</th></tr></thead>
                  <tbody>
                    {simResult.matches?.map((m: any, i: number) => (
                      <tr key={i} className="border-t"><td className="p-2">{m.customer_id}</td><td className="p-2">{m.telefone || "—"}</td><td className="p-2">{m.funnel_nome} <span className="text-xs text-muted-foreground">[{m.categoria}]</span></td><td className="p-2">{m.motivo}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

interface EditorProps {
  funnel: CrmtgFunnel;
  touches: CrmtgTouch[];
  onClose: () => void;
  onSaveFunnel: (f: Partial<CrmtgFunnel>) => Promise<void>;
  onSaveTouch: (t: Partial<CrmtgTouch> & { funnel_id: string }) => Promise<void>;
  onDeleteTouch: (id: string) => Promise<void>;
}

const FunnelEditor = ({ funnel, touches, onClose, onSaveFunnel, onSaveTouch, onDeleteTouch }: EditorProps) => {
  const [f, setF] = useState<CrmtgFunnel>(funnel);
  const [skusInput, setSkusInput] = useState((funnel.produtos_gatilho || []).join(", "));

  const save = async () => {
    await onSaveFunnel({ ...f, produtos_gatilho: skusInput.split(",").map(s => s.trim()).filter(Boolean) });
  };

  const addTouch = async () => {
    const nextOrd = (touches.length === 0 ? 0 : Math.max(...touches.map(t => t.ordem)) + 1);
    const nextOff = (touches.length === 0 ? 0 : Math.max(...touches.map(t => t.dia_offset)) + 3);
    await onSaveTouch({ funnel_id: f.id, ordem: nextOrd, dia_offset: nextOff, botconversa_flow_id: "", mensagem_v1: "", mensagem_v2: "", mensagem_v3: "" });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar Funil" : "Novo Funil"}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nome</Label><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })}/></div>
          <div><Label>Categoria</Label>
            <select className="w-full border rounded px-3 py-2 text-sm" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as FunnelCategoria })}>
              <option value="reativacao">Reativação</option><option value="suplementacao">Suplementação</option><option value="granel">Granel</option><option value="generico">Genérico</option>
            </select>
          </div>
          <div><Label>Prioridade (menor = maior)</Label><Input type="number" value={f.prioridade} onChange={(e) => setF({ ...f, prioridade: Number(e.target.value) })}/></div>
          <div className="flex items-center gap-2 mt-6"><Switch checked={f.ativo} onCheckedChange={(v) => setF({ ...f, ativo: v })}/><Label>Ativo</Label></div>
        </div>

        <div><Label>SKUs gatilho (separados por vírgula)</Label><Input value={skusInput} onChange={(e) => setSkusInput(e.target.value)} placeholder="SKU1, SKU2, ..."/></div>
        <div><Label>Observações</Label><Textarea value={f.observacoes || ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })}/></div>
        <Button onClick={save} className="w-full">Salvar funil</Button>

        {f.id && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Toques</h3>
              <Button size="sm" variant="outline" onClick={addTouch}><Plus className="h-4 w-4 mr-1"/>Adicionar toque</Button>
            </div>
            {touches.sort((a,b) => a.dia_offset - b.dia_offset).map(t => (
              <TouchEditor key={t.id} touch={t} funnelCategoria={f.categoria} onSave={(p) => onSaveTouch({ ...p, funnel_id: f.id, id: t.id })} onDelete={() => onDeleteTouch(t.id)}/>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const TouchEditor = ({ touch, funnelCategoria, onSave, onDelete }: { touch: CrmtgTouch; funnelCategoria: string; onSave: (t: Partial<CrmtgTouch>) => Promise<void>; onDelete: () => void; }) => {
  const [t, setT] = useState(touch);
  const [busy, setBusy] = useState(false);
  const genAi = async () => {
    setBusy(true);
    const { data, error } = await generateAiMessages({ categoria: funnelCategoria, dia_offset: t.dia_offset });
    setBusy(false);
    if (error) return toast.error(error.message);
    const nt = { ...t, mensagem_v1: data.v1 || t.mensagem_v1, mensagem_v2: data.v2 || t.mensagem_v2, mensagem_v3: data.v3 || t.mensagem_v3 };
    setT(nt); await onSave(nt); toast.success("3 versões geradas");
  };
  return (
    <Card className="p-3 space-y-2 border-l-4 border-l-primary/40">
      <div className="flex gap-2 items-end">
        <div className="w-24"><Label className="text-xs">D+</Label><Input type="number" value={t.dia_offset} onChange={(e) => setT({ ...t, dia_offset: Number(e.target.value) })} onBlur={() => onSave(t)}/></div>
        <div className="flex-1"><Label className="text-xs">Flow ID BotConversa</Label><Input value={t.botconversa_flow_id || ""} onChange={(e) => setT({ ...t, botconversa_flow_id: e.target.value })} onBlur={() => onSave(t)}/></div>
        <Button size="sm" variant="outline" onClick={genAi} disabled={busy}><Sparkles className="h-4 w-4 mr-1"/>{busy ? "Gerando…" : "Gerar IA"}</Button>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4"/></Button>
      </div>
      <div className="grid md:grid-cols-3 gap-2">
        {[1,2,3].map(v => (
          <Textarea key={v} placeholder={`Versão ${v}`} rows={4}
            value={(t as any)[`mensagem_v${v}`] || ""}
            onChange={(e) => setT({ ...t, [`mensagem_v${v}`]: e.target.value } as any)}
            onBlur={() => onSave(t)}
          />
        ))}
      </div>
    </Card>
  );
};
