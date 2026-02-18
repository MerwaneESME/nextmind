import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  const day = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(d)
    .replace(".", ""); // retire les points éventuels sur les mois abrégés

  const time = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);

  return `${day}, ${time}`;
}

/**
 * Normalise une saisie date (jj/mm/aaaa, jj-mm-aaaa, aaaa-mm-jj, etc.) en YYYY-MM-DD.
 * Utilisé pour que les champs date acceptent plusieurs formats et évitent "format invalide".
 * Retourne "" si la valeur est vide ou invalide.
 */
export function normalizeDateValue(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  // Déjà au format YYYY-MM-DD (accepté par input type="date")
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    const month = m.padStart(2, "0");
    const day = d.padStart(2, "0");
    const d2 = new Date(`${y}-${month}-${day}T12:00:00`);
    if (!Number.isNaN(d2.getTime())) return `${y}-${month}-${day}`;
  }

  // Format français jj/mm/aaaa ou jj-mm-aaaa (avec 1 ou 2 chiffres pour j/m)
  const frMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (frMatch) {
    const [, d, m, y] = frMatch;
    const day = d.padStart(2, "0");
    const month = m.padStart(2, "0");
    const d2 = new Date(`${y}-${month}-${day}T12:00:00`);
    if (!Number.isNaN(d2.getTime())) return `${y}-${month}-${day}`;
  }

  // Fallback: essayer new Date() (pour saisies partielles ou autres formats)
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

/**
 * Vérifie que la date de fin est supérieure ou égale à la date de début (format YYYY-MM-DD).
 * Retourne true si au moins une des deux est vide (pas de contrainte) ou si les deux sont renseignées et end >= start.
 */
export function isValidDateRange(start: string, end: string): boolean {
  const s = (start ?? "").trim();
  const e = (end ?? "").trim();
  if (!s || !e) return true;
  return e >= s;
}

