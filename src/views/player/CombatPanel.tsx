import { useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
  applyDamage,
  applyHeal,
  applyTempHp,
  CONDITIONS,
  mutate,
  readState,
  readVitals,
  writeVitals,
  type CharState,
  type Vitals,
} from "../../shared/vitals";
import { readPg } from "../../sheet/store";
import { AttackList, ModeBar, ResourceList, SpellSection } from "../sheet/parts";
import { Popup } from "./PlayerApp";

type Tab = "stato" | "azioni";

export function CombatPanel({ item, onClose, onMove }: { item: Item; onClose: () => void; onMove: () => void }) {
  const [tab, setTab] = useState<Tab>("stato");
  return (
    <Popup
      title="Combattimento"
      onClose={onClose}
      extra={
        <button className="small" onClick={onMove}>
          🧭 Movimento
        </button>
      }
    >
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={tab === "stato" ? "on" : ""} onClick={() => setTab("stato")}>
          Stato
        </button>
        <button className={tab === "azioni" ? "on" : ""} onClick={() => setTab("azioni")}>
          Azioni
        </button>
      </div>
      {tab === "stato" ? <StatusTab item={item} /> : <ActionsTab item={item} />}
    </Popup>
  );
}

const safe = async (fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    await OBR.notification.show(`Modifica non riuscita: ${String(e)}`, "ERROR");
  }
};

