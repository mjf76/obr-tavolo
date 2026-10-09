/** Blocco statistiche del mostro (vista master) con tiri cliccabili e PF rapidi. */
import { Fragment, useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { mod } from "../../sheet/derive";
import { d20, fmtMod } from "../../sheet/dice";
import { rollAndShare } from "../../sheet/rolls";
import { readSheet } from "../../sheet/store";
import { ABILITIES, ABILITY_SHORT, type Monster } from "../../sheet/types";
import { applyDamage, applyHeal, mutate, readVitals } from "../../shared/vitals";
import { passivePerception, saveBonus } from "../../sheet/derive";

export function SelectedCard({ item, publicRolls }: { item: Item; publicRolls: boolean }) {
  const sheet = readSheet(item);
  const v = readVitals(item);
  return (
    <div className="section">
      <h2>Selezionato</h2>
      <div className="hp-line">
        <b className="grow">{item.name}</b>
        {v.maxHp > 0 && (
          <span>
            ❤️ {v.hp}/{v.maxHp}
            {v.tempHp ? ` +${v.tempHp}` : ""} · 🛡 {v.ac}
          </span>
        )}
      </div>
      {v.maxHp > 0 && <QuickHp item={item} />}
      {sheet?.tipo === "mostro" && <StatBlock m={sheet} item={item} publicRolls={publicRolls} />}
      {sheet?.tipo === "pg" && (
        <p className="muted">
          {sheet.specie} · {sheet.classi.map((c) => `${c.classe} ${c.livello}`).join(" / ")} · Perc. passiva{" "}
          {passivePerception(sheet)} · TS {ABILITIES.map((a) => `${ABILITY_SHORT[a]} ${fmtMod(saveBonus(sheet, a))}`).join(" ")}
        </p>
      )}
      {!sheet && <p className="muted">Nessuna scheda collegata.</p>}
    </div>
  );
}

function QuickHp({ item }: { item: Item }) {
  const [n, setN] = useState("");
  const val = parseInt(n, 10);
  const ok = val > 0;
  const go = async (heal: boolean) => {
    if (!ok) return;
    try {
      await mutate(item.id, (cur) => ({ v: heal ? applyHeal(cur, val) : applyDamage(cur, val) }));
      setN("");
    } catch (e) {
      await OBR.notification.show(String(e), "ERROR");
    }
  };
  return (
    <div className="hp-input small-hp">
      <input inputMode="numeric" placeholder="PF" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} />
      <button className="dmg" disabled={!ok} onClick={() => go(false)}>
        Danno
      </button>
      <button className="heal" disabled={!ok} onClick={() => go(true)}>
        Cura
      </button>
    </div>
  );
}

export function StatBlock({ m, item, publicRolls }: { m: Monster; item: Item; publicRolls: boolean }) {
  const r = (label: string, expr: string) => rollAndShare(item.name, label, expr, "normale", { secret: !publicRolls });
  const line = (k: string, v?: string) => (v ? (
    <p className="sb-line">
      <b>{k}</b> {v}
    </p>
  ) : null);
  return (
    <div className="statblock">
      <p className="muted small">
        {[m.taglia, m.tipoCreatura, m.allineamento].filter(Boolean).join(", ")}
        {m.nomeOriginale && m.nomeOriginale !== m.nome ? ` · ${m.nomeOriginale}` : ""}
        {m.fonte ? ` · ${m.fonte}` : ""}
      </p>
      {line("CA", `${m.ca}${m.caNote ? ` (${m.caNote})` : ""}`)}
      {line("PF", `${m.pf}${m.pfFormula ? ` (${m.pfFormula})` : ""}`)}
      {line("Velocità", m.velocita)}
      <div className="sb-abil">
        {ABILITIES.map((a) => (
          <button key={a} className="rollable" onClick={() => r(`Prova ${ABILITY_SHORT[a]}`, d20(mod(m.caratteristiche[a])))}>
            <span>{ABILITY_SHORT[a]}</span>
            <b>{m.caratteristiche[a]}</b>
            <span>{fmtMod(mod(m.caratteristiche[a]))}</span>
          </button>
        ))}
      </div>
      {line("Tiri salvezza", m.ts)}
      {line("Abilità", m.abilita)}
      {line("Vulnerabilità", m.vulnerabilita)}
      {line("Resistenze", m.resistenze)}
      {line("Immunità", [m.immunita, m.immunitaCondizioni].filter(Boolean).join("; "))}
      {line("Sensi", m.sensi)}
      {line("Linguaggi", m.linguaggi)}
      {line("GS", m.gs)}
      {m.sezioni.map((s) => (
        <div key={s.titolo}>
          <h3 className="sb-title">{s.titolo}</h3>
          {s.voci.map((v, i) => (
            <p key={i} className="sb-entry">
              {v.nome && <b>{v.nome}. </b>}
              <RollableText text={v.testo} onRoll={(label, expr) => r(`${v.nome || s.titolo}${label}`, expr)} />
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Rende cliccabili i numeri dei blocchi statistiche:
 * "Attack Roll: +4" / "Tiro per Colpire: +4" → d20+4; "(1d6 + 2)" → danni.
 */
export function RollableText({ text, onRoll }: { text: string; onRoll: (label: string, expr: string) => void }) {
  const re = /((?:Attack Roll|Tiro per colpire(?: in mischia o a distanza| in mischia| a distanza)?|to hit)\s*:?\s*)([+−-]\d+)|\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)/gi;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    if (m[2]) {
      const n = parseInt(m[2].replace("−", "-"), 10);
      out.push(m[1]);
      out.push(
        <button key={k++} className="inline-roll" onClick={() => onRoll(" (colpire)", d20(n))}>
          {m[2]}
        </button>,
      );
    } else if (m[3]) {
      const expr = m[3].replace(/\s+/g, "").replace("−", "-");
      out.push(
        <button key={k++} className="inline-roll" onClick={() => onRoll(" (danni)", expr)}>
          ({m[3]})
        </button>,
      );
    }
    last = m.index + m[0].length;
  }
  out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
