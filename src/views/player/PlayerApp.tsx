/**
 * App del giocatore (modal a schermo intero sul telefono).
 * Home con ritratto e valori principali; in basso i quattro accessi:
 * MOVIMENTO · COMBATTIMENTO · ESPLORAZIONE · SCHEDA (ognuno si apre come popup).
 */
import { useEffect, useMemo, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { isCharacter, tokensOf } from "../../shared/assignment";
import { itemImage, useItems, useMe, useObrReady, useSceneReady } from "../../shared/hooks";
import { IDS } from "../../shared/keys";
import { CONDITIONS, readState, readVitals } from "../../shared/vitals";
import { MovePanel } from "../Controller";
import { CombatPanel } from "./CombatPanel";
import { ExplorePanel } from "./ExplorePanel";
import { SheetPanel } from "./SheetPanel";
import { SheetCtx } from "../sheet/parts";
import { readPg } from "../../sheet/store";
import { onLocalRoll, type RollMessage } from "../../sheet/rolls";
import { d20, fmtMod, type Mode } from "../../sheet/dice";
import { rollAndShare } from "../../sheet/rolls";
import { sendInitiative, useCombat, type CombatEntry } from "../../shared/combat";

export type Panel = "home" | "move" | "combat" | "explore" | "sheet";

export function PlayerApp() {
  const ready = useObrReady();
  const me = useMe(ready);
  const sceneReady = useSceneReady(ready);
  const characters = useItems(sceneReady, isCharacter);
  const mine = useMemo(() => (me ? tokensOf(characters, me) : []), [characters, me]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("home");
  const [returnTo, setReturnTo] = useState<Panel>("home");
  const item = mine.find((i) => i.id === selectedId) ?? mine[0];
  const sheet = readPg(item);
  const [mode, setMode] = useState<Mode>("normale");
  const combat = useCombat(sceneReady);
  const myEntry = item && combat.active ? combat.entries.find((e) => e.id === item.id) : undefined;

  const closeApp = () => OBR.modal.close(IDS.modalPlayer);
  const openMove = (from: Panel) => {
    setReturnTo(from);
    setPanel("move");
  };

  if (!ready || !me) return null;

  // Il movimento lascia vedere la mappa: niente home dietro.
  if (panel === "move" && item) {
    return <MovePanel itemId={item.id} onClose={() => setPanel(returnTo)} />;
  }

  const content = (
    <div className="pl">
      <header className="pl-top">
        <span className="muted">OBR Tavolo · {me.name}</span>
        <button className="icon" onClick={closeApp} aria-label="torna alla mappa">
          ✕
        </button>
      </header>

      {!sceneReady && <Empty text="Il master non ha ancora aperto una scena." />}
      {sceneReady && !item && <Empty text={`Nessun personaggio assegnato a “${me.name}”. Chiedi al master.`} />}
      {sceneReady && item && (
        <>
          {mine.length > 1 && (
            <div className="chips pl-switch">
              {mine.map((i) => (
                <button key={i.id} className={i.id === item.id ? "on" : ""} onClick={() => setSelectedId(i.id)}>
                  {i.name}
                </button>
              ))}
            </div>
          )}
          <Hero item={item} />
          {myEntry && <InitBanner item={item} entry={myEntry} />}
        </>
      )}

      <nav className="pl-nav">
        <NavButton icon="🧭" label="Movimento" disabled={!item} onClick={() => openMove("home")} />
        <NavButton icon="⚔️" label="Combattimento" disabled={!item} onClick={() => setPanel("combat")} />
        <NavButton icon="🗺️" label="Esplorazione" disabled={!item} onClick={() => setPanel("explore")} />
        <NavButton icon="📜" label="Scheda" disabled={!item} onClick={() => setPanel("sheet")} />
      </nav>

      {item && panel === "combat" && (
        <CombatPanel item={item} onClose={() => setPanel("home")} onMove={() => openMove("combat")} />
      )}
      {item && panel === "explore" && <ExplorePanel item={item} onClose={() => setPanel("home")} />}
      {item && panel === "sheet" && <SheetPanel item={item} onClose={() => setPanel("home")} />}
      <RollToast />
    </div>
  );

  return sheet && item ? (
    <SheetCtx.Provider value={{ sheet, item, mode, setMode }}>{content}</SheetCtx.Provider>
  ) : (
    content
  );
}

/** Combattimento avviato dal master: tira l'iniziativa (o mostra il valore registrato). */
function InitBanner({ item, entry }: { item: Item; entry: CombatEntry }) {
  const [busy, setBusy] = useState(false);
  if (entry.init !== null) {
    return (
      <div className="init-banner done">
        <span>⚔️</span>
        <span className="grow">Iniziativa registrata</span>
        <b style={{ fontSize: 22 }}>{entry.init}</b>
      </div>
    );
  }
  const go = async () => {
    setBusy(true);
    try {
      const r = await rollAndShare(entry.name || item.name, "Iniziativa", d20(entry.bonus));
      if (r) await sendInitiative({ itemId: item.id, value: r.total, detail: r.detail });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="init-banner">
      <span>⚔️</span>
      <span className="grow">Combattimento! Tira l'iniziativa</span>
      <button className="primary" onClick={go} disabled={busy}>
        🎲 {fmtMod(entry.bonus)}
      </button>
    </div>
  );
}

/** Ultimo tiro, mostrato in basso per qualche secondo. */
function RollToast() {
  const [last, setLast] = useState<RollMessage | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = onLocalRoll((m) => {
      setLast(m);
      clearTimeout(t);
      t = setTimeout(() => setLast(null), 7000);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  if (!last) return null;
  return (
    <div className={`roll-toast ${last.crit ? "crit" : last.fumble ? "fumble" : ""}`} onClick={() => setLast(null)}>
      <div className="rt-label">{last.label}</div>
      <div className="rt-total">
        {last.total || last.detail ? last.total : "✓"}
        {last.crit && <span className="rt-flag">CRITICO</span>}
        {last.fumble && <span className="rt-flag">1 naturale</span>}
      </div>
      {last.detail && <div className="rt-detail">{last.detail}</div>}
      {last.extra && <div className="rt-extra">{last.extra}</div>}
    </div>
  );
}

function Hero({ item }: { item: Item }) {
  const v = readVitals(item);
  const s = readState(item);
  const pg = readPg(item);
  const img = pg?.ritratto || itemImage(item);
  const pct = v.maxHp > 0 ? Math.max(0, Math.min(1, v.hp / v.maxHp)) : 1;
  const tone = v.maxHp === 0 ? "" : v.hp === 0 ? "down" : pct <= 0.5 ? "bloodied" : "healthy";

  return (
    <section className="pl-hero">
      <div className={`portrait ${tone}`}>
        {img ? <img src={img} alt="" /> : <span>{item.name.slice(0, 1)}</span>}
      </div>
      <h1 className="pl-name">{pg?.nome ?? item.name}</h1>
      {pg && (
        <div className="muted" style={{ textAlign: "center", marginTop: -6 }}>
          {pg.specie} · {pg.classi.map((c) => `${c.classe} ${c.livello}`).join(" / ")}
        </div>
      )}

      <div className="tiles">
        <div className="tile wide">
          <div className="tile-label">Punti ferita</div>
          <div className="tile-value">
            {v.maxHp ? (
              <>
                {v.hp}
                <small> / {v.maxHp}</small>
                {v.tempHp > 0 && <span className="temp">+{v.tempHp}</span>}
              </>
            ) : (
              <small>da impostare</small>
            )}
          </div>
          <div className="hpbar">
            <i style={{ width: `${pct * 100}%` }} className={tone} />
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">CA</div>
          <div className="tile-value">{v.ac || "—"}</div>
        </div>
      </div>

      <div className="cond-list">
        {s.concentration && <span className="cond conc">🔮 {s.concentration}</span>}
        {s.exhaustion > 0 && <span className="cond">🥱 Indebolimento {s.exhaustion}</span>}
        {s.conditions.map((id) => {
          const c = CONDITIONS.find((x) => x.id === id);
          return c ? (
            <span key={id} className="cond">
              {c.icon} {c.label}
            </span>
          ) : null;
        })}
        {!s.concentration && s.exhaustion === 0 && s.conditions.length === 0 && (
          <span className="muted">Nessuna condizione</span>
        )}
      </div>
    </section>
  );
}

function NavButton(p: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button className="nav-btn" onClick={p.onClick} disabled={p.disabled}>
      <span className="nav-icon">{p.icon}</span>
      <span>{p.label}</span>
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <section className="pl-hero">
      <div className="portrait">
        <span>?</span>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        {text}
      </p>
    </section>
  );
}

/** Popup a comparsa dal basso, con titolo e X. */
export function Popup(p: { title: string; onClose: () => void; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="popup-backdrop" onClick={p.onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <div className="popup-head">
          <h2 className="popup-title">{p.title}</h2>
          {p.extra}
          <button className="icon" onClick={p.onClose} aria-label="chiudi">
            ✕
          </button>
        </div>
        <div className="popup-body">{p.children}</div>
      </div>
    </div>
  );
}
