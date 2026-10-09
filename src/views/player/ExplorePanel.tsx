import { useState } from "react";
import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { readState, readVitals, writeState, writeVitals } from "../../shared/vitals";
import { Popup } from "./PlayerApp";

export function ExplorePanel({ item, onClose }: { item: Item; onClose: () => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const v = readVitals(item);
  const s = readState(item);

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

  /** Riposo lungo 5.5: tutti i PF, indebolimento −1 (slot e risorse arriveranno con la scheda). */
  const longRest = async () => {
    await writeVitals(item.id, { ...v, hp: v.maxHp, tempHp: 0 });
    await writeState(item.id, { ...s, exhaustion: Math.max(0, s.exhaustion - 1), concentration: null, deathSaves: { ok: 0, ko: 0 } });
  };
  const clearConditions = () => writeState(item.id, { ...s, conditions: [], concentration: null });

  return (
    <Popup title="Esplorazione" onClose={onClose}>
      <div className="stack">
        <ActionCard
          icon="🏕️"
          title="Riposo lungo"
          text="Recuperi tutti i PF, perdi i PF temporanei, Indebolimento −1."
          button={confirm === "long" ? "Confermi?" : "Riposa"}
          hot={confirm === "long"}
          onClick={() => run("long", longRest, `${item.name}: riposo lungo completato`)}
        />
        <ActionCard
          icon="🧹"
          title="Pulisci condizioni"
          text="Rimuove tutte le condizioni e la concentrazione (l'Indebolimento resta)."
          button={confirm === "clear" ? "Confermi?" : "Pulisci"}
          hot={confirm === "clear"}
          disabled={s.conditions.length === 0 && !s.concentration}
          onClick={() => run("clear", clearConditions, "Condizioni rimosse")}
        />
        <ActionCard icon="☕" title="Riposo breve" text="Spendi Dadi Vita per recuperare PF e ricarica i privilegi a riposo breve." soon />
        <ActionCard icon="📖" title="Incantesimi rituali" text="Lancia come rituale gli incantesimi che lo consentono, senza slot." soon />
        <ActionCard icon="🎲" title="Prove e tiri salvezza" text="Prove di abilità e tiri salvezza, anche su richiesta del master." soon />
      </div>
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
  soon?: boolean;
}) {
  return (
    <div className={`card action-card ${p.soon ? "placeholder" : ""}`}>
      <span className="action-icon">{p.icon}</span>
      <div className="grow">
        <b>{p.title}</b>
        <div className="muted">{p.text}</div>
      </div>
      {p.soon ? (
        <span className="badge">presto</span>
      ) : (
        <button className={p.hot ? "primary" : ""} onClick={p.onClick} disabled={p.disabled}>
          {p.button}
        </button>
      )}
    </div>
  );
}
