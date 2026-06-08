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

export function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) =>
    new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
  const ba = bigrams(a),
    bb = bigrams(b);
  const intersection = [...ba].filter((x) => bb.has(x)).length;
  return Math.round((2 * intersection / (ba.size + bb.size)) * 100);
}
