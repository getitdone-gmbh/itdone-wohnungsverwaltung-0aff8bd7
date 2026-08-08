export function money(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));
}

export function dateDe(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('de-DE');
}

export function currentYear() {
  return new Date().getFullYear();
}

export const KATEGORIEN_KOSTEN = [
  'Grundsteuer',
  'Hausverwaltung / Nebenkosten',
  'Versicherung',
  'Reparatur / Instandhaltung',
  'Zinsen (Finanzierung)',
  'Verwaltungskosten',
  'Sonstige Kosten',
];

export const KATEGORIEN_ERTRAG = [
  'Kaltmiete',
  'Nebenkostenvorauszahlung',
  'Sonstiger Ertrag',
];

export const DOKUMENT_KATEGORIEN = [
  { value: 'grundsteuerbescheid', label: 'Grundsteuerbescheid' },
  { value: 'nebenkostenabrechnung_hausverwaltung', label: 'Nebenkostenabrechnung der Hausverwaltung' },
  { value: 'mietvertrag', label: 'Mietvertrag' },
  { value: 'vertragsanpassung', label: 'Vertragsanpassung' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

export function dokKategorieLabel(value) {
  const found = DOKUMENT_KATEGORIEN.find((k) => k.value === value);
  return found ? found.label : value;
}
