/** Pannello master: importa schede e bestiario, abbina ai token, collega mostri. */
import { useRef, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { getLink } from "../../shared/assignment";
import { findMonster, findPg, merge, parseImport, saveLibrary, type Library } from "../../sheet/library";
import { applyPg, bindMonster, readSheet, unbindSheet } from "../../sheet/store";

export function SheetsSection({
  lib,
  setLib,
  characters,
  selection,
}: {
  lib: Library;
  setLib: (l: Library) => void;
  characters: Item[];
  selection: Item[];
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let next = lib;
    const msgs: string[] = [];
    for (const f of Array.from(files)) {
      const res = parseImport(await f.text(), f.name);
      next = merge(next, res);
      if (res.pg.length || res.mostri.length) msgs.push(`${f.name}: ${res.pg.length} PG, ${res.mostri.length} mostri`);
      msgs.push(...res.errori);
    }
    await saveLibrary(next);
    setLib(next);
    setReport(msgs);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** PG: token assegnati a un giocatore con nome uguale alla scheda. Mostri: token non assegnati, per nome. */
  const autoMatch = async () => {
    const msgs: string[] = [];
    for (const t of characters) {
      const current = readSheet(t);
      if (getLink(t)) {
        const pg = findPg(lib, t.name);
        if (pg) {
          await applyPg(t.id, pg);
          msgs.push(`📜 ${t.name} ← ${pg.nome}`);
        }
      } else {
        const m = findMonster(lib, t.name);
        if (m && !(current?.tipo === "mostro" && current.id === m.id)) {
          await bindMonster([t.id], m);
          msgs.push(`👹 ${t.name} ← ${m.nome}`);
        }
      }
    }
    setReport(msgs.length ? msgs : ["Nessun nuovo abbinamento: controlla che i nomi dei token corrispondano alle schede."]);
  };

  const monster = lib.mostri.find((m) => m.nome === query || m.nomeOriginale === query);
  const bindSelected = async () => {
    if (!monster || !selection.length) return;
    await bindMonster(
      selection.map((i) => i.id),
      monster,
    );
    await OBR.notification.show(`${monster.nome} collegato a ${selection.length} token`, "SUCCESS");
    setQuery("");
  };

  return (
    <div className="section">
      <h2>Schede e mostri</h2>
      <p className="muted">
        Archivio su questo dispositivo: <b>{lib.pg.length}</b> PG · <b>{lib.mostri.length}</b> mostri
      </p>
      <div className="row-btns">
        <button onClick={() => fileRef.current?.click()}>📂 Importa JSON</button>
        <button onClick={autoMatch} disabled={!lib.pg.length && !lib.mostri.length}>
          🔗 Abbina per nome
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      <div className="bind-row">
        <input
          list="obr-tavolo-mostri"
          placeholder={selection.length ? `Mostro per ${selection.length} token selezionati…` : "Seleziona token, poi cerca il mostro"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <datalist id="obr-tavolo-mostri">
          {lib.mostri.map((m) => (
            <option key={m.id} value={m.nome}>
              {m.nomeOriginale && m.nomeOriginale !== m.nome ? m.nomeOriginale : m.gs ? `GS ${m.gs}` : ""}
            </option>
          ))}
        </datalist>
        <button className="primary" disabled={!monster || !selection.length} onClick={bindSelected}>
          Collega
        </button>
      </div>
      {selection.some((i) => readSheet(i)) && (
        <button className="small" onClick={() => unbindSheet(selection.map((i) => i.id))}>
          Scollega scheda dai selezionati
        </button>
      )}

      {report.length > 0 && (
        <div className="notice ok report">
          {report.slice(0, 12).map((r, i) => (
            <div key={i}>{r}</div>
          ))}
          {report.length > 12 && <div>… e altri {report.length - 12}</div>}
        </div>
      )}

      {(lib.pg.length > 0 || lib.mostri.length > 0) && (
        <button
          className="small"
          style={{ marginTop: 8 }}
          onClick={async () => {
            if (!confirmClear) return setConfirmClear(true);
            const empty = { pg: [], mostri: [] };
            await saveLibrary(empty);
            setLib(empty);
            setConfirmClear(false);
          }}
        >
          {confirmClear ? "Confermi? L'archivio di questo dispositivo verrà svuotato" : "Svuota archivio"}
        </button>
      )}
    </div>
  );
}

/** Menu a tendina per scegliere la scheda PG di un token. */
export function PgSelect({ item, lib }: { item: Item; lib: Library }) {
  const current = readSheet(item);
  if (!lib.pg.length && current?.tipo !== "pg") return null;
  return (
    <select
      value={current?.tipo === "pg" ? current.id : ""}
      onChange={async (e) => {
        const pg = lib.pg.find((p) => p.id === e.target.value);
        if (pg) await applyPg(item.id, pg);
        else await unbindSheet([item.id]);
      }}
    >
      <option value="">— scheda —</option>
      {current?.tipo === "pg" && !lib.pg.some((p) => p.id === current.id) && <option value={current.id}>{current.nome}</option>}
      {lib.pg.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nome}
        </option>
      ))}
    </select>
  );
}
