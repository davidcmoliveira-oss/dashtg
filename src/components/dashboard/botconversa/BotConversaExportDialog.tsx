import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildBotConversaXlsx } from "./buildBotConversaXlsx";

export interface BotConversaCustomer {
  customer_id: string;
  customer_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customers: BotConversaCustomer[];
  reportSlug: string;
}

type Step = "select" | "label";

export const BotConversaExportDialog = ({ open, onOpenChange, customers, reportSlug }: Props) => {
  const [step, setStep] = useState<Step>("select");
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [etiqueta, setEtiqueta] = useState("");
  const [exporting, setExporting] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelected(new Set());
    setEtiqueta("");
    setPhones({});
    if (customers.length === 0) return;
    setLoadingPhones(true);
    supabase.functions
      .invoke("enrich-customer-phones", {
        body: { customer_ids: customers.map((c) => c.customer_id) },
      })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao buscar telefones");
          setPhones({});
        } else {
          setPhones((data as any)?.phones || {});
        }
      })
      .finally(() => setLoadingPhones(false));
  }, [open, customers]);

  useEffect(() => {
    if (step === "label") setTimeout(() => labelInputRef.current?.focus(), 50);
  }, [step]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(customers.map((c) => c.customer_id)));
  const clearAll = () => setSelected(new Set());

  const labelErrors = useMemo(() => {
    if (!etiqueta.trim()) return null;
    const parts = etiqueta.split(",").map((p) => p.trim());
    const tooLong = parts.find((p) => p.length > 20);
    return tooLong ? `Etiqueta "${tooLong}" tem mais de 20 caracteres` : null;
  }, [etiqueta]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const list = customers
        .filter((c) => selected.has(c.customer_id))
        .map((c) => ({
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          phone: phones[c.customer_id] ?? null,
        }));
      const { exported, ignored } = buildBotConversaXlsx(list, etiqueta.trim(), reportSlug);
      let msg = `Arquivo exportado com sucesso — ${exported} contatos`;
      if (ignored > 0) msg += ` · ${ignored} ignorados por ausência de telefone`;
      toast.success(msg);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Selecionar contatos para exportação</DialogTitle>
            </DialogHeader>

            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={selectAll} disabled={loadingPhones}>
                  Selecionar todos
                </Button>
                <Button size="sm" variant="ghost" onClick={clearAll} disabled={loadingPhones}>
                  Desmarcar todos
                </Button>
              </div>
              <span className="text-muted-foreground">{selected.size} contatos selecionados</span>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-border divide-y">
              {loadingPhones ? (
                <div className="flex items-center justify-center p-6 text-sm text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando telefones…
                </div>
              ) : customers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Sem clientes</div>
              ) : (
                customers.map((c) => {
                  const phone = phones[c.customer_id];
                  const hasPhone = !!phone;
                  return (
                    <label
                      key={c.customer_id}
                      className="flex items-center gap-3 p-2 hover:bg-muted/40 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(c.customer_id)}
                        onCheckedChange={() => toggle(c.customer_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {hasPhone ? phone : <span className="text-orange-600">sem telefone</span>}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep("label")} disabled={selected.size === 0}>
                Continuar →
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Definir etiqueta BotConversa</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="etiqueta">Nome da etiqueta</Label>
              <Input
                id="etiqueta"
                ref={labelInputRef}
                placeholder="Ex: reativacao_maio"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Máximo 20 caracteres. Para múltiplas etiquetas, separe por vírgula.</span>
                <span>{etiqueta.length} chars</span>
              </div>
              {labelErrors && <p className="text-xs text-destructive">{labelErrors}</p>}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>
                ← Voltar
              </Button>
              <Button onClick={handleExport} disabled={exporting || !!labelErrors}>
                {exporting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Exportar arquivo
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
