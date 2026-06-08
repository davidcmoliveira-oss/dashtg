import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CacheStats {
  total: number;
  with_phone: number;
  no_phone: number;
  last_sync: string | null;
}

export const PhoneSyncCard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<CacheStats | null>(null);

  const loadStats = async () => {
    const { data } = await supabase
      .from("tiny_customers_cache")
      .select("telefone_normalizado, synced_at, source")
      .eq("source", "bulk_sync");
    if (!data) return;
    const last = data.reduce<string | null>((acc, r: any) => {
      if (!r.synced_at) return acc;
      return !acc || r.synced_at > acc ? r.synced_at : acc;
    }, null);
    setStats({
      total: data.length,
      with_phone: data.filter((r: any) => r.telefone_normalizado).length,
      no_phone: data.filter((r: any) => !r.telefone_normalizado).length,
      last_sync: last,
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSync = async () => {
    setLoading(true);
    const t = toast.loading("Sincronizando contatos com Tiny…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-tiny-contacts", {
        body: {},
      });
      if (error) throw error;
      if (data?.status === "ok" || data?.status === "partial") {
        toast.success(
          `Sincronização ${data.status === "ok" ? "concluída" : "parcial"}`,
          {
            id: t,
            description: `${data.synced} contatos · ${data.with_phone} com telefone · ${data.no_phone} sem telefone`,
          },
        );
        await loadStats();
      } else {
        throw new Error(data?.error || "Resposta inesperada");
      }
    } catch (e: any) {
      toast.error("Falha ao sincronizar", { id: t, description: String(e?.message ?? e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Sincronização de Telefones
        </CardTitle>
        <CardDescription>
          Sincroniza a base de contatos do Tiny ERP para enriquecer as exportações do BotConversa.
          Executa automaticamente todo dia às 03:00.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">No cache</div>
              <div className="text-lg font-semibold">{stats.total.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Com telefone</div>
              <div className="text-lg font-semibold text-green-600">
                {stats.with_phone.toLocaleString("pt-BR")}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sem telefone</div>
              <div className="text-lg font-semibold text-muted-foreground">
                {stats.no_phone.toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        )}
        {stats?.last_sync && (
          <p className="text-xs text-muted-foreground">
            Última sincronização: {new Date(stats.last_sync).toLocaleString("pt-BR")}
          </p>
        )}
        <Button onClick={handleSync} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </CardContent>
    </Card>
  );
};
