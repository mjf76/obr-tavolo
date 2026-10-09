import { useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { readPg } from "../../sheet/store";
import { mutate, readState } from "../../shared/vitals";
import { AbilityGrid, HitDice, longRestState, ModeBar, shortRestState, SkillList, SpellSection } from "../sheet/parts";
import { Popup } from "./PlayerApp";
import { LUCI } from "../../shared/vision";

type View = "menu" | "breve" | "prove" | "rituali";

export function ExplorePanel({ item, onClose }: { item: Item; onClose: () => void }) {
  const sheet = readPg(item);
  const s = readState(item);
  const [view, setView] = useState<View>("menu");
  const [confirm, setConfirm] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<void>, msg: string) => {
    if (confirm !== key) return setConfirm(key); // primo tocco: chiede conferma
    setConfirm(null);
    try {
      await fn();
      await OBR.notification.show(msg, "SUCCESS");
    } catch (e) {
      await OBR.notification.show(`Non riuscito: ${String(e)}`, "ERROR");
    }
  };

  /** Riposo lungo 5.5: tutti i PF e tutti i Dadi Vita, slot e risorse, Indebolimento −1. */
  const longRest = () =>
    mutate(item.id, (v, st) => ({
      v: { ...v, hp: v.maxHp, tempHp: 0 },
      s: sheet ? longRestState(sheet, st) : { ...st, exhaustion: Math.max(0, st.exhaustion - 1), concentration: null, deathSaves: { ok: 0, ko: 0 } },
    }));
  const endShortRest = () => mutate(item.id, (_v, st) => ({ s: sheet ? shortRestState(sheet, st) : st }));
  const clearConditions = () => mutate(item.id, (_v, st) => ({ s: { ...st, conditions: [], concentration: null } }));

  const title = view === "breve" ? "Riposo breve" : view === "prove" ? "Prove e tiri salvezza" : view === "rituali" ? "Incantesimi rituali" : "Esplorazione";
  const back = view !== "menu" ? (
    <button className="small" onClick={() => setView("menu")}>
      ‹ Indietro
    </button>
  ) : undefined;

  return (
    <Popup title={title} onClose={onClose} extra={back}>
      {view === "menu" && (
        <div className="stack">
          <ActionCard icon="☕" title="Riposo breve" text="Spendi Dadi Vita per recuperare PF; ricarica i privilegi a riposo breve." button="Apri" onClick={() => setView("breve")} disabled={!sheet} />
          <ActionCard
            icon="🏕️"
            title="Riposo lungo"
            text="Tutti i PF e i Dadi Vita, slot e risorse; perdi i PF temporanei; Indebolimento −1."
            button={confirm === "long" ? "Confermi?" : "Riposa"}
            hot={confirm === "long"}
            onClick={() => run("long", longRest, `${item.name}: riposo lungo completato`)}
          />
          <ActionCard icon="🎲" title="Prove e tiri salvezza" text="Caratteristiche, tiri salvezza e abilità con un tocco." button="Apri" onClick={() => setView("prove")} disabled={!sheet} />
          <ActionCard
            icon="📖"
            title="Incantesimi rituali"
            text="Lancia senza slot gli incantesimi con l'etichetta Rituale (+10 minuti)."
            button="Apri"
            onClick={() => setView("rituali")}
            disabled={!sheet?.incantesimi?.lista.some((x) => x.rituale)}
          />
          <div className="card action-card">
            <span className="action-icon">🔦</span>
            <div className="grow">
              <b>Luce portata</b>
              <div className="muted">Nei luoghi bui decide quanto lontano vedi sulla mappa (insieme alla scurovisione).</div>
              <select
                value={s.luce ?? ""}
                onChange={(e) => mutate(item.id, (_v, st) => ({ s: { ...st, luce: e.target.value } }))}
                style={{ marginTop: 6, width: "100%" }}
              >
                {LUCI.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                    {l.ft ? ` (${Math.round(l.ft * 0.3 * 10) / 10} m)` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ActionCard
            icon="🧹"
            title="Pulisci condizioni"
            text="Rimuove tutte le condizioni e la concentrazione (l'Indebolimento resta)."
            button={confirm === "clear" ? "Confermi?" : "Pulisci"}
            hot={confirm === "clear"}
            disabled={s.conditions.length === 0 && !s.concentration}
            onClick={() => run("clear", clearConditions, "Condizioni rimosse")}
          />
          {!sheet && <p className="muted">Alcune voci si attivano quando il master collega la scheda.</p>}
        </div>
      )}

      {view === "breve" && sheet && (
        <div className="stack">
          <p className="muted">Spendi i Dadi Vita che vuoi (ciascuno: dado + COS, minimo 1 PF), poi termina il riposo.</p>
          <HitDice />
          <button
            className={confirm === "short" ? "primary block" : "block"}
            onClick={() => run("short", endShortRest, `${item.name}: riposo breve completato`)}
          >
            {confirm === "short" ? "Confermi la fine del riposo?" : "Termina riposo breve"}
          </button>
        </div>
      )}

      {view === "prove" && sheet && (
        <div className="stack">
          <ModeBar />
          <AbilityGrid />
          <SkillList />
        </div>
      )}

      {view === "rituali" && sheet && <SpellSection filter={(x) => !!x.rituale} />}
    </Popup>
  );
}

function ActionCard(p: {
  icon: string;
  title: string;
  text: string;
  button?: string;
  onClick?: () => void;
  hot?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="card action-card">
      <span className="action-icon">{p.icon}</span>
      <div className="grow">
        <b>{p.title}</b>
        <div className="muted">{p.text}</div>
      </div>
      <button className={p.hot ? "primary" : ""} onClick={p.onClick} disabled={p.disabled}>
        {p.button}
      </button>
    </div>
  );
}
