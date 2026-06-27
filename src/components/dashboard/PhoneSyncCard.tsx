import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Phone, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CacheStats {
  total: number;
  with_phone: number;
  no_phone_flagged: number;
  pending: number;
}

export const PhoneSyncCard = () => {
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [progress, setProgress] = useState<string>("");

  const loadStats = async () => {
    const [total, withPhone, noPhone, pending] = await Promise.all([
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }),
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }).not("telefone_normalizado", "is", null),
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }).eq("sem_telefone", true),
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true })
        .is("telefone_normalizado", null).eq("sem_telefone", false).not("tiny_contact_id", "is", null),
    ]);
    setStats({
      total: total.count ?? 0,
      with_phone: withPhone.count ?? 0,
      no_phone_flagged: noPhone.count ?? 0,
      pending: pending.count ?? 0,
    });
  };

  useEffect(() => { loadStats(); }, []);

  // Loop until pending=0 or no progress
  const runUntilDone = async (mode: "auto" | "phones") => {
    setLoading(true);
    const t = toast.loading("Sincronizando telefones…");
    try {
      let total = 0;
      for (let i = 0; i < 40; i++) {
        const { data, error } = await supabase.functions.invoke("sync-tiny-contacts", {
          body: { mode: i === 0 ? mode : "phones", batch_size: 200 },
        });
        if (error) throw error;
        total += data?.phones?.filled ?? 0;
        const remaining = data?.remaining ?? 0;
        setProgress(`Lote ${i + 1}: +${data?.phones?.filled ?? 0} telefones · restam ${remaining}`);
        toast.loading(`Telefones obtidos: ${data?.with_phone ?? 0} · restam ${remaining}`, { id: t });
        if (remaining === 0) break;
        if ((data?.phones?.batch_processed ?? 0) === 0) break;
        await loadStats();
      }
      await loadStats();
      toast.success(`Concluído: +${total} telefones nesta execução`, { id: t });
      setProgress("");
    } catch (e: any) {
      toast.error("Falha ao sincronizar", { id: t, description: String(e?.message ?? e) });
    } finally { setLoading(false); }
  };

  const handleBulk = async () => {
    setBulkLoading(true);
    const t = toast.loading("Atualizando lista de contatos do Tiny…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-tiny-contacts", { body: { mode: "bulk" } });
      if (error) throw error;
      toast.success(`Lista atualizada: ${data?.bulk?.synced ?? 0} contatos`, { id: t });
      await loadStats();
    } catch (e: any) {
      toast.error("Falha", { id: t, description: String(e?.message ?? e) });
    } finally { setBulkLoading(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Sincronização de Telefones
        </CardTitle>
        <CardDescription>
          A lista mestre vem de <code>contatos.pesquisa.php</code> (sem telefones).
          Para obter o telefone real chamamos <code>contato.obter.php</code> por contato — feito em lotes.
          Clique em "Preencher telefones" e aguarde até zerar os pendentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-4 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div><div className="text-xs text-muted-foreground">No cache</div><div className="text-lg font-semibold">{stats.total.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-xs text-muted-foreground">Com telefone</div><div className="text-lg font-semibold text-green-600">{stats.with_phone.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-xs text-muted-foreground">Sem telefone (confirmado)</div><div className="text-lg font-semibold text-muted-foreground">{stats.no_phone_flagged.toLocaleString("pt-BR")}</div></div>
            <div><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-lg font-semibold text-orange-600">{stats.pending.toLocaleString("pt-BR")}</div></div>
          </div>
        )}
        {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runUntilDone("auto")} disabled={loading || bulkLoading} className="gap-2">
            <Zap className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Preenchendo…" : "Preencher telefones (loop até zerar)"}
          </Button>
          <Button variant="outline" onClick={handleBulk} disabled={loading || bulkLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${bulkLoading ? "animate-spin" : ""}`} />
            Atualizar lista de contatos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