function StatusTab({ item }: { item: Item }) {
  const v = readVitals(item);
  const s = readState(item);
  const [amount, setAmount] = useState("");
  const n = parseInt(amount, 10);
  const valid = Number.isFinite(n) && n > 0;

  /** Le modifiche partono sempre dai valori attuali del token. */
  const patchS = (fn: (cur: CharState) => CharState) => safe(() => mutate(item.id, (_v, cur) => ({ s: fn(cur) })));
  const setS = (next: CharState) => patchS((cur) => ({ ...cur, ...pickEditable(next) }));
  const apply = (fn: (v: Vitals, a: number) => Vitals) => {
    if (!valid) return;
    safe(() => mutate(item.id, (cur) => ({ v: fn(cur, n) })));
    setAmount("");
  };
  const toggle = (id: string) =>
    patchS((cur) => ({ ...cur, conditions: cur.conditions.includes(id) ? cur.conditions.filter((c) => c !== id) : [...cur.conditions, id] }));

  if (v.maxHp === 0) return <Setup item={item} v={v} />;

  return (
    <div className="stack">
      {/* PF */}
      <div className="card">
        <div className="hp-line">
          <span className="hp-big">{v.hp}</span>
          <span className="muted">/ {v.maxHp} PF</span>
          {v.tempHp > 0 && <span className="temp">+{v.tempHp} temp</span>}
          <span style={{ flex: 1 }} />
          <span className="ac-badge">🛡 {v.ac}</span>
        </div>
        <div className="hp-input">
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Quanti?"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
          <button className="dmg" disabled={!valid} onClick={() => apply(applyDamage)}>
            Danno
          </button>
          <button className="heal" disabled={!valid} onClick={() => apply(applyHeal)}>
            Cura
          </button>
          <button disabled={!valid} onClick={() => apply(applyTempHp)}>
            Temp
          </button>
        </div>
      </div>

      {/* Tiri salvezza contro la morte */}
      {v.hp === 0 && (
        <div className="card">
          <h3>Tiri salvezza contro la morte</h3>
          {(["ok", "ko"] as const).map((k) => (
            <div className="death-row" key={k}>
              <span>{k === "ok" ? "Successi" : "Fallimenti"}</span>
              {[1, 2, 3].map((i) => (
                <button
                  key={i}
                  className={`pip ${k} ${s.deathSaves[k] >= i ? "on" : ""}`}
                  onClick={() => setS({ ...s, deathSaves: { ...s.deathSaves, [k]: s.deathSaves[k] >= i ? i - 1 : i } })}
                  aria-label={`${k} ${i}`}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Concentrazione */}
      <div className="card row-card">
        <span>🔮 Concentrazione</span>
        {s.concentration ? (
          <>
            <b className="grow">{s.concentration}</b>
            <button className="small" onClick={() => setS({ ...s, concentration: null })}>
              Termina
            </button>
          </>
        ) : (
          <ConcentrationInput onSet={(name) => setS({ ...s, concentration: name })} />
        )}
      </div>

      {/* Condizioni */}
      <div className="card">
        <h3>Condizioni</h3>
        <div className="cond-grid">
          {CONDITIONS.map((c) => (
            <button key={c.id} className={s.conditions.includes(c.id) ? "on" : ""} onClick={() => toggle(c.id)}>
              <span>{c.icon}</span> {c.label}
            </button>
          ))}
        </div>
        <div className="death-row" style={{ marginTop: 10 }}>
          <span>🥱 Indebolimento</span>
          <button className="small" disabled={s.exhaustion === 0} onClick={() => setS({ ...s, exhaustion: s.exhaustion - 1 })}>
            −
          </button>
          <b style={{ minWidth: 20, textAlign: "center" }}>{s.exhaustion}</b>
          <button className="small" disabled={s.exhaustion === 6} onClick={() => setS({ ...s, exhaustion: s.exhaustion + 1 })}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

/** Campi modificati dal pannello Stato (il resto dello stato resta quello attuale del token). */
const pickEditable = (s: CharState) => ({ exhaustion: s.exhaustion, concentration: s.concentration, deathSaves: s.deathSaves });

function ConcentrationInput({ onSet }: { onSet: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <>
      <input className="grow" placeholder="Incantesimo" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="small" disabled={!name.trim()} onClick={() => onSet(name.trim())}>
        Avvia
      </button>
    </>
  );
}

/** Prima configurazione (finché non c'è la scheda): PF massimi e CA. */
function Setup({ item, v }: { item: Item; v: Vitals }) {
  const [hp, setHp] = useState("");
  const [ac, setAc] = useState(v.ac ? String(v.ac) : "");
  const h = parseInt(hp, 10);
  const a = parseInt(ac, 10);
  const ok = h > 0 && a > 0;
  return (
    <div className="card stack">
      <p>Imposta i valori di base del personaggio. Più avanti arriveranno dalla scheda.</p>
      <label className="field">
        PF massimi
        <input inputMode="numeric" value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="field">
        Classe Armatura
        <input inputMode="numeric" value={ac} onChange={(e) => setAc(e.target.value.replace(/\D/g, ""))} />
      </label>
      <button
        className="primary"
        disabled={!ok}
        onClick={() => safe(() => writeVitals(item.id, { hp: h, maxHp: h, tempHp: 0, ac: a }))}
      >
        Salva
      </button>
    </div>
  );
}

/** Economia del turno (locale al telefono) + azioni dalla scheda. */
function ActionsTab({ item }: { item: Item }) {
  const sheet = readPg(item);
  const [used, setUsed] = useState<Record<string, boolean>>({});
  const econ = [
    ["action", "Azione"],
    ["bonus", "Azione bonus"],
    ["reaction", "Reazione"],
  ] as const;
  return (
    <div className="stack">
      <div className="card">
        <h3>Questo turno</h3>
        <div className="econ">
          {econ.map(([k, label]) => (
            <button key={k} className={used[k] ? "spent" : ""} onClick={() => setUsed((u) => ({ ...u, [k]: !u[k] }))}>
              {used[k] ? "✓ " : ""}
              {label}
            </button>
          ))}
        </div>
        <button className="small" style={{ marginTop: 8 }} onClick={() => setUsed({})}>
          Nuovo turno
        </button>
      </div>
      {sheet ? (
        <>
          <ModeBar />
          <h3 className="lvl-title">⚔️ Attacchi</h3>
          <AttackList />
          {sheet.incantesimi && (
            <>
              <h3 className="lvl-title">✨ Incantesimi preparati</h3>
              <SpellSection onlyPrepared />
            </>
          )}
          {sheet.risorse?.length ? (
            <>
              <h3 className="lvl-title">🎯 Risorse</h3>
              <ResourceList />
            </>
          ) : null}
        </>
      ) : (
        <div className="card placeholder">
          <p className="muted">Collega una scheda per vedere qui armi, incantesimi e risorse con il tiro automatico.</p>
        </div>
      )}
    </div>
  );
}
