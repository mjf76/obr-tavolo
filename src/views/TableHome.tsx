import { fitWholeMap } from "../shared/tv";

export function TableHome() {
  return (
    <div className="section">
      <h2>Schermo del tavolo</h2>
      <p>La vista inquadra sempre tutta la mappa della scena e si riadatta quando il master cambia mappa.</p>
      <button className="primary block" onClick={() => fitWholeMap()}>
        📺 Inquadra la mappa ora
      </button>
      <p className="muted" style={{ marginTop: 8 }}>
        Se hai appena scelto “Schermo TV” in questo dispositivo, ricarica la pagina di Owlbear per attivare l'inquadratura
        automatica.
      </p>
    </div>
  );
}
