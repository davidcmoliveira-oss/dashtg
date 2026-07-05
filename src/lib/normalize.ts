// Nome + telefone normalizers (espelham supabase/functions/_shared/normalizeNome.ts)

export function normalizeNome(nome: string | null | undefined): string {
  if (!nome) return "";
  return String(nome)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return null;
}

// Format "5511994474375" -> "(11) 99447-4375"
export function formatPhoneBR(tel: string | null | undefined): string {
  if (!tel) return "";
  const d = String(tel).replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return tel;
}
