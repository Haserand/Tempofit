import { useEffect, useRef, useState } from 'react';
import { Trash2, Plus, Info, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { ATHLETIC_ZONES, getZoneForValue } from '../../appConfig';
import { syncClampedInput } from '../../utils/numberInput';
import { useGeneratorContext } from '../../contexts/GeneratorContext';

/**
 * AthleticProfilePanel — page "Mon Profil Athlétique" (BPM cibles par zone
 * d'effort, par activité).
 *
 * Extraite de GeneratorView.jsx (25/07, chantier "séparer le générateur en
 * 2 composants" — retour direct : "un intérêt à séparer la génération de
 * base et le profil athlétique ?"). Avant extraction, GeneratorView.jsx
 * faisait 1572 lignes, dont une SEULE ligne (`{showAthleticProfile ? (...)
 * : (...)}`) séparait deux blocs quasi totalement indépendants — vérifié
 * précisément avant de couper (chaque variable locale et chaque champ de
 * useGeneratorContext() croisé par grep entre les deux branches) : AUCUNE
 * variable locale n'était partagée entre Profil Athlétique et le wizard de
 * génération, seul `theme` et quelques champs de contexte génériques
 * (`athleticProfile`, `buildDefaultPreviewProfile`, `setShowAthleticProfile`)
 * sont utilisés des deux côtés — chacun via son PROPRE appel à
 * `useGeneratorContext()`, pas une prop reçue de l'autre.
 *
 * `theme` et `showToast` restent des props explicites (hors du périmètre de
 * GeneratorContext, comme dans GeneratorView.jsx d'origine) — tout le reste
 * du state (activité sélectionnée, brouillon de BPM, etc.) est LOCAL à ce
 * composant, comme il l'était déjà dans GeneratorView.jsx avant l'extraction.
 *
 * `return !isNaughtyMode && (...)` : reprend telle quelle la garde d'origine
 * (Profil Athlétique n'a aucun sens en Mode Intime — voir App.jsx, le filet
 * de sécurité qui referme ce panneau automatiquement au moment de basculer
 * en Mode Intime si jamais on y était déjà).
 */
export default function AthleticProfilePanel({ theme, showToast }) {
  const {
    isNaughtyMode,
    athleticProfile, setBaseBpmForActivity, setZoneForActivity, resetActivityProfile,
    addCustomActivity, removeCustomActivity, setBaseBpmForCustom, setZoneForCustom,
    getDefaultBaseBpm, buildDefaultPreviewProfile, getZoneSpacingForActivity,
    setCadenceIntentForActivity, setCadenceIntentForCustom, isCadenceIntentEligible,
    setShowAthleticProfile,
  } = useGeneratorContext();
  const {
    cardBg, cardBorder, textHighlight, textMuted, textColorClass, bgAccentClass,
    borderAccentClass, inputBg, inputBorder,
  } = theme;

  const [showExpertZones, setShowExpertZones] = useState(false);
  // Retour direct : "je ne vois pas infobulle expliquant le calcul
  // automatique" — l'ancienne infobulle reposait sur l'attribut HTML `title`,
  // qui ne s'affiche qu'au SURVOL — invisible sur un écran tactile (mobile,
  // tablette), qui n'a pas de "survol". Remplacé par un vrai popover cliquable
  // (voir plus bas), qui marche identiquement à la souris ET au doigt.
  const [showZoneCalcInfo, setShowZoneCalcInfo] = useState(false);
  const [selectedProfileActivity, setSelectedProfileActivity] = useState('Course à pied');
  const [showAddCustomActivity, setShowAddCustomActivity] = useState(false);
  const [newCustomActivityName, setNewCustomActivityName] = useState('');

  const isCustomProfileTab = selectedProfileActivity.startsWith('custom-');
  const activeProfile = isCustomProfileTab
    ? (athleticProfile.custom.find(c => c.id === selectedProfileActivity) || null)
    : (athleticProfile.activities[selectedProfileActivity] || null);

  // Profil "aperçu" par défaut (retour direct : "il devrait toujours y avoir
  // un nombre par défaut... pour inciter l'utilisateur à manipuler... des
  // valeurs crédibles par discipline") — calculé UNIQUEMENT pour affichage
  // tant que l'activité n'a jamais été réellement configurée
  // (`activeProfile?.isConfigured`), jamais pour décider quoi que ce soit
  // ailleurs (badges "Profil configuré", pré-remplissage Crescendo...), qui
  // continuent de se fier strictement à `isConfigured`. `getDefaultBaseBpm`
  // n'a pas de valeur spécifique pour une activité personnalisée (aucun moyen
  // de deviner un chiffre par discipline pour un sport inconnu à l'avance) —
  // lui passer une clé bidon retombe proprement sur le repli générique
  // ("Autre") déjà utilisé ailleurs dans l'app.
  const defaultPreviewProfile = buildDefaultPreviewProfile(isCustomProfileTab ? '__custom__' : selectedProfileActivity, activeProfile?.cadenceIntent || 'energy');
  // PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4, cœur à
  // 170 bpm, pas à 160, musique voulue à 180" — 3 nombres indépendants) :
  // ce profil ne prétend plus stocker une cadence physique (PPM/RPM,
  // propre à l'activité) mais directement le BPM MUSICAL cible par zone,
  // décidé par l'utilisateur — donc une seule unité, "BPM", quelle que soit
  // l'activité (course, vélo, personnalisée). Ne pas confondre avec
  // `getCadenceUnitLabel`/`playlistCadenceUnit` (PlaylistDetailView.jsx) :
  // celui-là reste correct et inchangé, il affiche une VRAIE cadence
  // physique importée d'un Garmin/Strava, un cas totalement différent.
  const zoneBpmUnit = 'BPM';

  // Brouillon de saisie de l'Assistant Rapide — RE-DÉRIVÉ à chaque changement
  // d'onglet (voir l'effet juste en dessous) puisque chaque activité a
  // maintenant sa propre cadence de base, contrairement à l'ancien profil
  // unique où un seul brouillon suffisait. Pré-rempli avec une valeur
  // crédible par défaut (`defaultPreviewProfile.targetBpm`) plutôt que vide
  // tant que rien n'a encore été configuré.
  const [baseBpmDraft, setBaseBpmDraft] = useState(activeProfile?.targetBpm ?? defaultPreviewProfile.targetBpm);
  // BUG CORRIGÉ (retour direct : "le bouton calculer mes zones ne marche
  // pas") — `computeAndApplyZones` faisait bien un `return` silencieux si le
  // champ était vide ou invalide (`if (!baseBpmDraft) return;`, et
  // `setBaseBpmForActivity`/`setBaseBpmForCustom` refusent eux-mêmes
  // toute valeur <= 0 ou non numérique, voir useAthleticProfile.js) — mais
  // RIEN ne le signalait à l'écran : ni message, ni bordure rouge, ni le
  // moindre indice. Un clic sur "Calculer mes zones" sans avoir tapé de
  // chiffre (le placeholder "ex : 160" grisé peut se lire vite comme une
  // vraie valeur déjà saisie) semblait alors juste ne rien faire — ce que
  // c'était très exactement, mais sans jamais l'expliquer. Ce cas reste
  // possible malgré la pré-saisie par défaut ci-dessus (la personne peut
  // vider le champ à la main), d'où ce garde-fou conservé tel quel.
  const [bpmInputError, setBpmInputError] = useState(false);
  // RETOUR DIRECT ("réfléchis entre garder les anciens graphiques tel quel +
  // infobulle, ou les adapter au nouveau profil") — décision : on ADAPTE
  // déjà tout, sans rien figer (voir getZoneForValue, appConfig.js — chaque
  // graphique reclasse ses données EN DIRECT depuis le profil ACTUEL, aucun
  // instantané stocké par séance). C'est un choix assumé, pas un oubli : ces
  // zones sont une préférence redéfinissable, pas une mesure physiologique
  // figée, donc pas de "vérité historique" à préserver en la gelant — et une
  // simple faute de frappe corrigée doit se répercuter sur l'historique, pas
  // y rester figée. Compromis retenu plutôt qu'un vrai système de gel (qui
  // demanderait un instantané des seuils par séance, un changement de schéma
  // bien plus lourd pour un cas rare) : un toast simple, une fois, au moment
  // de la sauvegarde d'un profil DÉJÀ configuré — jamais à la toute première
  // configuration (rien à réévaluer dans ce cas, l'historique n'a pas encore
  // été classé avec d'anciennes valeurs).
  //
  // `hadConfiguredOnEntry` : photographie l'état "configuré ou non" au moment
  // où l'onglet/l'activité est ouvert, PAS l'état courant — sans ça,
  // `computeAndApplyZones` marquerait `isConfigured: true` dès la 1ère
  // sauvegarde et le toast se déclencherait quand même juste après coup, à
  // tort, pour une 1ère configuration. `toastShownThisVisit` : au plus UN
  // toast par visite de cet onglet, même si plusieurs zones sont ajustées à
  // la main d'affilée (4 champs "Ajuster manuellement") — sinon un ajustement
  // manuel des 4 zones déclencherait 4 toasts identiques à la suite.
  const hadConfiguredOnEntry = useRef(false);
  const toastShownThisVisit = useRef(false);
  const notifyPastGraphsWillUpdate = () => {
    if (!hadConfiguredOnEntry.current || toastShownThisVisit.current || !showToast) return;
    toastShownThisVisit.current = true;
    showToast("📊 Tes graphiques passés vont refléter ces nouvelles valeurs.");
  };
  useEffect(() => {
    setBaseBpmDraft(activeProfile?.targetBpm ?? buildDefaultPreviewProfile(isCustomProfileTab ? '__custom__' : selectedProfileActivity, activeProfile?.cadenceIntent || 'energy').targetBpm);
    setBpmInputError(false);
    setShowZoneCalcInfo(false);
    hadConfiguredOnEntry.current = activeProfile?.isConfigured ?? false;
    toastShownThisVisit.current = false;
  }, [selectedProfileActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const computeAndApplyZones = () => {
    const parsed = parseInt(baseBpmDraft);
    if (!baseBpmDraft || !Number.isFinite(parsed) || parsed <= 0) {
      setBpmInputError(true);
      return false;
    }
    setBpmInputError(false);
    if (isCustomProfileTab) setBaseBpmForCustom(selectedProfileActivity, baseBpmDraft);
    else setBaseBpmForActivity(selectedProfileActivity, baseBpmDraft);
    notifyPastGraphsWillUpdate();
    return true;
  };
  const handleSetZone = (zoneKey, value) => {
    if (isCustomProfileTab) setZoneForCustom(selectedProfileActivity, zoneKey, value);
    else setZoneForActivity(selectedProfileActivity, zoneKey, value);
  };
  const confirmAddCustomActivity = () => {
    const id = addCustomActivity(newCustomActivityName);
    if (id) { setSelectedProfileActivity(id); setNewCustomActivityName(''); setShowAddCustomActivity(false); }
  };
  // Question de l'Assistant Rapide adaptée à l'activité — un footing et une
  // sortie vélo n'évoquent pas la même intensité "tranquille" pour qui répond.
  // PIVOT DE MODÈLE : on demande maintenant directement le BPM MUSICAL voulu
  // à une intensité tranquille, pas une cadence physique (voir
  // useAthleticProfile.js, docstring en tête de fichier, pour le pourquoi).
  const baseBpmQuestion = selectedProfileActivity === 'Course à pied'
    ? "Quel tempo de musique veux-tu lors d'un footing lent ?"
    : selectedProfileActivity === 'Cyclisme'
      ? "Quel tempo de musique veux-tu lors d'une sortie tranquille ?"
      : `Quel tempo de musique veux-tu pour ${activeProfile ? `"${activeProfile.name}"` : 'cette activité'}, à une intensité tranquille ?`;

  return !isNaughtyMode && (
          <div className={`${cardBg} rounded-3xl border ${cardBorder} shadow-xl p-5 md:p-6`}>
            {/* Onglets d'activité — "Course à pied"/"Cyclisme" toujours présents
                (voir useAthleticProfile.js, pas de suppression possible pour ces
                2-là), activités personnalisées ajoutées/retirables à volonté. */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {/* RETOUR DIRECT ("je ne comprends pas que le cercle de relance
                  corresponde à une suppression du profil — il faudrait que ce
                  bouton soit dans l'encart de l'activité, au survol, avec une
                  infobulle") — déplacé DANS l'onglet de l'activité concernée
                  (au lieu d'un bouton isolé à côté du titre "BPM cibles par
                  zone", sans lien visuel évident avec UNE activité précise) :
                  n'apparaît qu'au survol de l'onglet ACTIF et déjà configuré
                  (`group-hover`, invisible sinon — pas de bruit visuel
                  permanent), avec un `title` explicite. `pr-7` sur l'onglet
                  sélectionné+configuré laisse la place à l'icône sans que le
                  texte ne passe dessous. */}
              {['Course à pied', 'Cyclisme'].map(key => {
                const isSelected = selectedProfileActivity === key;
                const isConfigured = athleticProfile.activities[key]?.isConfigured;
                return (
                  <div key={key} className="relative group">
                    <button
                      onClick={() => setSelectedProfileActivity(key)}
                      className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${isSelected ?
                        `${bgAccentClass} ${borderAccentClass} text-white ${isConfigured ? 'pr-7' : ''}` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}
                    >
                      {key}{isConfigured && ' ✓'}
                    </button>
                    {isSelected && isConfigured && (
                      <button
                        onClick={(e) => { e.stopPropagation(); resetActivityProfile(key); }}
                        title="Effacer ce profil — repartir de zéro pour cette activité"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/70 hover:text-white hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <RotateCcw size={12}/>
                      </button>
                    )}
                  </div>
                );
              })}
              {athleticProfile.custom.map(c => (
                <div key={c.id} className="relative group">
                  <button
                    onClick={() => setSelectedProfileActivity(c.id)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${selectedProfileActivity === c.id ?
                      `${bgAccentClass} ${borderAccentClass} text-white ${c.isConfigured ? 'pr-7' : ''}` : `bg-surface-hover ${cardBorder} ${textMuted} hover:text-main`}`}
                  >
                    {c.name}{c.isConfigured && ' ✓'}
                  </button>
                  {selectedProfileActivity === c.id && c.isConfigured && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCustomActivity(c.id); setSelectedProfileActivity('Course à pied'); }}
                      title="Supprimer cette activité personnalisée"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-white/70 hover:text-white hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12}/>
                    </button>
                  )}
                </div>
              ))}
              {!showAddCustomActivity ? (
                <button
                  onClick={() => setShowAddCustomActivity(true)}
                  className={`px-4 py-2 rounded-full text-sm font-bold border-2 border-dashed ${cardBorder} ${textMuted} hover:text-main`}
                >
                  + Ajouter une autre activité
                </button>
              ) : (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border-2 border-dashed ${cardBorder}`}>
                  <input
                    type="text" autoFocus placeholder="ex : Elliptique"
                    value={newCustomActivityName}
                    onChange={(e) => setNewCustomActivityName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmAddCustomActivity()}
                    className={`bg-transparent text-sm font-bold outline-none w-28 px-2 ${textHighlight}`}
                  />
                  <button onClick={confirmAddCustomActivity} className={`p-1.5 rounded-full text-white ${bgAccentClass}`}><Plus size={14}/></button>
                  <button onClick={() => { setShowAddCustomActivity(false); setNewCustomActivityName(''); }} className={`p-1.5 rounded-full ${textMuted} hover:text-red-500`}><Trash2 size={14}/></button>
                </div>
              )}
            </div>

            {/* Retour direct : "redondant d'avoir le titre de l'activité juste en
                dessous du bouton de sélection" — cette ligne répétait
                systématiquement le libellé de l'onglet déjà en surbrillance
                juste au-dessus (`selectedProfileActivity`/`activeProfile.name`),
                sans jamais rien ajouter. Gardé comme repère de section neutre
                (le bouton réinitialiser/supprimer a toujours besoin d'un point
                d'ancrage sur cette ligne), mais ne répète plus le nom déjà
                visible sur l'onglet actif. */}
            <div className="relative flex items-center gap-1.5 mb-2">
                <span className={`text-xs font-bold tracking-wide ${textMuted}`}>
                  BPM cibles par zone
                </span>
                {/* RETOUR DIRECT : "je ne vois pas infobulle expliquant le
                    calcul automatique" — l'ancien <span title="..."> ne
                    s'affichait qu'au survol (souris), invisible au doigt sur
                    mobile/tablette. Remplacé par un vrai popover cliquable
                    (voir showZoneCalcInfo plus haut) : marche pareil à la
                    souris et au tactile, et reste ouvert le temps de lire au
                    lieu de disparaître si le curseur/doigt bouge.
                    La formule elle-même est une simple progression linéaire
                    autour du BPM tapé (base ± un espacement fixe par palier,
                    voir ZONE_SPACING_BY_ACTIVITY dans useAthleticProfile.js),
                    volontairement PAS une vraie formule physiologique
                    (%VMA, VO2max...).
                    PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4,
                    cœur à 170 bpm, pas à 160, musique voulue à 180") : ce
                    profil demande maintenant directement le BPM MUSICAL
                    voulu à chaque zone d'effort, plus une cadence physique
                    silencieusement recopiée comme cible — voir la docstring
                    de useAthleticProfile.js pour le détail du raisonnement. */}
                <button
                  type="button"
                  onClick={() => setShowZoneCalcInfo(!showZoneCalcInfo)}
                  className={`${textMuted} hover:text-main transition-colors`}
                >
                  <Info size={13}/>
                </button>
                {/* Popover élargi (w-80/w-96, contraste texte relevé, backdrop
                    cliquable pour fermer) après un retour direct sur
                    l'ancienne version (trop étroite, texte gris peu lisible,
                    superposée de façon confuse avec la question/le bouton
                    juste en dessous). Contenu réécrit pour le pivot de
                    modèle : BPM musical cible directement, zones nommées par
                    NIVEAU D'EFFORT (vocabulaire de coach de course à pied),
                    jamais présentées comme une mesure cardiaque ou une
                    cadence physique. */}
                {showZoneCalcInfo && (
                  <div className="fixed inset-0 z-30" onClick={() => setShowZoneCalcInfo(false)} />
                )}
                {/* RETOUR DIRECT ("le texte est bon mais l'infobulle est
                    difficilement lisible, longue — faudrait pas justifier ?")
                    — le justifié n'a PAS été appliqué volontairement : sur
                    une colonne aussi étroite (~320-380px), sans coupure de
                    mots, justifier crée des espaces irréguliers entre les
                    mots ("rivières") plutôt que d'améliorer la lecture — un
                    problème de typographie connu, pire encore avec des mots
                    français longs. Le vrai correctif : `text-xs` → `text-sm`
                    (trop petit pour 3 paragraphes de lecture), le 2e
                    paragraphe (~85 mots d'un bloc) éclaté en 3 plus courts
                    par idée, quelques mots-clés en gras comme points
                    d'ancrage visuel (pas pour décorer — pour qu'un survol
                    rapide capte l'essentiel sans tout relire), et plus
                    d'espace entre paragraphes (space-y-3 plutôt que mb-2 sur
                    un seul). Popover légèrement élargi en écho (moins de
                    lignes par paragraphe à texte plus gros). */}
                {showZoneCalcInfo && (
                  <div className={`absolute z-40 top-full left-0 mt-2 w-80 sm:w-[26rem] p-4 rounded-xl border shadow-2xl text-sm leading-relaxed space-y-3 ${cardBg} ${cardBorder} ${textHighlight}`}>
                    <p>
                      <strong>Zone 2</strong> = le BPM que tu tapes ci-dessous. Les 3 autres s'en écartent par palier fixe de {getZoneSpacingForActivity(isCustomProfileTab ? '__custom__' : selectedProfileActivity, activeProfile?.cadenceIntent || 'energy')} BPM (Zone 1 = -1 palier, Zone 3 = +1, Zone 4 = +2) — une progression simple autour de ton BPM, pas une vraie formule physiologique (%VMA...).
                    </p>
                    <p className={textMuted}>
                      Les noms de zone (Récupération, Endurance, Seuil, Vitesse) viennent du vocabulaire des coachs de course à pied — ils décrivent un <strong className={textHighlight}>niveau d'effort</strong>, pas une mesure précise.
                    </p>
                    <p className={textMuted}>
                      Le chiffre associé est directement le <strong className={textHighlight}>tempo de musique que TU veux</strong> à cette intensité : ta fréquence cardiaque et ta cadence de pas peuvent t'aider à en juger, mais ce ne sont pas les mêmes nombres et rien ne les convertit automatiquement l'un dans l'autre.
                    </p>
                    <p className={textMuted}>
                      Toujours ajustable au BPM près via <strong className={textHighlight}>"Ajuster manuellement"</strong> ci-dessous — et modifiable librement au moment de générer, ce profil ne fait que suggérer un point de départ.
                    </p>
                  </div>
                )}
            </div>

            {/* RETOUR DIRECT ("en course à pied, la cadence de pas varie peu
                selon la zone — personnaliser le BPM par zone a-t-il un
                sens ?") — challengé puis creusé ensemble : deux INTENTIONS
                différentes coexistent, avec des besoins d'espacement de zone
                opposés (voir SYNC_ZONE_SPACING_BY_ACTIVITY,
                useAthleticProfile.js pour le détail). Ce toggle choisit
                laquelle, AVANT l'Assistant Rapide (l'espacement en dépend).
                Masqué pour les activités où "cadence" n'a pas de sens
                (Musculation — pas de rythme cyclique comparable, déjà établi
                pour "Allure"/"Distance") via `isCadenceIntentEligible`.
                Bascule immédiatement persistée (`setCadenceIntentForActivity`/
                `setCadenceIntentForCustom`) même si le profil n'est pas
                encore configuré — sans écrire de fausses zones tant que ce
                n'est pas le cas (voir le garde-fou dans
                useAthleticProfile.js). */}
            {/* RETOUR DIRECT ("pas sur fond noir, et l'option sélectionnée en
                rouge comme le reste") — le style repris de "Par Durée /
                Distance" (fond blanc pour l'option choisie) détonnait avec la
                convention utilisée PARTOUT ailleurs dans l'app pour "option
                choisie" (accent rouge/rose — onglets d'activité juste
                au-dessus, cartes "Structure de l'effort", etc.), pas du
                blanc. Bascule sur `bgAccentClass`, cohérent avec tout le
                reste de cette page.
                RETOUR DIRECT SUIVANT ("infobulle utile pour les 2 options")
                — jusqu'ici seule la description de l'option DÉJÀ choisie
                s'affichait (en dessous) ; celle de l'option non choisie
                n'était visible qu'après avoir cliqué dessus. `title` natif
                sur chaque bouton (survol) donne accès aux 2 descriptions
                sans devoir choisir pour voir. */}
            {isCadenceIntentEligible(isCustomProfileTab ? '__custom__' : selectedProfileActivity) && (() => {
              const cadenceIntentOptions = [
                { value: 'energy', title: 'Matche l\'intensité', desc: 'BPM très différent selon la zone (calme en récup, énergique en VMA).' },
                { value: 'sync', title: 'Suit ton rythme', desc: 'BPM proche de ta cadence réelle, peu importe la zone.' },
              ];
              const currentIntent = activeProfile?.cadenceIntent || 'energy';
              const selectedOption = cadenceIntentOptions.find(o => o.value === currentIntent);
              return (
                <div>
                  <div className={`flex ${inputBg} border ${inputBorder} rounded-xl p-1`}>
                    {cadenceIntentOptions.map(({ value, title, desc }) => (
                      <button
                        key={value}
                        title={desc}
                        onClick={() => isCustomProfileTab ? setCadenceIntentForCustom(selectedProfileActivity, value) : setCadenceIntentForActivity(selectedProfileActivity, value)}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${currentIntent === value ? `${bgAccentClass} text-white shadow-sm` : `${textMuted} hover:text-main`}`}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                  {/* RETOUR DIRECT ("même espacement texte→bloc que pour le
                      titre 'BPM cibles par zone' au-dessus, qui utilise
                      mb-2 avant son bloc toggle") — `mt-2` ici au lieu de
                      `mt-3`, pour matcher exactement cet autre espacement
                      plutôt qu'une valeur proche mais différente. Taille/
                      graisse/couleur (`text-xs font-bold ${textMuted}`)
                      déjà alignées sur ce même label lors du réglage
                      précédent. */}
                  <p className={`text-xs font-bold mt-2 ${textMuted}`}>{selectedOption.desc}</p>
                </div>
              );
            })()}

            {/* Assistant Rapide : une seule question, 4 zones calculées d'un
                coup (voir computeZonesFromBaseBpm, useAthleticProfile.js).
                ─────────────────────────────────────────────────────────────
                PIVOT DE MODÈLE (retour direct, cas concret : "à ma zone 4,
                cœur à 170 bpm, pas à 160, musique voulue à 180") — ce champ
                demande directement le BPM MUSICAL que l'utilisateur veut à
                une intensité tranquille, pas une cadence physique. L'ancienne
                version demandait "ta cadence habituelle" (PPM) puis recopiait
                silencieusement ce nombre comme cible BPM — or ce sont 3
                nombres indépendants pour la plupart des gens (fréquence
                cardiaque réelle, cadence de pas réelle, tempo de musique
                voulu). Voir la docstring de useAthleticProfile.js pour le
                raisonnement complet. Les noms internes (`targetBpm`,
                `zone1..4`) restent inchangés (pas de migration de données
                nécessaire) — seul ce qui est DEMANDÉ/AFFICHÉ change de sens.
                Ne pas confondre avec PlaylistDetailView.jsx ("Cadence (PPM)"
                vs "BPM cible"), qui lui affiche une vraie cadence physique
                importée d'un Garmin/Strava — cas différent, inchangé. */}
            <div className={`mt-2 p-4 rounded-2xl ${inputBg} border ${inputBorder}`}>
              <label className={`text-sm font-bold block mb-2 ${textHighlight}`}>{baseBpmQuestion}</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className={`flex-1 flex items-center px-4 py-3 rounded-xl border ${bpmInputError ? 'border-red-500' : inputBorder} ${cardBg}`}>
                  {/* BUG CORRIGÉ (25/07, retour direct : "je ne devrais pas
                      pouvoir sélectionner 40 BPM même au repos") : `min`
                      était figé à 40 quel que soit le mode — partout ailleurs
                      dans l'appli où un plancher BPM musical existe (curseurs
                      Crescendo, voir crescendoBpmFloor/GeneratorWizard.jsx,
                      EditRoutineModal.jsx, useGeneratorForm.js, App.jsx),
                      c'est `isNaughtyMode ? 40 : 80` — 40 réservé au Mode
                      Intime (musique volontairement plus lente), 80 en
                      standard. Aligné ici sur cette même convention déjà
                      établie plutôt que d'introduire un nouveau chiffre. */}
                  <input
                    type="number" min={isNaughtyMode ? 40 : 80} max="220" placeholder="ex : 160"
                    value={baseBpmDraft}
                    onChange={(e) => { setBaseBpmDraft(syncClampedInput(e, { min: isNaughtyMode ? 40 : 80, max: 220 })); if (bpmInputError) setBpmInputError(false); }}
                    onKeyDown={(e) => e.key === 'Enter' && computeAndApplyZones()}
                    className={`bg-transparent w-full text-lg font-bold outline-none ${textHighlight}`}
                  />
                  <span className={`text-sm font-bold shrink-0 ${textMuted}`}>{zoneBpmUnit}</span>
                </div>
                <button onClick={computeAndApplyZones} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${bgAccentClass} hover:brightness-110 shrink-0`}>
                  Calculer mes zones
                </button>
              </div>
              {bpmInputError && (
                <p className="text-xs font-bold text-red-500 mt-2">Indique d'abord un chiffre (le BPM que tu veux) avant de calculer tes zones.</p>
              )}
            </div>

            {/* RETOUR DIRECT ("je n'ai toujours pas accès à l'option de
                génération par défaut alors que je pourrais être en accord
                avec toutes les valeurs") — ce récapitulatif (et le bandeau
                "Générer une playlist" juste en dessous) ne s'affichaient
                QUE si `isConfigured` était déjà vrai, c'est-à-dire après avoir
                cliqué "Calculer mes zones" ou touché un champ Expert. Sauf que
                la page affiche maintenant TOUJOURS des valeurs crédibles par
                défaut (voir defaultPreviewProfile, buildDefaultPreviewProfile
                dans useAthleticProfile.js) — quelqu'un qui regarde juste ces
                valeurs par défaut, les trouve très bien et n'a RIEN à changer
                n'avait donc aucun moyen d'accéder à la génération sans un
                clic de validation qui, pour lui, ne servait à rien. Affiché
                maintenant dans TOUS les cas (profil réel ou aperçu par
                défaut), avec une mention explicite quand ce sont encore des
                valeurs par défaut — la transparence sur l'origine du chiffre
                reste importante, seul l'ACCÈS ne doit plus dépendre de
                `isConfigured`. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {ATHLETIC_ZONES.map(z => (
                <div key={z.key} className={`p-3 rounded-xl border ${inputBorder} ${inputBg} text-center`}>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${textMuted}`}>{z.shortLabel}</span>
                  </div>
                  <div className={`text-xl font-black ${textHighlight}`}>{activeProfile?.[z.key] ?? defaultPreviewProfile[z.key]}</div>
                  <div className={`text-[10px] ${textMuted}`}>{zoneBpmUnit}</div>
                </div>
              ))}
            </div>

            {/* RETOUR DIRECT : "faudrait la possibilité d'ajuster
                manuellement puis ensuite générer playlist en dessous" —
                remonté ici (juste après le récapitulatif des zones), AVANT le
                bouton "Générer" plutôt qu'après : l'ordre logique de lecture
                devient "voir mes zones → les affiner si besoin → générer",
                le CTA restant la toute dernière étape quel que soit le choix
                de déplier ou non cette section (elle reste repliée par
                défaut, toujours facultative). */}
            <button
              onClick={() => setShowExpertZones(!showExpertZones)}
              className={`mt-4 flex items-center gap-1.5 text-sm font-bold ${textColorClass}`}
            >
              {showExpertZones ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              <span>Ajuster manuellement</span>
            </button>

            {showExpertZones && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                {ATHLETIC_ZONES.map(z => (
                  <div key={z.key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${inputBorder} ${inputBg}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: z.color }}></span>
                      <span className={`text-sm font-bold truncate ${textHighlight}`}>{z.label}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border ${inputBorder} ${cardBg}`}>
                      {/* BUG CORRIGÉ (25/07) : `min`/`max` HTML ne bloquent
                          pas la frappe clavier (seulement le spinner natif,
                          jamais utilisé ici) — rien n'empêchait de taper
                          "0145" ou n'importe quelle valeur hors bornes (voir
                          numberInput.js, déjà utilisé ailleurs dans l'app
                          pour ce même problème, jamais appliqué ici). Plancher
                          aligné sur `isNaughtyMode ? 40 : 80`, comme le champ
                          juste au-dessus — même raisonnement. */}
                      <input
                        type="number" min={isNaughtyMode ? 40 : 80} max="220"
                        value={activeProfile?.[z.key] ?? defaultPreviewProfile[z.key]}
                        onChange={(e) => handleSetZone(z.key, syncClampedInput(e, { min: isNaughtyMode ? 40 : 80, max: 220 }))}
                        onBlur={notifyPastGraphsWillUpdate}
                        className={`w-14 bg-transparent text-right font-mono font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${textHighlight}`}
                      />
                      <span className={`text-xs font-bold ${textMuted}`}>{zoneBpmUnit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Renvoi vers la génération (retour direct : "une fois profil
                athlétique complété pour une activité faudrait un message qui
                suggère de générer une playlist") — reste accessible SANS
                condition (retour direct : "je ne devrais pas avoir besoin
                d'ajuster manuellement pour générer, si les zones de base me
                conviennent je dois pouvoir cliquer directement sur générer") :
                le clic accepte implicitement les valeurs par défaut affichées
                si rien n'a encore été réellement configuré
                (`computeAndApplyZones` avec la cadence déjà pré-remplie dans
                l'Assistant Rapide, voir `baseBpmDraft`), avant de
                rejoindre le générateur.
                RETOUR DIRECT SUIVANT : "pas la peine d'avoir le texte
                explicatif ou les pointillés en rouge" — simplifié en simple
                bouton, sans l'encart à bordure en pointillés ni le texte
                d'accompagnement (qui expliquait surtout "pourquoi" ce bouton
                est là, jugé superflu une fois que son EMPLACEMENT — juste
                après les réglages, avant rien d'autre — parle de lui-même).
                RETOUR DIRECT SUIVANT ("pas évident que ce bouton entraîne
                une sauvegarde des valeurs") — vrai : le clic appelle
                `computeAndApplyZones()`, qui PERSISTE les 4 zones (via
                `setBaseBpmForActivity`/`setBaseBpmForCustom`) si l'activité
                n'était pas encore configurée — un effet de bord réel, mais
                invisible dans un bouton qui ne parlait QUE de "générer".
                Libellé conditionnel plutôt qu'un toast après coup ou un
                texte d'accompagnement séparé (déjà retiré juste avant, voir
                note ci-dessus) : dit AVANT le clic ce qui va se passer, sans
                réintroduire l'encart qu'on venait de simplifier. Une fois
                l'activité déjà configurée (`activeProfile?.isConfigured`),
                `computeAndApplyZones()` ne s'exécute même pas (court-circuit
                `||`) — le libellé redevient simplement "Générer une
                playlist →", exact dans ce cas. */}
            <button
              onClick={() => { if (activeProfile?.isConfigured || computeAndApplyZones()) setShowAthleticProfile(false); }}
              className={`w-full mt-4 px-4 py-3 rounded-xl font-bold text-sm text-white ${bgAccentClass} hover:brightness-110`}
            >
              {activeProfile?.isConfigured ? 'Générer une playlist →' : 'Enregistrer mon profil et générer →'}
            </button>
          </div>
  );
}
