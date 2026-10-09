import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBR, { type Vector2 } from "@owlbear-rodeo/sdk";
import { isCharacter, tokensOf } from "../shared/assignment";
import { useGrid, useItems, useMe, useObrReady, useSceneReady } from "../shared/hooks";
import { IDS } from "../shared/keys";
import { formatDistance, nextDiagonalCost, pathCost, type Dir, type Step } from "../shared/movement";

interface HistoryEntry {
  step: Step;
  from: Vector2;
}

const PAD: { dx: Dir; dy: Dir; label: string }[] = [
  { dx: -1, dy: -1, label: "↖" },
  { dx: 0, dy: -1, label: "↑" },
  { dx: 1, dy: -1, label: "↗" },
  { dx: -1, dy: 0, label: "←" },
  { dx: 0, dy: 0, label: "centra" },
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
  const mine = useMemo(() => (me ? tokensOf(characters, me) : []), [characters, me]);

  const initial = itemId ?? new URLSearchParams(window.location.search).get("item");
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  const item = mine.find((i) => i.id === selectedId) ?? mine[0];

  const [histories, setHistories] = useState<Record<string, HistoryEntry[]>>({});
  const history = item ? histories[item.id] ?? [] : [];
  const steps = history.map((h) => h.step);

  const [follow, setFollow] = useState(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const posRef = useRef<Vector2 | null>(null);
  useEffect(() => {
    posRef.current = item ? { ...item.position } : null;
  }, [item?.id, item?.position.x, item?.position.y]);

  /** Centra la vista sul token nella parte di schermo non coperta dal pannello. */
  const centerOn = useCallback(async (p: Vector2) => {
    const [scale, w, h] = await Promise.all([
      OBR.viewport.getScale(),
      OBR.viewport.getWidth(),
      OBR.viewport.getHeight(),
    ]);
    const covered = sheetRef.current?.getBoundingClientRect().height ?? 0;
    const visibleH = Math.max(h - covered, h * 0.3);
    await OBR.viewport.animateTo({ position: { x: w / 2 - p.x * scale, y: visibleH / 2 - p.y * scale }, scale });
  }, []);

  const move = useCallback(
    (dx: Dir, dy: Dir) => {
      if (!item || !grid) return;
      const id = item.id;
      const dpi = grid.dpi;
      queue.current = queue.current.then(async () => {
        const from = posRef.current;
        if (!from) return;
        const to = { x: from.x + dx * dpi, y: from.y + dy * dpi };
        try {
          await OBR.scene.items.updateItems([id], (items) => {
            for (const i of items) i.position = to;
          });
          const [after] = await OBR.scene.items.getItems([id]);
          if (!after || after.position.x !== to.x || after.position.y !== to.y) {
            await OBR.notification.show("Movimento non consentito: chiedi al master i permessi", "WARNING");
            return;
          }
          posRef.current = to;
          setHistories((h) => ({ ...h, [id]: [...(h[id] ?? []), { step: { dx, dy }, from }] }));
          navigator.vibrate?.(12);
          if (follow) await centerOn(to);
        } catch (e) {
          await OBR.notification.show(`Errore nel movimento: ${String(e)}`, "ERROR");
        }
      });
    },
    [item, grid, follow, centerOn],
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
      if (follow) await centerOn(last.from);
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
        <div className="meter">
          <div>
            <div className="muted">Movimento usato</div>
            <div className="big">{formatDistance(used, grid.scale)}</div>
          </div>
          <div className="muted" style={{ textAlign: "right" }}>
            {Math.round(used * 10) / 10} caselle
            <br />
            prossima diagonale: {formatDistance(nextDiagonalCost(steps, grid.measurement), grid.scale).split(" · ")[0]}
          </div>
        </div>
        <div className="dpad">
          {PAD.map((b) =>
            b.dx === 0 && b.dy === 0 ? (
              <button key="c" className="center" onClick={() => posRef.current && centerOn(posRef.current)}>
                {b.label}
              </button>
            ) : (
              <button key={b.label} onClick={() => move(b.dx, b.dy)} aria-label={`muovi ${b.label}`}>
                {b.label}
              </button>
            ),
          )}
        </div>
        <div className="ctrl-actions">
          <button onClick={undo} disabled={history.length === 0}>
            ↶ Annulla
          </button>
          <button onClick={reset} disabled={history.length === 0}>
            Azzera
          </button>
          <button className={follow ? "primary" : ""} onClick={() => setFollow((f) => !f)}>
            Segui {follow ? "on" : "off"}
          </button>
        </div>
      </>
    );
  })();

  return (
    <div className="ctrl">
      <div className="ctrl-sheet" ref={sheetRef}>
        <div className="ctrl-head">
          <div className="name">{item?.name ?? "Controller"}</div>
          <button onClick={close} aria-label="chiudi">
            ✕
          </button>
        </div>
        {body}
      </div>
    </div>
  );
}
