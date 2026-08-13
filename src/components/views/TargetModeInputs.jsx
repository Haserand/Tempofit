import { Clock, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { syncClampedInput } from '../../utils/numberInput';
import { isTargetValueValid, snapDistanceOnBlur } from '../../utils/targetValidation';

/**
 * TargetModeInputs — bloc "Objectif & Allure" (mode distance) OU "Durée de
 * la session" (mode temps), selon `targetMode`.
 *
 * Extrait de GeneratorWizard.jsx (03/08, check-up dette technique — voir
 * PASSATION.md pour le contexte) : ce bloc EXACT (mêmes classes, même
 * markup, au caractère près) était dupliqué MOT POUR MOT à 2 endroits —
 * l'étape 2 (Objectif) où on le choisit la première fois, et l'étape 3
 * (Rythme) où il réapparaît pour affiner l'allure/la durée une fois le BPM
 * réglé. Un correctif futur (ex. un bug de validation sur les minutes,
 * un changement de libellé) n'a désormais qu'UN SEUL endroit à toucher —
 * avant cette extraction, rien ne garantissait que les 2 copies restent
 * synchronisées si l'une des deux était modifiée sans penser à l'autre.
 *
 * `theme` reçu tel quel (comme le fait GeneratorWizard.jsx lui-même),
 * destructuré ici — cohérent avec la convention du reste du projet plutôt
 * que d'exploser les tokens un par un en props séparées.
 *
 * Aucun changement de comportement : purement un copier-coller déplacé
 * dans un composant, pas une réécriture — les 2 call sites dans
 * GeneratorWizard.jsx passent exactement les mêmes valeurs/setters
 * qu'avant.
 */
export default function TargetModeInputs({
  targetMode,
  theme,
  distanceVal, setDistanceVal, distanceUnit, setDistanceUnit,
  paceMin, setPaceMin, paceSec, setPaceSec,
  hours, setHours, minutes, setMinutes,
}) {
  const { textHighlight, textColorClass, textMuted, inputBg, inputBorder } = theme;

  return targetMode === 'distance' ? (
    <div className="space-y-4 mt-8">
      <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
        <MapPin className={textColorClass} size={24} /> <span>Objectif & Allure</span>
      </label>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center pl-4 pr-2 py-4 justify-between`}>
          {/* `min="0.1"` (04/08, retour direct : "je veux que la valeur
              minimale disponible soit 0,1... que l'internaute ne puisse
              jamais mettre 0") — bloque les FLÈCHES natives du spinner sous
              0,1 (`min`/`max` HTML pilotent bien ça, contrairement à la
              saisie clavier — voir numberInput.js). Ne bloque PAS la frappe
              clavier elle-même (taper "0" reste possible, c'est un passage
              obligé pour composer "0.5" au clavier) — `onBlur` ci-dessous
              rattrape ce cas au moment de quitter le champ. Les 3 couches
              cumulées (spinner bloqué + blur qui corrige + bouton
              désactivé, voir targetValidation.js) rendent 0 impossible à
              UTILISER, seulement visible de façon transitoire pendant la
              frappe. */}
          <input
            type="number" min="0.1" step="0.1" value={distanceVal}
            onChange={(e) => setDistanceVal(e.target.value)}
            onBlur={(e) => setDistanceVal(snapDistanceOnBlur(e.target.value))}
            className={`bg-transparent w-full text-2xl font-bold ${textHighlight} outline-hidden`}
          />
          <select value={distanceUnit} onChange={(e)=>setDistanceUnit(e.target.value)} className={`font-bold text-lg ${textMuted} bg-transparent outline-hidden cursor-pointer`}>
            <option value="km">Km</option><option value="mi">Miles</option>
          </select>
        </div>
        <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-4 py-4 justify-between`}>
          <span className={`text-sm font-bold ${textMuted} mr-2`}>Allure:</span>
          <div className="flex items-center">
            <input type="number" min="1" max="15" value={paceMin} onChange={(e) => setPaceMin(syncClampedInput(e, { min: 1, max: 15 }))} className={`bg-transparent w-10 text-2xl font-bold ${textHighlight} outline-hidden text-right`} />
            <span className={`${textHighlight} mx-1 font-bold text-xl`}>:</span>
            <input type="number" min="0" max="59" value={paceSec} onChange={(e) => setPaceSec(syncClampedInput(e, { min: 0, max: 59 }))} className={`bg-transparent w-10 text-2xl font-bold ${textHighlight} outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
            <div className="flex flex-col mr-1">
              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) + 1; return v > 59 ? 0 : v; })} className={`${textMuted} hover:text-main`}>
                <ChevronUp size={12} />
              </button>
              <button type="button" onClick={() => setPaceSec(s => { const v = (parseInt(s) || 0) - 1; return v < 0 ? 59 : v; })} className={`${textMuted} hover:text-main`}>
                <ChevronDown size={12} />
              </button>
            </div>
            <span className={`text-sm font-bold ${textMuted} ml-1`}>/{distanceUnit}</span>
          </div>
        </div>
      </div>
      {/* ⚠️ NOUVEAU (04/08, retour direct — capture d'écran EditRoutineModal.jsx :
          "je ne trouve pas ça normal de pouvoir générer une routine avec une
          valeur de 0 km") : indice visuel en plus du bouton "Suivant"
          désactivé (GeneratorWizard.jsx) — un bouton désactivé seul, sans
          explication visible sans survol, laisse deviner pourquoi. Voir
          targetValidation.js pour le raisonnement complet. */}
      {!isTargetValueValid({ targetMode: 'distance', distanceVal }) && (
        <p className="text-xs font-bold text-red-500">Renseigne une distance supérieure à 0.</p>
      )}
    </div>
  ) : (
    <div className="space-y-4 mt-8">
      <label className={`text-xl font-bold flex items-center space-x-2 ${textHighlight}`}>
        <Clock className={textColorClass} size={24} /> <span>Durée de la session</span>
      </label>
      <div className="flex space-x-4">
        <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-6 py-4`}>
          <input type="number" min="0" max="12" value={hours} onChange={(e) => setHours(syncClampedInput(e, { min: 0, max: 12 }))} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-hidden`} />
          <span className={`font-bold text-lg ${textMuted}`}>Heures</span>
        </div>
        <div className={`flex-1 ${inputBg} border ${inputBorder} rounded-xl flex items-center px-6 py-4`}>
          {/* Flèches personnalisées plutôt que le spinner natif : un input
              number natif s'arrête à 59 (ou 0) au lieu de boucler. */}
          <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(syncClampedInput(e, { min: 0, max: 59 }))} className={`bg-transparent w-full text-3xl font-black ${textHighlight} outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
          <span className={`font-bold text-lg ${textMuted} mr-2`}>Min</span>
          <div className="flex flex-col">
            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) + 1; return v > 59 ? 0 : v; })} className={`p-0.5 rounded-sm ${textMuted} hover:text-main hover:bg-black/5 dark:hover:bg-white/10`}>
              <ChevronUp size={16} />
            </button>
            <button type="button" onClick={() => setMinutes(m => { const v = (parseInt(m) || 0) - 1; return v < 0 ? 59 : v; })} className={`p-0.5 rounded-sm ${textMuted} hover:text-main hover:bg-black/5 dark:hover:bg-white/10`}>
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>
      {!isTargetValueValid({ targetMode: 'time', hours, minutes }) && (
        <p className="text-xs font-bold text-red-500">Renseigne une durée supérieure à 0.</p>
      )}
    </div>
  );
}
