/**
 * Archivio delle schede sul dispositivo del master (IndexedDB).
 * Il bestiario resta qui, privato: non passa da GitHub né dagli altri giocatori.
 */
import type { Bestiary, Monster, PgSheet } from "./types";
import { validatePg } from "./derive";

const DB = "obr-tavolo";
const STORE = "kv";
const memory = new Map<string, unknown>(); // ripiego se IndexedDB non è disponibile

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result as T | undefined);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return memory.get(key) as T | undefined;
  }
}

async function set(key: string, value: unknown) {
  memory.set(key, value);
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(value, key);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  } catch {
    /* resta in memoria per questa sessione */
  }
}

export interface Library {
  pg: PgSheet[];
  mostri: Monster[];
}

export async function loadLibrary(): Promise<Library> {
  return { pg: (await get<PgSheet[]>("pg")) ?? [], mostri: (await get<Monster[]>("mostri")) ?? [] };
}

export async function saveLibrary(lib: Library) {
  await set("pg", lib.pg);
  await set("mostri", lib.mostri);
}

export interface ImportResult {
  pg: PgSheet[];
  mostri: Monster[];
  errori: string[];
}

/** Legge il contenuto di un file: scheda singola, array di schede o bestiario. */
export function parseImport(text: string, fileName = "file"): ImportResult {
  const out: ImportResult = { pg: [], mostri: [], errori: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    out.errori.push(`${fileName}: JSON non valido (${(e as Error).message})`);
    return out;
  }
  const visit = (x: unknown, where: string) => {
    const o = x as { tipo?: string };
    if (Array.isArray(x)) return x.forEach((y, i) => visit(y, `${where}[${i}]`));
    if (o?.tipo === "bestiario") return visit((x as Bestiary).mostri ?? [], `${where}.mostri`);
    if (o?.tipo === "pg") {
      const errs = validatePg(x);
      if (errs.length) out.errori.push(`${where}: ${errs.join("; ")}`);
      else out.pg.push(x as PgSheet);
      return;
    }
    if (o?.tipo === "mostro") {
      const m = x as Monster;
      if (!m.nome || typeof m.pf !== "number" || typeof m.ca !== "number")
        out.errori.push(`${where}: mostro senza nome, pf o ca`);
      else out.mostri.push(m);
      return;
    }
    out.errori.push(`${where}: "tipo" mancante o sconosciuto (atteso "pg", "mostro" o "bestiario")`);
  };
  visit(data, fileName);
  return out;
}

/** Unisce le nuove schede all'archivio: stesso id → sostituita. */
export function merge(lib: Library, add: ImportResult): Library {
  const byId = <T extends { id: string }>(old: T[], nu: T[]) => {
    const m = new Map(old.map((x) => [x.id, x]));
    for (const x of nu) m.set(x.id, x);
    return [...m.values()].sort((a, b) => ((a as unknown as { nome: string }).nome ?? "").localeCompare((b as unknown as { nome: string }).nome ?? ""));
  };
  return { pg: byId(lib.pg, add.pg), mostri: byId(lib.mostri, add.mostri) };
}

/** Normalizza un nome per l'abbinamento: minuscole, senza accenti, senza numeri finali ("Goblin 2"). */
export function matchKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[#(\[]?\s*\d+\s*[)\]]?\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findMonster(lib: Library, tokenName: string): Monster | undefined {
  const k = matchKey(tokenName);
  if (!k) return undefined;
  return lib.mostri.find((m) => matchKey(m.nome) === k || (m.nomeOriginale && matchKey(m.nomeOriginale) === k));
}

export function findPg(lib: Library, tokenName: string): PgSheet | undefined {
  const k = matchKey(tokenName);
  return lib.pg.find((p) => matchKey(p.token ?? p.nome) === k || matchKey(p.nome) === k);
}
