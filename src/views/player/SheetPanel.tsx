import { useState } from "react";
import type { Item } from "@owlbear-rodeo/sdk";
import { readPg } from "../../sheet/store";
import { AbilityGrid, AttackList, Features, Inventory, ModeBar, SheetHeader, SkillList, SpellSection } from "../sheet/parts";
import { Popup } from "./PlayerApp";

type Tab = "principale" | "abilita" | "azioni" | "incantesimi" | "inventario" | "privilegi";
const TABS: [Tab, string][] = [
  ["principale", "Principale"],
  ["abilita", "Abilità"],
  ["azioni", "Azioni"],
  ["incantesimi", "Incantesimi"],
  ["inventario", "Inventario"],
  ["privilegi", "Privilegi"],
];

/** Scheda completa in stile D&D Beyond: tocca un valore per tirare. */
export function SheetPanel({ item, onClose }: { item: Item; onClose: () => void }) {
  const sheet = readPg(item);
  const [tab, setTab] = useState<Tab>("principale");

  if (!sheet) {
    return (
      <Popup title={`Scheda · ${item.name}`} onClose={onClose}>
        <NoSheet />
      </Popup>
    );
  }

  return (
    <Popup title={sheet.nome} onClose={onClose}>
      <div className="tabs">
        {TABS.filter(([t]) => t !== "incantesimi" || sheet.incantesimi).map(([t, l]) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      <div className="stack">
        {(tab === "principale" || tab === "abilita" || tab === "azioni" || tab === "incantesimi") && <ModeBar />}
        {tab === "principale" && (
          <>
            <SheetHeader />
            <AbilityGrid />
          </>
        )}
        {tab === "abilita" && <SkillList />}
        {tab === "azioni" && <AttackList />}
        {tab === "incantesimi" && <SpellSection />}
        {tab === "inventario" && <Inventory />}
        {tab === "privilegi" && <Features />}
      </div>
    </Popup>
  );
}

export function NoSheet() {
  return (
    <div className="card placeholder">
      <p>Nessuna scheda collegata a questo personaggio.</p>
      <p className="muted">Il master la importa dal suo pannello (file JSON) e la collega al token.</p>
    </div>
  );
}
