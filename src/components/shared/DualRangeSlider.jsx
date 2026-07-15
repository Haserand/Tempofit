import { useRef } from 'react';

/**
 * DualRangeSlider — curseur à 2 poignées "maison" pour répartir un total de
 * 100% en 3 zones colorées contiguës (utilisé pour la répartition
 * Échauffement/Cœur/Retour au calme du mode Crescendo).
 *
 * Remplace une 1ère implémentation à base de 2 `<input type="range">`
 * superposés (la technique CSS classique du "double thumb") — abandonnée
 * après retour direct : le rendu natif du track/thumb diverge trop selon
 * navigateur/OS (léger décalage entre la position réelle de la poignée et la
 * frontière de couleur visible en dessous, et un curseur texte parasite
 * affiché au niveau des poignées sur certains rendus). Ici, poignées en
 * `<div>` et drag géré à la main via Pointer Events + `setPointerCapture` —
 * plus aucun élément de rendu natif de navigateur dans l'équation, donc plus
 * de divergence possible.
 *
 * Représentation interne : 2 frontières sur un axe 0-100 :
 *   - `boundaryLeft` = fin de la zone gauche = `leftValue`
 *   - `boundaryRight` = début de la zone droite = 100 - `rightValue`
 * `minMiddle` garantit que boundaryRight - boundaryLeft reste toujours ≥
 * `minMiddle`, quoi que l'utilisateur fasse glisser les 2 poignées.
 *
 * `setPointerCapture` route tous les événements pointer suivants vers la
 * poignée qui a été saisie, même si le pointeur sort de sa zone visuelle
 * pendant le drag (doigt qui glisse vite, souris qui dépasse le curseur) —
 * pas besoin d'écouteurs globaux sur `window` ni de nettoyage dans un effet.
 */
export default function DualRangeSlider({
  leftValue, rightValue, minMiddle = 10,
  onChangeLeft, onChangeRight,
  leftColorClass, middleColorClass, rightColorClass,
  leftHandleBorderClass, rightHandleBorderClass,
  leftAriaLabel = 'Poignée gauche', rightAriaLabel = 'Poignée droite',
}) {
  const trackRef = useRef(null);

  const boundaryLeft = leftValue;
  const boundaryRight = 100 - rightValue;

  const pctFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  };

  const startDrag = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMoveLeft = (e) => {
    if (e.buttons !== 1) return;
    const pct = pctFromClientX(e.clientX);
    onChangeLeft(Math.round(Math.max(0, Math.min(pct, boundaryRight - minMiddle))));
  };
  const onMoveRight = (e) => {
    if (e.buttons !== 1) return;
    const pct = pctFromClientX(e.clientX);
    const clamped = Math.max(boundaryLeft + minMiddle, Math.min(pct, 100));
    onChangeRight(Math.round(100 - clamped));
  };

  return (
    <div ref={trackRef} className="relative h-8 flex items-center select-none touch-none">
      <div className="absolute inset-x-0 h-2.5 rounded-full overflow-hidden flex pointer-events-none">
        <div className={`h-full ${leftColorClass}`} style={{ width: `${boundaryLeft}%` }} />
        <div className={`h-full ${middleColorClass}`} style={{ width: `${boundaryRight - boundaryLeft}%` }} />
        <div className={`h-full ${rightColorClass}`} style={{ width: `${100 - boundaryRight}%` }} />
      </div>

      <div
        role="slider" tabIndex={0} aria-label={leftAriaLabel}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={leftValue}
        onPointerDown={startDrag}
        onPointerMove={onMoveLeft}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChangeLeft(Math.max(0, leftValue - 1));
          if (e.key === 'ArrowRight') onChangeLeft(Math.min(boundaryRight - minMiddle, leftValue + 1));
        }}
        className={`absolute w-5 h-5 rounded-full bg-white border-[3px] ${leftHandleBorderClass} shadow-md cursor-grab active:cursor-grabbing touch-none`}
        style={{ left: `${boundaryLeft}%`, transform: 'translateX(-50%)' }}
      />
      <div
        role="slider" tabIndex={0} aria-label={rightAriaLabel}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={rightValue}
        onPointerDown={startDrag}
        onPointerMove={onMoveRight}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onChangeRight(Math.min(100 - boundaryLeft - minMiddle, rightValue + 1));
          if (e.key === 'ArrowRight') onChangeRight(Math.max(0, rightValue - 1));
        }}
        className={`absolute w-5 h-5 rounded-full bg-white border-[3px] ${rightHandleBorderClass} shadow-md cursor-grab active:cursor-grabbing touch-none`}
        style={{ left: `${boundaryRight}%`, transform: 'translateX(-50%)' }}
      />
    </div>
  );
}
