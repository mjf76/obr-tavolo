import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR, { type Vector2 } from "@owlbear-rodeo/sdk";
import { isCharacter, tokensOf } from "../shared/assignment";
import { useGrid, useItems, useMe, useObrReady, useSceneReady } from "../shared/hooks";
import { IDS } from "../shared/keys";
import { crossesWall, formatDistance, nextDiagonalCost, pathCost, snapToGrid, type Dir, type Step } from "../shared/movement";
import { getWalls } from "../shared/walls";
import { readPg, readSheet } from "../sheet/store";
import type { Sheet } from "../sheet/types";

/** Velocità a piedi del mostro in piedi, da testi come "9 m" o "30 ft., Fly 60 ft.". */
function monsterSpeedFt(s: Sheet | undefined): number | undefined {
  if (s?.tipo !== "mostro" || !s.velocita) return undefined;
  const m = s.velocita.match(/([\d.,]+)\s*(m|ft)/i);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(",", "."));
  return m[2].toLowerCase() === "m" ? Math.round(n / 0.3) : n;
}

interface HistoryEntry {
  step: Step;
  from: Vector2;
}

const PAD: { dx: Dir; dy: Dir; label: string }[] = [
  { dx: -1, dy: -1, label: "↖" },
  { dx: 0, dy: -1, label: "↑" },
  { dx: 1, dy: -1, label: "↗" },
  { dx: -1, dy: 0, label: "←" },
  { dx: 0, dy: 0, label: "Azzera" },
  { dx: 1, dy: 0, label: "→" },
  { dx: -1, dy: 1, label: "↙" },
  { dx: 0, dy: 1, label: "↓" },
  { dx: 1, dy: 1, label: "↘" },
];

const KEYMAP: Record<string, [Dir, Dir]> = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  "8": [0, -1], "2": [0, 1], "4": [-1, 0], "6": [1, 0], "7": [-1, -1], "9": [1, -1], "1": [-1, 1], "3": [1, 1],
};

/** Percorsi della sessione: restano anche chiudendo e riaprendo il pannello. */
const pathStore: Record<string, HistoryEntry[]> = {};

/** Pagina autonoma (controller.html): chiude il modal OBR. */
export function Controller() {
  return <MovePanel onClose={() => OBR.modal.close(IDS.modalController)} />;
}

