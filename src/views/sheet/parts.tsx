/** Componenti della scheda PG, condivisi fra Scheda, Combattimento ed Esplorazione. */
import { createContext, useContext, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import {
  abilityMods,
  attackBonus,
  attackDamage,
  hitDice,
  initiative,
  passivePerception,
  profBonus,
  saveBonus,
  skillBonus,
  spellAttack,
  spellDC,
  totalLevel,
} from "../../sheet/derive";
import { d20, fmtMod, roll, type Mode } from "../../sheet/dice";
import { attackAndShare, rollAndShare, share } from "../../sheet/rolls";
import { ABILITIES, ABILITY_LABEL, ABILITY_SHORT, SKILLS, type PgSheet, type Spell } from "../../sheet/types";
import { mutate, readState, type CharState } from "../../shared/vitals";

/* ---------- contesto: scheda, token, modalità di tiro ---------- */

interface Ctx {
  sheet: PgSheet;
  item: Item;
  mode: Mode;
  setMode: (m: Mode) => void;
}
export const SheetCtx = createContext<Ctx | null>(null);
const useSheet = () => useContext(SheetCtx)!;

const safe = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    await OBR.notification.show(`Operazione non riuscita: ${String(e)}`, "ERROR");
  }
};

/** Normale / Vantaggio / Svantaggio: vale per il prossimo tiro, poi torna Normale. */
export function ModeBar() {
  const { mode, setMode } = useSheet();
  const opts: [Mode, string][] = [
    ["svantaggio", "Svantaggio"],
    ["normale", "Normale"],
    ["vantaggio", "Vantaggio"],
  ];
  return (
    <div className="seg mode-bar">
      {opts.map(([m, l]) => (
        <button key={m} className={mode === m ? `on ${m}` : ""} onClick={() => setMode(m)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function useRoller() {
  const { sheet, mode, setMode } = useSheet();
  const go = async (label: string, expr: string, useMode = true) => {
    await rollAndShare(sheet.nome, label, expr, useMode ? mode : "normale");
    if (useMode) setMode("normale");
  };
  return go;
}

/* ---------- intestazione con i numeri chiave ---------- */

export function SheetHeader() {
  const { sheet } = useSheet();
  const go = useRoller();
  const lvl = totalLevel(sheet);
  const classes = sheet.classi.map((c) => `${c.classe}${c.sottoclasse ? ` (${c.sottoclasse})` : ""} ${c.livello}`).join(" / ");
  const speed = Object.entries(sheet.velocita)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k === "camminare" ? "" : k + " "}${v} ft`)
    .join(" · ");
  return (
    <div className="card sheet-head">
      <div className="muted">
        {sheet.specie} · {classes} · {sheet.background}
      </div>
      <div className="kpis">
        <Kpi label="CA" value={String(sheet.ca)} />
        <Kpi label="Iniziativa" value={fmtMod(initiative(sheet))} onClick={() => go("Iniziativa", d20(initiative(sheet)))} />
        <Kpi label="Competenza" value={fmtMod(profBonus(lvl))} />
        <Kpi label="Perc. passiva" value={String(passivePerception(sheet))} />
      </div>
      <div className="muted">Velocità {speed}</div>
    </div>
  );
}

function Kpi({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  return (
    <button className={`kpi ${onClick ? "rollable" : ""}`} onClick={onClick} disabled={!onClick}>
      <span className="kpi-v">{value}</span>
      <span className="kpi-l">{label}</span>
    </button>
  );
}

/* ---------- caratteristiche e tiri salvezza ---------- */

export function AbilityGrid() {
  const { sheet } = useSheet();
  const go = useRoller();
  const mods = abilityMods(sheet);
  return (
    <div className="abil-grid">
      {ABILITIES.map((a) => {
        const sv = saveBonus(sheet, a);
        const prof = sheet.tiriSalvezza.includes(a);
        return (
          <div className="abil" key={a}>
            <button className="abil-main rollable" onClick={() => go(`Prova di ${ABILITY_LABEL[a]}`, d20(mods[a]))}>
              <span className="abil-l">{ABILITY_SHORT[a]}</span>
              <span className="abil-m">{fmtMod(mods[a])}</span>
              <span className="abil-s">{sheet.caratteristiche[a]}</span>
            </button>
            <button className={`abil-save rollable ${prof ? "prof" : ""}`} onClick={() => go(`TS ${ABILITY_LABEL[a]}`, d20(sv))}>
              TS {fmtMod(sv)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- abilità ---------- */

export function SkillList() {
  const { sheet } = useSheet();
  const go = useRoller();
  return (
    <div className="list">
      {SKILLS.map((s) => {
        const b = skillBonus(sheet, s.id);
        const p = sheet.abilita[s.id] ?? 0;
        return (
          <button key={s.id} className="list-row rollable" onClick={() => go(s.label, d20(b))}>
            <span className={`prof-dot p${p}`} />
            <span className="grow">{s.label}</span>
            <span className="muted">{ABILITY_SHORT[s.car]}</span>
            <b className="num">{fmtMod(b)}</b>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- attacchi ---------- */

export function AttackList() {
  const { sheet, mode, setMode } = useSheet();
  if (!sheet.attacchi.length) return <p className="muted">Nessun attacco in scheda.</p>;
  return (
    <div className="list">
      {sheet.attacchi.map((a, i) => {
        const bonus = attackBonus(sheet, a);
        const dmg = attackDamage(sheet, a);
        return (
          <button
            key={i}
            className="list-row attack rollable"
            onClick={async () => {
              await attackAndShare(sheet.nome, a.nome, bonus, dmg, mode, sheet.critico ?? 20);
              setMode("normale");
            }}
          >
            <span className="grow">
              <b>{a.nome}</b>
              <span className="muted small">
                {[a.tipo === "mischia" ? "Mischia" : a.tipo === "distanza" ? "Distanza" : "Incantesimo", a.gittata, a.padronanza && `Padronanza: ${a.padronanza}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span className="atk-bonus">{fmtMod(bonus)}</span>
            <span className="atk-dmg">{dmg.map((d) => `${d.expr} ${d.tipo}`).join(" + ")}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- risorse di classe ---------- */

export function ResourceList() {
  const { sheet, item } = useSheet();
  const st = readState(item);
  if (!sheet.risorse?.length) return null;
  const setUsed = (id: string, used: number) =>
    safe(() => mutate(item.id, (_v, s) => ({ s: { ...s, risorseUsate: { ...s.risorseUsate, [id]: used } } })));
  return (
    <div className="list">
      {sheet.risorse.map((r) => {
        const used = Math.min(r.max, st.risorseUsate[r.id] ?? 0);
        return (
          <div className="list-row" key={r.id}>
            <span className="grow">
              <b>{r.nome}</b>
              <span className="muted small">
                {r.max - used}/{r.max} · ricarica {r.ricarica === "breve" ? "riposo breve" : "riposo lungo"}
                {r.perBreve ? ` (${r.perBreve} col breve)` : ""}
              </span>
            </span>
            <Pips total={r.max} used={used} onChange={(u) => setUsed(r.id, u)} />
          </div>
        );
      })}
    </div>
  );
}

/** Pallini da spuntare: pieni = disponibili, vuoti = spesi. Tocco = spendi / recupera. */
export function Pips({ total, used, onChange }: { total: number; used: number; onChange: (used: number) => void }) {
  return (
    <span className="pips">
      {Array.from({ length: total }, (_, i) => {
        const available = i < total - used;
        return (
          <button
            key={i}
            className={`pip-s ${available ? "full" : ""}`}
            aria-label={available ? "spendi" : "recupera"}
            onClick={() => onChange(available ? used + 1 : used - 1)}
          />
        );
      })}
    </span>
  );
}

/* ---------- incantesimi ---------- */

export function SpellSection({ onlyPrepared = false, filter }: { onlyPrepared?: boolean; filter?: (s: Spell) => boolean }) {
  const { sheet, item, mode, setMode } = useSheet();
  const sp = sheet.incantesimi;
  const st = readState(item);
  const [msg, setMsg] = useState<string | null>(null);
  if (!sp) return <p className="muted">Questo personaggio non lancia incantesimi.</p>;

  const dc = spellDC(sheet)!;
  const atk = spellAttack(sheet)!;
  const used = (lvl: number) => st.slotUsati[lvl - 1] ?? 0;
  const setSlot = (lvl: number, n: number) =>
    safe(() =>
      mutate(item.id, (_v, s) => {
        const arr = [...s.slotUsati];
        while (arr.length < lvl) arr.push(0);
        arr[lvl - 1] = n;
        return { s: { ...s, slotUsati: arr } };
      }),
    );

  const cast = async (spell: Spell, asRitual = false) => {
    let slotNote = "";
    const res = spell.risorsa ? sheet.risorse?.find((r) => r.id === spell.risorsa) : undefined;
    if (res && !asRitual) {
      const usedRes = st.risorseUsate[res.id] ?? 0;
      if (usedRes >= res.max) {
        setMsg(`${res.nome}: nessun uso rimasto.`);
        return;
      }
      await mutate(item.id, (_v, s) => ({ s: { ...s, risorseUsate: { ...s.risorseUsate, [res.id]: (s.risorseUsate[res.id] ?? 0) + 1 } } }));
      slotNote = `${res.nome}, senza slot`;
    } else if (spell.livello > 0 && !asRitual) {
      // primo slot libero dal livello dell'incantesimo in su (poi lo slot del patto)
      let lvl = 0;
      for (let l = spell.livello; l <= sp.slot.length; l++) if ((sp.slot[l - 1] ?? 0) - used(l) > 0) { lvl = l; break; }
      if (lvl) {
        await mutate(item.id, (_v, s) => {
          const arr = [...s.slotUsati];
          while (arr.length < lvl) arr.push(0);
          arr[lvl - 1] = (arr[lvl - 1] ?? 0) + 1;
          return { s: { ...s, slotUsati: arr } };
        });
        slotNote = `slot di ${lvl}° livello`;
      } else if (sp.patto && sp.patto.livello >= spell.livello && sp.patto.slot - st.pattoUsati > 0) {
        await mutate(item.id, (_v, s) => ({ s: { ...s, pattoUsati: s.pattoUsati + 1 } }));
        slotNote = `slot del patto (${sp.patto.livello}°)`;
      } else {
        setMsg(`Nessuno slot disponibile per ${spell.nome}.`);
        return;
      }
    }
    if (spell.concentrazione) {
      await mutate(item.id, (_v, s: CharState) => ({ s: { ...s, concentration: spell.nome } }));
    }
    const how = asRitual ? "come rituale (+10 minuti, nessuno slot)" : slotNote;
    if (spell.attacco) {
      await attackAndShare(sheet.nome, spell.nome, atk, spell.danni ? [{ expr: spell.danni, tipo: spell.tipoDanni ?? "" }] : [], mode);
      setMode("normale");
    } else {
      const dmg = spell.danni ? roll(spell.danni) : null;
      await share({
        char: sheet.nome,
        label: `lancia ${spell.nome}${how ? ` (${how})` : ""}`,
        total: dmg ? dmg.total : 0,
        detail: dmg ? `${dmg.detail} ${spell.tipoDanni ?? ""}`.trim() : "",
        extra: spell.ts ? `TS ${ABILITY_LABEL[spell.ts]} CD ${dc}` : spell.sintesi,
      });
    }
    setMsg(null);
  };

  const list = sp.lista.filter((s) => (!onlyPrepared || s.livello === 0 || s.preparato !== false) && (!filter || filter(s)));
  const levels = [...new Set(list.map((s) => s.livello))].sort((a, b) => a - b);

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi label="CD incantesimi" value={String(dc)} />
        <Kpi label="Attacco incant." value={fmtMod(atk)} />
        <Kpi label="Caratteristica" value={ABILITY_SHORT[sp.car]} />
      </div>
      {sp.slot.some((n) => n > 0) && (
        <div className="slot-rows">
          {sp.slot.map((n, i) =>
            n > 0 ? (
              <div className="list-row" key={i}>
                <span className="grow">Slot {i + 1}° livello</span>
                <Pips total={n} used={Math.min(n, used(i + 1))} onChange={(u) => setSlot(i + 1, u)} />
              </div>
            ) : null,
          )}
          {sp.patto && (
            <div className="list-row">
              <span className="grow">Slot del patto ({sp.patto.livello}°)</span>
              <Pips
                total={sp.patto.slot}
                used={Math.min(sp.patto.slot, st.pattoUsati)}
                onChange={(u) => safe(() => mutate(item.id, (_v, s) => ({ s: { ...s, pattoUsati: u } })))}
              />
            </div>
          )}
        </div>
      )}
      {msg && <div className="notice">{msg}</div>}
      {levels.map((l) => (
        <div key={l}>
          <h3 className="lvl-title">{l === 0 ? "Trucchetti" : `${l}° livello`}</h3>
          <div className="list">
            {list
              .filter((s) => s.livello === l)
              .map((s) => (
                <div className="list-row spell" key={s.nome}>
                  <span className="grow">
                    <b>{s.nome}</b>
                    {s.concentrazione && <span className="tag">C</span>}
                    {s.rituale && <span className="tag">R</span>}
                    <span className="muted small">
                      {[s.tempo, s.gittata, s.ts && `TS ${ABILITY_SHORT[s.ts]} CD ${dc}`, s.attacco && `attacco ${fmtMod(atk)}`, s.danni && `${s.danni} ${s.tipoDanni ?? ""}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {s.sintesi && <span className="small">{s.sintesi}</span>}
                  </span>
                  <span className="spell-btns">
                    <button className="small primary" onClick={() => safe(() => cast(s))}>
                      Lancia
                    </button>
                    {s.rituale && (
                      <button className="small" onClick={() => safe(() => cast(s, true))}>
                        Rituale
                      </button>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- inventario, privilegi, note ---------- */

export function Inventory() {
  const { sheet } = useSheet();
  const coins = Object.entries(sheet.monete ?? {}).filter(([, v]) => v);
  return (
    <div className="stack">
      {coins.length > 0 && (
        <div className="coins">
          {coins.map(([k, v]) => (
            <span key={k} className="coin">
              <b>{v}</b> {k.toUpperCase()}
            </span>
          ))}
        </div>
      )}
      <div className="list">
        {(sheet.inventario ?? []).map((x, i) => (
          <div className="list-row" key={i}>
            <span className="grow">
              {x.qta && x.qta > 1 ? `${x.qta} × ` : ""}
              {x.nome}
              {x.note && <span className="muted small">{x.note}</span>}
            </span>
            {x.equip && <span className="tag">equip.</span>}
            {x.sintonia && <span className="tag">sintonia</span>}
          </div>
        ))}
        {!sheet.inventario?.length && <p className="muted">Inventario vuoto.</p>}
      </div>
    </div>
  );
}

export function Features() {
  const { sheet } = useSheet();
  const prof = sheet.competenze;
  return (
    <div className="stack">
      <ResourceList />
      <div className="list">
        {(sheet.privilegi ?? []).map((f, i) => (
          <div className="list-row feature" key={i}>
            <span className="grow">
              <b>{f.nome}</b> {f.fonte && <span className="muted small">{f.fonte}</span>}
              <span className="small">{f.sintesi}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="card small">
        {sheet.sensi?.length ? <p>👁 {sheet.sensi.join(", ")}</p> : null}
        {sheet.linguaggi?.length ? <p>🗣 {sheet.linguaggi.join(", ")}</p> : null}
        {prof?.armature?.length ? <p>🛡 {prof.armature.join(", ")}</p> : null}
        {prof?.armi?.length ? <p>⚔️ {prof.armi.join(", ")}</p> : null}
        {prof?.strumenti?.length ? <p>🔧 {prof.strumenti.join(", ")}</p> : null}
        {sheet.note && <p style={{ whiteSpace: "pre-wrap" }}>📝 {sheet.note}</p>}
      </div>
    </div>
  );
}

/* ---------- Dadi Vita (riposo breve) ---------- */

export function HitDice() {
  const { sheet, item } = useSheet();
  const st = readState(item);
  const all = hitDice(sheet);
  const conMod = abilityMods(sheet).cos;
  const spend = (size: number) =>
    safe(async () => {
      const r = roll(`1d${size}`)!;
      const gain = Math.max(1, r.total + conMod);
      await mutate(item.id, (v, s) => ({
        v: { ...v, hp: Math.min(v.maxHp || Infinity, v.hp + gain) },
        s: { ...s, dadiVitaUsati: { ...s.dadiVitaUsati, [size]: (s.dadiVitaUsati[size] ?? 0) + 1 } },
      }));
      await share({ char: sheet.nome, label: `Dado Vita d${size}`, total: gain, detail: `[${r.total}] ${fmtMod(conMod)} (min 1)`, extra: "PF recuperati" });
    });
  return (
    <div className="list">
      {Object.entries(all).map(([size, n]) => {
        const used = st.dadiVitaUsati[size] ?? 0;
        const left = Math.max(0, n - used);
        return (
          <div className="list-row" key={size}>
            <span className="grow">
              <b>d{size}</b> <span className="muted small">{left}/{n} disponibili · + COS {fmtMod(conMod)}</span>
            </span>
            <button className="small primary" disabled={left === 0} onClick={() => spend(Number(size))}>
              Spendi
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- riposi (logica sullo stato) ---------- */

export function shortRestState(sheet: PgSheet, s: CharState): CharState {
  const ru = { ...s.risorseUsate };
  for (const r of sheet.risorse ?? []) {
    if (r.ricarica === "breve") ru[r.id] = 0;
    else if (r.perBreve) ru[r.id] = Math.max(0, (ru[r.id] ?? 0) - r.perBreve);
  }
  return { ...s, risorseUsate: ru, pattoUsati: 0 };
}

export function longRestState(_sheet: PgSheet, s: CharState): CharState {
  return {
    ...s,
    risorseUsate: {},
    slotUsati: [],
    pattoUsati: 0,
    dadiVitaUsati: {},
    exhaustion: Math.max(0, s.exhaustion - 1),
    concentration: null,
    deathSaves: { ok: 0, ko: 0 },
  };
}
