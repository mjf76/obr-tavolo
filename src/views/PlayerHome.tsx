import OBR from "@owlbear-rodeo/sdk";
import { isCharacter, tokensOf } from "../shared/assignment";
import { itemImage, useItems, useRoomPermissions, useSceneReady, type Me } from "../shared/hooks";
import { IDS, pageUrl } from "../shared/keys";

export async function openController(itemId?: string) {
  await OBR.modal.open({
    id: IDS.modalController,
    url: pageUrl("controller.html", itemId ? { item: itemId } : undefined),
    fullScreen: true,
    hidePaper: true,
    hideBackdrop: true,
  });
  await OBR.action.close();
}

export async function openPlayerApp() {
  await OBR.modal.open({
    id: IDS.modalPlayer,
    url: pageUrl("player.html"),
    fullScreen: true,
    hidePaper: true,
    hideBackdrop: true,
  });
  await OBR.action.close();
}

export function PlayerHome({ me }: { me: Me }) {
  const sceneReady = useSceneReady(true);
  const characters = useItems(sceneReady, isCharacter);
  const perms = useRoomPermissions(true);
  const mine = tokensOf(characters, me);
  const canUpdate = perms.includes("CHARACTER_UPDATE");
  const ownerOnly = perms.includes("CHARACTER_OWNER_ONLY");

  if (!sceneReady) {
    return (
      <div className="section">
        <p>Ciao {me.name}!</p>
        <p className="muted">Il master non ha ancora aperto una scena.</p>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <h2>Il tuo personaggio</h2>
        {mine.length === 0 && (
          <p className="muted">
            Nessun personaggio assegnato a “{me.name}”. Chiedi al master di assegnartelo.
          </p>
        )}
        {mine.map((item) => {
          const blocked = ownerOnly && item.createdUserId !== me.id;
          return (
            <div className="row" key={item.id}>
              {itemImage(item) ? <img className="thumb" src={itemImage(item)} alt="" /> : <span className="thumb" />}
              <div className="grow">
                <div className="name">{item.name}</div>
                {blocked && <div className="muted">Il master deve renderti proprietario</div>}
              </div>
            </div>
          );
        })}
        {mine.length > 0 && (
          <button className="primary block" style={{ marginTop: 10 }} onClick={() => openPlayerApp()}>
            Apri il mio personaggio
          </button>
        )}
      </div>
      {!canUpdate && (
        <div className="notice err">Il master non ha ancora permesso ai giocatori di muovere i personaggi.</div>
      )}
    </>
  );
}