/** Pulsantiera di movimento: usabile da sola o dentro l'app del giocatore. */
export function MovePanel({ onClose, itemId }: { onClose: () => void; itemId?: string }) {
  const ready = useObrReady();
  const me = useMe(ready);
  const sceneReady = useSceneReady(ready);
  const grid = useGrid(sceneReady);
  const characters = useItems(sceneReady, isCharacter);
  const initial = itemId ?? new URLSearchParams(window.location.search).get("item");
  // Il master può muovere qualsiasi token (mostri compresi); il giocatore solo i propri.
  const mine = useMemo(
    () => (!me ? [] : me.role === "GM" ? characters.filter((c) => c.id === initial) : tokensOf(characters, me)),
    [characters, me, initial],
  );
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  const item = mine.find((i) => i.id === selectedId) ?? mine[0];

  const [histories, setHistoriesState] = useState<Record<string, HistoryEntry[]>>(() => ({ ...pathStore }));
  const setHistories = (fn: (h: Record<string, HistoryEntry[]>) => Record<string, HistoryEntry[]>) =>
    setHistoriesState((h) => {
      const next = fn(h);
      Object.assign(pathStore, next);
      return next;
    });
  const history = item ? histories[item.id] ?? [] : [];
  const steps = history.map((h) => h.step);

  // Velocità dalla scheda (default 30 ft = 6 caselle): la vista mostra quel raggio attorno al token.
  const pg = readPg(item);
  const speedFt = pg?.velocita.camminare ?? monsterSpeedFt(readSheet(item)) ?? 30;
  // piedi per casella secondo la scala della griglia (5 ft o 1,5 m)
  const unit = grid?.scale.unit.trim().toLowerCase();
  const ftPerCell = grid ? (unit === "m" ? grid.scale.multiplier / 0.3 : unit === "ft" ? grid.scale.multiplier : 5) : 5;
  const radius = Math.max(3, Math.round(speedFt / ftPerCell));
  const radiusRef = useRef(radius);
  radiusRef.current = radius;
  const dpiRef = useRef(150);
  dpiRef.current = grid?.dpi ?? 150;
  const sheetRef = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const posRef = useRef<Vector2 | null>(null);
  useEffect(() => {
    posRef.current = item ? { ...item.position } : null;
  }, [item?.id, item?.position.x, item?.position.y]);

  /**
   * Centra il token nella parte di mappa visibile sopra il pannello e regola lo zoom
   * perché si vedano `radius` caselle in ogni direzione.
   */
  const centerOn = useCallback(async (p: Vector2) => {
    const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
    const covered = sheetRef.current?.getBoundingClientRect().height ?? 0;
    const visibleH = Math.max(h - covered, h * 0.3);
    const cells = 2 * radiusRef.current + 1;
    const scale = Math.min(w, visibleH) / (cells * dpiRef.current);
    await OBR.viewport.animateTo({ position: { x: w / 2 - p.x * scale, y: visibleH / 2 - p.y * scale }, scale });
  }, []);

  // all'apertura (e al cambio di personaggio) la vista va subito sul token
  const centeredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!item || !grid || centeredFor.current === item.id) return;
    centeredFor.current = item.id;
    const t = setTimeout(() => void centerOn(item.position), 60);
    return () => clearTimeout(t);
  }, [item, grid, centerOn]);

  const move = useCallback(
    (dx: Dir, dy: Dir) => {
      if (!item || !grid) return;
      const id = item.id;
      const dpi = grid.dpi;
      queue.current = queue.current.then(async () => {
        const raw = posRef.current;
        if (!raw) return;
        // taglia in caselle (1 = Media/Piccola, 2 = Grande…) per riallineare il centro alla griglia
        const b = await OBR.scene.items.getItemBounds([id]).catch(() => null);
        const size = b ? Math.max(1, Math.round(Math.min(b.width, b.height) / dpi)) : 1;
        const from = snapToGrid(raw, dpi, size);
        const misaligned = Math.abs(from.x - raw.x) > 0.5 || Math.abs(from.y - raw.y) > 0.5;
        const to = { x: from.x + dx * dpi, y: from.y + dy * dpi };
        if (crossesWall(from, to, await getWalls())) {
          // muro o porta chiusa: non si muove (e, se era storto, torna al centro della casella)
          if (misaligned) {
            await OBR.scene.items.updateItems([id], (items) => {
              for (const i of items) i.position = from;
            });
            posRef.current = from;
          }
          navigator.vibrate?.([30, 40, 30]);
          await OBR.notification.show("Di lì non si passa: muro o porta chiusa", "WARNING");
          return;
        }
        try {
          await OBR.scene.items.updateItems([id], (items) => {
            for (const i of items) i.position = to;
          });
          const [after] = await OBR.scene.items.getItems([id]);
          if (!after || after.position.x !== to.x || after.position.y !== to.y) {
            const unchanged = after && Math.abs(after.position.x - raw.x) < 0.5 && Math.abs(after.position.y - raw.y) < 0.5;
            if (after && !unchanged) {
              // respinto da un muro che non passa sul bordo della casella: torna al centro di partenza
              await OBR.scene.items.updateItems([id], (items) => {
                for (const i of items) i.position = from;
              });
              posRef.current = from;
              navigator.vibrate?.([30, 40, 30]);
              await OBR.notification.show("Di lì non si passa: muro o porta chiusa", "WARNING");
            } else {
              await OBR.notification.show("Movimento non consentito: chiedi al master i permessi", "WARNING");
            }
            return;
          }
          posRef.current = to;
          setHistories((h) => ({ ...h, [id]: [...(h[id] ?? []), { step: { dx, dy }, from }] }));
          navigator.vibrate?.(12);
          await centerOn(to);
        } catch (e) {
          await OBR.notification.show(`Errore nel movimento: ${String(e)}`, "ERROR");
        }
      });
    },
    [item, grid, centerOn],
  );

  const undo = () => {
    if (!item || history.length === 0) return;
    const id = item.id;
    const last = history[history.length - 1];
    queue.current = queue.current.then(async () => {
      await OBR.scene.items.updateItems([id], (items) => {
        for (const i of items) i.position = last.from;
      });
      posRef.current = last.from;
      setHistories((h) => ({ ...h, [id]: (h[id] ?? []).slice(0, -1) }));
      await centerOn(last.from);
    });
  };

  const reset = () => item && setHistories((h) => ({ ...h, [item.id]: [] }));
  const close = onClose;

  // tastiera (utile per provare da PC)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const d = KEYMAP[ev.key];
      if (d) {
        ev.preventDefault();
        move(d[0], d[1]);
      } else if (ev.key === "Backspace") undo();
      else if (ev.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!ready || !me) return null;

  const body = (() => {
    if (!sceneReady) return <p className="muted">Nessuna scena aperta.</p>;
    if (!item) return <p className="muted">Nessun personaggio assegnato a “{me.name}”.</p>;
    if (!grid) return <p className="muted">Caricamento griglia…</p>;
    if (grid.type !== "SQUARE") return <p className="muted">Per ora è supportata solo la griglia quadrata.</p>;
    const used = pathCost(steps, grid.measurement);
    const over = used * ftPerCell > speedFt + 0.01;
    return (
      <>
        {mine.length > 1 && (
          <div className="chips">
            {mine.map((i) => (
              <button key={i.id} className={i.id === item.id ? "on" : ""} onClick={() => setSelectedId(i.id)}>
                {i.name}
              </button>
            ))}
          </div>
        )}
        <div className="ctrl-body">
          <div className="dpad">
            {PAD.map((b) =>
              b.dx === 0 && b.dy === 0 ? (
                <button key="c" className="center" onClick={reset} disabled={history.length === 0}>
                  {b.label}
                </button>
              ) : (
                <button key={b.label} onClick={() => move(b.dx, b.dy)} aria-label={`muovi ${b.label}`}>
                  {b.label}
                </button>
              ),
            )}
          </div>
          <div className="ctrl-side">
            <div className={`meter-mini ${over ? "over" : ""}`}>
              <div className="big">{formatDistance(used, grid.scale)}</div>
              <div className="muted small">
                su {speedFt} ft · diagonale succ.:{" "}
                {formatDistance(nextDiagonalCost(steps, grid.measurement), grid.scale).split(" · ")[0]}
              </div>
            </div>
            <button onClick={undo} disabled={history.length === 0}>
              ↶ Annulla passo
            </button>
          </div>
        </div>
      </>
    );
  })();

  return (
    <div className="ctrl">
      <div className="ctrl-sheet compact" ref={sheetRef}>
        <div className="ctrl-head">
          <div className="name">🧭 {item?.name ?? "Movimento"}</div>
          <button className="icon" onClick={close} aria-label="chiudi">
            ✕
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
