/** Master: mostri dell'incontro (visibili/nascosti) e combattimento con iniziativa. */
import { useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { itemImage } from "../../shared/hooks";
import { readVitals } from "../../shared/vitals";
import { readSheet } from "../../sheet/store";
import { roll } from "../../sheet/dice";
import {
  entryFor,
  isPcToken,
  sortEntries,
  updateCombat,
  type CombatState,
} from "../../shared/combat";
import { fmtMod, d20 } from "../../sheet/dice";
import { setFocus } from "../../shared/focus";

const setVisible = (ids: string[], visible: boolean) =>
  OBR.scene.items.updateItems(ids, (items) => {
    for (const i of items) i.visible = visible;
  });

export function EncounterTab({ characters, combat }: { characters: Item[]; combat: CombatState }) {
  const monsters = characters.filter((c) => !isPcToken(c));
  const pcs = characters.filter(isPcToken);
  const hidden = monsters.filter((m) => !m.visible);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const start = () =>
    updateCombat(() => ({ active: true, entries: [...pcs, ...monsters].map(entryFor) }));

  /** Aggiunge i token nuovi e toglie quelli cancellati, senza perdere i tiri già fatti. */
  const refresh = () =>
    updateCombat((c) => {
      const ids = new Set(characters.map((x) => x.id));
      const kept = c.entries.filter((e) => ids.has(e.id));
      const known = new Set(kept.map((e) => e.id));
      const added = characters.filter((x) => !known.has(x.id)).map(entryFor);
      return { ...c, entries: [...kept, ...added] };
    });

  /** Iniziativa dei mostri che non l'hanno ancora: tiro segreto d20 + bonus. */
  const rollMonsters = () =>
    updateCombat((c) => ({
      ...c,
      entries: c.entries.map((e) => {
        if (e.kind !== "mostro" || e.init !== null) return e;
        const r = roll(d20(e.bonus))!;
        return { ...e, init: r.total, detail: r.detail };
      }),
    }));

  const setInit = (id: string, v: string) => {
    const n = v.trim() === "" ? null : parseInt(v, 10);
    if (v.trim() !== "" && !Number.isFinite(n)) return;
    return updateCombat((c) => ({ ...c, entries: c.entries.map((e) => (e.id === id ? { ...e, init: n, detail: "a mano" } : e)) }));
  };

  const byId = new Map(characters.map((c) => [c.id, c]));
  const sorted = sortEntries(combat.entries);
  const waitingPcs = combat.entries.filter((e) => e.kind === "pg" && e.init === null).length;

  return (
    <>
      {/* ---- Mostri ---- */}
      <div className="section">
        <h2>Mostri in scena ({monsters.length})</h2>
        {monsters.length === 0 && <p className="muted">Nessun mostro: piazzali sulla mappa (livello Character).</p>}
        {monsters.length > 0 && (
          <div className="row-btns">
            <button onClick={() => setVisible(monsters.map((m) => m.id), true)} disabled={hidden.length === 0}>
              👁 Rivela tutti
            </button>
            <button onClick={() => setVisible(monsters.map((m) => m.id), false)} disabled={hidden.length === monsters.length}>
              🙈 Nascondi tutti
            </button>
          </div>
        )}
        {monsters.map((m) => {
          const v = readVitals(m);
          const sh = readSheet(m);
          return (
            <div className="row" key={m.id}>
              {itemImage(m) ? <img className="thumb" src={itemImage(m)} alt="" style={{ opacity: m.visible ? 1 : 0.4 }} /> : <span className="thumb" />}
              <div className="grow" onClick={() => setFocus([m.id])} style={{ cursor: "pointer" }}>
                <div className="name">{m.name}</div>
                <div className="muted small">
                  {sh?.tipo === "mostro" ? sh.nome : "nessuna scheda"}
                  {v.maxHp ? ` · ${v.hp}/${v.maxHp} PF` : ""}
                </div>
              </div>
              <button className={`small ${m.visible ? "" : "primary"}`} onClick={() => setVisible([m.id], !m.visible)}>
                {m.visible ? "👁 visibile" : "🙈 nascosto"}
              </button>
            </div>
          );
        })}
      </div>

      {/* ---- Combattimento ---- */}
      <div className="section">
        <h2>Combattimento</h2>
        {!combat.active ? (
          <>
            <p className="muted">
              Avviando il combattimento, PG e mostri della scena entrano in un unico elenco. I giocatori vedono il pulsante
              per tirare l'iniziativa.
            </p>
            <button className="primary block" onClick={start} disabled={!characters.length}>
              ⚔️ Avvia combattimento
            </button>
          </>
        ) : (
          <>
            <div className="row-btns">
              <button onClick={rollMonsters} disabled={!combat.entries.some((e) => e.kind === "mostro" && e.init === null)}>
                🎲 Tira per i mostri
              </button>
              <button onClick={refresh}>↻ Aggiorna partecipanti</button>
            </div>
            {waitingPcs > 0 && <p className="muted">In attesa di {waitingPcs} PG…</p>}
            <div className="init-list">
              {sorted.map((e, i) => {
                const it = byId.get(e.id);
                return (
                  <div className={`init-row ${e.kind}`} key={e.id}>
                    <span className="init-rank">{e.init === null ? "–" : i + 1}</span>
                    <div className="grow" onClick={() => it && setFocus([e.id])} style={{ cursor: "pointer" }}>
                      <div className="name">
                        {e.kind === "mostro" ? "👹 " : "🧙 "}
                        {e.name}
                        {it && !it.visible && <span className="tag">nascosto</span>}
                        {!it && <span className="tag">rimosso</span>}
                      </div>
                      <div className="muted small">
                        bonus {fmtMod(e.bonus)}
                        {e.detail ? ` · ${e.detail}` : e.kind === "pg" && e.init === null ? " · attende il tiro" : ""}
                      </div>
                    </div>
                    <input
                      className="init-input"
                      inputMode="numeric"
                      value={e.init ?? ""}
                      placeholder="—"
                      onChange={(ev) => setInit(e.id, ev.target.value.replace(/[^\d-]/g, ""))}
                    />
                  </div>
                );
              })}
            </div>
            <button
              className="small"
              style={{ marginTop: 8 }}
              onClick={async () => {
                if (!confirmEnd) return setConfirmEnd(true);
                setConfirmEnd(false);
                await updateCombat(() => ({ active: false, entries: [] }));
              }}
            >
              {confirmEnd ? "Confermi la fine del combattimento?" : "⏹ Termina combattimento"}
            </button>
          </>
        )}
      </div>
    </>
  );
}
