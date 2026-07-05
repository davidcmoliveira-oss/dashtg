import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Phone, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizePhoneBR } from "@/lib/normalize";

interface CacheStats {
  total: number;
  with_phone: number;
  without_phone: number;
}

interface UploadResult {
  read: number;
  matched: number;
  updated: number;
  skipped_had_phone: number;
  no_match: number;
  no_phone_in_sheet: number;
}

export const PhoneUploadCard = () => {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadStats = async () => {
    const [total, withPhone] = await Promise.all([
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }),
      supabase.from("tiny_customers_cache").select("customer_id", { count: "exact", head: true }).not("telefone_normalizado", "is", null),
    ]);
    const t = total.count ?? 0;
    const w = withPhone.count ?? 0;
    setStats({ total: t, with_phone: w, without_phone: t - w });
  };

  useEffect(() => { loadStats(); }, []);

  const handleFile = async (file: File) => {
    setProcessing(true);
    setResult(null);
    const t = toast.loading("Lendo planilha…");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: null, raw: false });

      // Mapa ID -> telefone (celular preferencial, fone como fallback)
      const idToPhone = new Map<string, { tel: string; celular: string | null; fone: string | null }>();
      let noPhoneInSheet = 0;
      for (const r of rows) {
        const id = r["ID"] != null ? String(r["ID"]).trim() : "";
        if (!id) continue;
        const celular = r["Celular"] ? String(r["Celular"]) : null;
        const fone = r["Fone"] ? String(r["Fone"]) : null;
        const tel = normalizePhoneBR(celular) || normalizePhoneBR(fone);
        if (!tel) { noPhoneInSheet++; continue; }
        idToPhone.set(id, { tel, celular, fone });
      }

      toast.loading(`Planilha lida: ${rows.length} linhas · ${idToPhone.size} com telefone`, { id: t });

      if (idToPhone.size === 0) {
        toast.error("Nenhum telefone válido na planilha", { id: t });
        setResult({ read: rows.length, matched: 0, updated: 0, skipped_had_phone: 0, no_match: 0, no_phone_in_sheet: noPhoneInSheet });
        return;
      }

      // Busca no cache: quais desses IDs existem e ainda não têm telefone
      const ids = Array.from(idToPhone.keys());
      const CHUNK = 200;
      const targets: Array<{ customer_id: string; tiny_contact_id: string }> = [];
      let skippedHadPhone = 0;
      let noMatch = 0;
      const foundIds = new Set<string>();

      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("tiny_customers_cache")
          .select("customer_id, tiny_contact_id, telefone_normalizado")
          .in("tiny_contact_id", slice);
        if (error) throw error;
        for (const row of data || []) {
          foundIds.add(row.tiny_contact_id!);
          if (row.telefone_normalizado) { skippedHadPhone++; continue; }
          targets.push({ customer_id: row.customer_id, tiny_contact_id: row.tiny_contact_id! });
        }
      }
      noMatch = ids.length - foundIds.size;

      toast.loading(`Atualizando ${targets.length} clientes…`, { id: t });

      // Update em série por customer_id (a coluna telefone_normalizado é o alvo real)
      let updated = 0;
      const nowIso = new Date().toISOString();
      const UP_CHUNK = 50;
      for (let i = 0; i < targets.length; i += UP_CHUNK) {
        const slice = targets.slice(i, i + UP_CHUNK);
        await Promise.all(slice.map(async (t) => {
          const src = idToPhone.get(t.tiny_contact_id)!;
          const { error } = await supabase
            .from("tiny_customers_cache")
            .update({
              telefone_normalizado: src.tel,
              fone: src.fone,
              celular: src.celular,
              sem_telefone: false,
              match_score: 100,
              source: "xlsx_upload",
              synced_at: nowIso,
            })
            .eq("customer_id", t.customer_id)
            .is("telefone_normalizado", null); // segurança extra
          if (!error) updated++;
        }));
      }

      const res: UploadResult = {
        read: rows.length,
        matched: foundIds.size,
        updated,
        skipped_had_phone: skippedHadPhone,
        no_match: noMatch,
        no_phone_in_sheet: noPhoneInSheet,
      };
      setResult(res);
      toast.success(`Concluído: ${updated} telefones preenchidos`, {
        id: t,
        description: `${skippedHadPhone} já tinham · ${noMatch} sem match · ${noPhoneInSheet} sem telefone na planilha`,
      });
      await loadStats();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao processar planilha", { id: t, description: String(e?.message ?? e) });
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Telefones dos Clientes
        </CardTitle>
        <CardDescription>
          Faça upload do arquivo <code>contatos.xlsx</code> exportado do Tiny.
          O sistema lê a coluna <b>ID</b> e preenche o telefone apenas dos clientes que ainda estão sem número —
          quem já tem telefone é ignorado.
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
              <div className="text-lg font-semibold text-green-600">{stats.with_phone.toLocaleString("pt-BR")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sem telefone</div>
              <div className="text-lg font-semibold text-orange-600">{stats.without_phone.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={processing}
            className="gap-2"
          >
            <Upload className={`h-4 w-4 ${processing ? "animate-pulse" : ""}`} />
            {processing ? "Processando…" : "Enviar planilha de contatos"}
          </Button>
        </div>

        {result && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 font-medium text-sm mb-1">
              <FileSpreadsheet className="h-4 w-4" /> Resultado do último upload
            </div>
            <div>Linhas lidas: <b>{result.read.toLocaleString("pt-BR")}</b></div>
            <div>Clientes encontrados no cache: <b>{result.matched.toLocaleString("pt-BR")}</b></div>
            <div className="text-green-600">Telefones preenchidos: <b>{result.updated.toLocaleString("pt-BR")}</b></div>
            <div className="text-muted-foreground">Ignorados (já tinham telefone): {result.skipped_had_phone.toLocaleString("pt-BR")}</div>
            <div className="text-muted-foreground">IDs sem match no cache: {result.no_match.toLocaleString("pt-BR")}</div>
            <div className="text-muted-foreground">Linhas sem telefone na planilha: {result.no_phone_in_sheet.toLocaleString("pt-BR")}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
