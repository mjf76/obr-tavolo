/** Prefisso unico per metadata, canali broadcast e id OBR (evita collisioni con altre estensioni). */
export const NS = "it.mjf.obr-tavolo";

export const KEYS = {
  /** Metadata sul token: a quale giocatore è assegnato. */
  pcLink: `${NS}/pc`,
} as const;

export const IDS = {
  contextAssign: `${NS}/assign`,
  modalController: `${NS}/controller`,
  modalPlayer: `${NS}/player`,
} as const;

/** Nome convenzionale del client collegato al TV. */
export const TABLE_PLAYER_NAME = "TAVOLO";

/** URL di una pagina dell'estensione, relativo alla pagina corrente (funziona in dev e su GitHub Pages). */
export function pageUrl(page: string, params?: Record<string, string>): string {
  const url = new URL(page, window.location.href);
  url.search = "";
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.href;
}
