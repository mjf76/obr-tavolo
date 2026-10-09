import OBR, { type Item, type Player } from "@owlbear-rodeo/sdk";
import { assign, getLink, isCharacter, transferOwnership, tokensOf } from "../shared/assignment";
import { isTableName } from "../shared/device";
import {
  itemImage,
  useGrid,
  useItems,
  useParty,
  useRoomPermissions,
  useSceneReady,
} from "../shared/hooks";
import { MEASUREMENT_LABEL } from "../shared/movement";
import { useEffect, useState } from "react";
import { loadLibrary, type Library } from "../sheet/library";
import { readSheet } from "../sheet/store";
import { readVitals } from "../shared/vitals";
import { PgSelect, SheetsSection } from "./gm/SheetsSection";
import { SelectedCard } from "./gm/StatBlock";
import { askTvFit } from "../shared/tv";
import { useCombat } from "../shared/combat";
import { EncounterTab } from "./gm/EncounterTab";
import { loadProtectHidden, saveProtectHidden, setFocus, useFocus } from "../shared/focus";

export function GmHome() {
  const sceneReady = useSceneReady(true);
  const grid = useGrid(sceneReady);
  const characters = useItems(sceneReady, isCharacter);
  const party = useParty(true);
  const perms = useRoomPermissions(true);

  const players = party.filter((p) => p.role === "PLAYER" && !isTableName(p.name));
  const table = party.find((p) => isTableName(p.name));
  const canUpdate = perms.includes("CHARACTER_UPDATE");
  const ownerOnly = perms.includes("CHARACTER_OWNER_ONLY");

  const [tab, setTab] = useState<"partita" | "incontro" | "prep">("partita");
  const combat = useCombat(sceneReady);
  const [lib, setLib] = useState<Library>({ pg: [], mostri: [] });
  useEffect(() => {
    loadLibrary().then(setLib);
  }, []);
  const selection = useFocus(sceneReady, characters);
  const [publicRolls, setPublicRolls] = useState(false);

  return (
    <>
      <div className="seg">
        <button className={tab === "partita" ? "on" : ""} onClick={() => setTab("partita")}>
          🎲 Partita
        </button>
        <button className={tab === "incontro" ? "on" : ""} onClick={() => setTab("incontro")}>
          ⚔️ Incontro{combat.active ? " •" : ""}
        </button>
        <button className={tab === "prep" ? "on" : ""} onClick={() => setTab("prep")}>
          🛠 Prep.
        </button>
      </div>

      {tab === "partita" && (
        <>
          {selection.length === 1 && <SelectedCard item={selection[0]} publicRolls={publicRolls} />}
          {selection.length === 1 && readSheet(selection[0])?.tipo === "mostro" && (
            <label className="muted toggle">
              <input type="checkbox" checked={publicRolls} onChange={(e) => setPublicRolls(e.target.checked)} /> Tiri dei
              mostri visibili anche sul TV
            </label>
          )}
          {selection.length !== 1 && <p className="muted">Tocca un token (sulla mappa o nell'elenco) per vederne scheda e PF.</p>}
          {table && (
            <button className="small" onClick={() => askTvFit()}>
              📺 Reinquadra la mappa sul TV
            </button>
          )}
          <CombatList characters={characters} />
        </>
      )}

      {tab === "incontro" && <EncounterTab characters={characters} combat={combat} />}

      {tab === "prep" && (
      <>
      <SheetsSection lib={lib} setLib={setLib} characters={characters} selection={selection} />
      <ProtectToggle />
      {/* ---- Scena e griglia ---- */}
      <div className="section">
        <h2>Scena</h2>
        {!sceneReady && <p className="muted">Nessuna scena aperta.</p>}
        {grid && (
          <>
            <p>
              Griglia: <b>{MEASUREMENT_LABEL[grid.measurement]}</b> · 1 casella = {grid.scale.multiplier}{" "}
              {grid.scale.unit}
            </p>
            {grid.measurement !== "ALTERNATING" && (
              <div className="notice">
                Il movimento 5.5 al tavolo usa 5-10-5.{" "}
                <button className="small" onClick={() => OBR.scene.grid.setMeasurement("ALTERNATING")}>
                  Imposta 5-10-5
                </button>
              </div>
            )}
            {grid.type !== "SQUARE" && <div className="notice">Il controller per ora supporta solo griglie quadrate.</div>}
          </>
        )}
      </div>

      {/* ---- Permessi ---- */}
      <div className="section">
        <h2>Permessi giocatori</h2>
        {canUpdate ? (
          <div className={`notice ${ownerOnly ? "" : "ok"}`}>
            {ownerOnly
              ? "I giocatori muovono solo i personaggi di cui sono proprietari: usa “Rendi proprietario” su ogni PG."
              : "I giocatori possono muovere i personaggi. Il controller mostra a ciascuno solo il proprio."}
          </div>
        ) : (
          <div className="notice err">
            I giocatori non possono muovere i personaggi. In Owlbear: menu stanza → Permissions → Character → Update.
          </div>
        )}
      </div>

      {/* ---- Personaggi ---- */}
      <div className="section">
        <h2>Personaggi nella scena ({characters.length})</h2>
        {sceneReady && characters.length === 0 && <p className="muted">Nessun token nel livello Character.</p>}
        {characters.map((item) => (
          <CharacterRow key={item.id} item={item} players={players} ownerOnly={ownerOnly} lib={lib} />
        ))}
        <p className="muted" style={{ marginTop: 6 }}>
          Puoi assegnare anche dal menu del token (tasto destro / tocco prolungato).
        </p>
      </div>

      {/* ---- Giocatori ---- */}
      <div className="section">
        <h2>Connessi</h2>
        {party.length === 0 && <p className="muted">Nessun altro connesso.</p>}
        {players.map((p) => {
          const pcs = tokensOf(characters, p);
          return (
            <div className="row" key={p.connectionId}>
              <span className="dot" style={{ background: p.color }} />
              <div className="grow">
                <div className="name">{p.name}</div>
                <div className="muted">{pcs.length ? pcs.map((i) => i.name).join(", ") : "nessun PG"}</div>
              </div>
            </div>
          );
        })}
        {table && (
          <div className="row">
            <span className="dot" style={{ background: table.color }} />
            <div className="grow name">{table.name}</div>
            <span className="badge tavolo">{table.role === "GM" ? "⚠ è GM!" : "schermo"}</span>
          </div>
        )}
        {table?.role === "GM" && (
          <div className="notice err">Lo schermo del tavolo è collegato come GM: mostrerà ciò che la nebbia nasconde.</div>
        )}
      </div>
      </>
      )}
    </>
  );
}

/** Elenco rapido in partita: PF di tutti i personaggi della scena. */
function CombatList({ characters }: { characters: Item[] }) {
  if (!characters.length) return null;
  return (
    <div className="section">
      <h2>In scena</h2>
      {characters.map((c) => {
        const v = readVitals(c);
        const sh = readSheet(c);
        const pct = v.maxHp ? v.hp / v.maxHp : 1;
        return (
          <div className="row" key={c.id} onClick={() => setFocus([c.id])} style={{ cursor: "pointer" }}>
            {itemImage(c) ? <img className="thumb" src={itemImage(c)} alt="" /> : <span className="thumb" />}
            <div className="grow">
              <div className="name">
                {sh?.tipo === "mostro" ? "👹 " : getLink(c) ? "🧙 " : ""}
                {c.name}
              </div>
              {v.maxHp > 0 && (
                <div className="hpbar">
                  <i style={{ width: `${Math.max(0, pct) * 100}%` }} className={v.hp === 0 ? "down" : pct <= 0.5 ? "bloodied" : ""} />
                </div>
              )}
            </div>
            {v.maxHp > 0 && (
              <span className="num">
                {v.hp}/{v.maxHp} · 🛡{v.ac}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CharacterRow({ item, players, ownerOnly, lib }: { item: Item; players: Player[]; ownerOnly: boolean; lib: Library }) {
  const link = getLink(item);
  const online = link ? players.find((p) => p.id === link.playerId) : undefined;
  const owned = link ? item.createdUserId === link.playerId : false;
  const img = itemImage(item);

  const onSelect = async (value: string) => {
    if (value === "") return assign([item.id], null);
    const p = players.find((x) => x.id === value);
    if (p) await assign([item.id], p);
  };

  const makeOwner = async () => {
    if (!link) return;
    try {
      const ok = await transferOwnership(item.id, link.playerId);
      await OBR.notification.show(
        ok ? `${link.playerName} ora è proprietario di ${item.name}` : "Owlbear non ha accettato il cambio di proprietario",
        ok ? "SUCCESS" : "WARNING",
      );
    } catch (e) {
      await OBR.notification.show(`Errore: ${String(e)}`, "ERROR");
    }
  };

  return (
    <div className="row">
      {img ? <img className="thumb" src={img} alt="" /> : <span className="thumb" />}
      <div className="grow">
        <div className="name">{item.name || "(senza nome)"}</div>
        {link && (
          <div className="muted">
            {link.playerName} {online ? "· connesso" : "· non connesso"}
            {owned && <span className="badge ok" style={{ marginLeft: 6 }}>proprietario</span>}
          </div>
        )}
        {link && <PgSelect item={item} lib={lib} />}
        {!link && readSheet(item)?.tipo === "mostro" && <div className="muted">👹 {readSheet(item)!.nome}</div>}
        {link && ownerOnly && !owned && (
          <button className="small" style={{ marginTop: 4 }} disabled={!online} onClick={makeOwner}>
            Rendi proprietario
          </button>
        )}
      </div>
      <select value={online?.id ?? (link ? "offline" : "")} onChange={(e) => onSelect(e.target.value)}>
        <option value="">— nessuno —</option>
        {link && !online && <option value="offline">{link.playerName} (offline)</option>}
        {players.map((p) => (
          <option key={p.connectionId} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function ProtectToggle() {
  const [on, setOn] = useState(loadProtectHidden);
  return (
    <div className="section">
      <h2>Token nascosti</h2>
      <label className="toggle">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            saveProtectHidden(e.target.checked);
            setOn(e.target.checked);
          }}
        />
        Quando selezioni un token nascosto, annulla subito la selezione
      </label>
      <p className="muted small">
        I giocatori vedono le selezioni del master (etichetta “GM”) anche sui token nascosti. Con questa opzione il token
        resta in primo piano nel pannello; per spostarlo usa 🧭 Muovi.
      </p>
    </div>
  );
}
