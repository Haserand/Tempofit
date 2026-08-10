import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';

/**
 * GuestModeBar — barre fixée en bas de l'écran, rappelant à un utilisateur
 * non connecté que ses données ne sont sauvegardées que sur cet appareil.
 * Extraite d'App.jsx (25/07).
 *
 * ── Layout Dashboard (27/07) ─────────────────────────────────────────────
 * Cette barre vivait à l'origine en PLEINE LARGEUR (`w-full`, posée sur le
 * conteneur commun dans App.jsx), passant PAR-DESSUS la Sidebar plutôt que
 * de s'arrêter à sa droite — ce qui recouvrait son crédit "Un projet créé
 * par..." sur CERTAINES pages seulement (bug remonté par capture), corrigé
 * à l'époque en RÉPLIQUANT ce même texte ici, dans une colonne `w-64` alignée
 * à la largeur exacte de la Sidebar (voir historique dans l'ancienne version
 * de ce fichier si besoin).
 * Retour direct (layout Dashboard, bordures 2px) : la Sidebar doit être une
 * colonne ININTERROMPUE de haut en bas, sa bordure droite doit descendre
 * jusqu'en bas de l'écran sans jamais être coupée par cette barre. Le
 * conteneur commun (App.jsx) cale maintenant cette barre à DROITE de la
 * Sidebar sur desktop (`md:left-64 md:w-[calc(100%-16rem)]`) au lieu de
 * passer par-dessus — la Sidebar n'est donc plus jamais recouverte sur
 * desktop, et la réplique du crédit n'a plus aucune raison d'exister : le
 * crédit ORIGINAL de Sidebar.jsx reste visible en permanence (plus de
 * condition `!guestBarVisible` là-bas non plus, voir Sidebar.jsx). Cette
 * barre ne contient donc plus QUE le message "Mode invité", plus de colonne
 * crédit dupliquée à synchroniser.
 * Reste pleine largeur sur MOBILE (`left-0`, pas de `md:` sur cette valeur) :
 * la Sidebar y est hors-écran par défaut (`-translate-x-full`, sauf menu
 * ouvert), donc rien à respecter à cette largeur.
 *
 * ── Renforcement du CTA (27/07, "le bouton haut-droit étant désormais
 * masqué quand cette barre est visible, elle doit assumer seule la
 * conversion") ─────────────────────────────────────────────────────────
 * Hauteur 40px → 64px (`h-[64px]`) — puis 64→72px le 29/07 (voir plus bas).
 *
 * ── Alignement Design System, puis simplification 1-ligne (28/07) ───────
 * Chantier en plusieurs itérations le même jour : d'abord un "vrai bandeau
 * applicatif" à 2 lignes (titre "Mode invité" gras + sous-titre muted, avec
 * le bouton "Se connecter" tantôt à droite via `justify-between`, tantôt
 * centré via `justify-center`, tantôt aligné sur la ligne du titre) — puis,
 * retour direct final : "la structure à 2 lignes crée des décalages
 * asymétriques en bas d'écran". Simplifié à l'os : le titre "Mode invité"
 * est retiré ENTIÈREMENT (jugé redondant avec le sous-titre, qui dit déjà
 * l'essentiel), ne reste plus que le texte explicatif et le bouton, tous
 * deux sur UNE SEULE ligne (`flex-row items-center justify-center gap-3`).
 * `textHighlight` (qui stylait l'ancien titre) n'est donc plus utilisé ici
 * — retiré de la déstructuration plutôt que laissé en import mort.
 * Hauteur `h-[64px]` restée inchangée jusqu'au 29/07 — bumpée à `h-[72px]`
 * ce jour-là (Refactor UI "aération footer/GuestBar", retour direct : "la
 * ligne de crédit de la Sidebar frôle la bordure inférieure") : un contenu
 * 1-ligne y respire maintenant encore plus largement.
 * Couleurs : `textMuted`/`textColorClass` — tous des
 * tokens déjà adaptatifs clair/sombre/Mode Intime (voir useTheme.js), un
 * hardcode (`text-white`/`text-slate-*` en dur) casserait ce réglage, même
 * classe de piège que documenté plus haut dans ce fichier. Survol du
 * bouton en `hover:opacity-80` (inchangé) plutôt qu'une couleur fixe, pour
 * la même raison (Mode Intime = accent rose, pas rouge).
 *
 * ── Fermeture SESSION-ONLY (03/08, retour direct : "peut-on envisager une
 * option pour supprimer/fermer la guest mode bar" — discussion produit
 * avant implémentation) ──────────────────────────────────────────────────
 * Choix délibéré, discuté avec l'utilisateur : PAS de fermeture
 * permanente (aucune persistance `localStorage`/Supabase). Cette barre
 * existe pour rappeler qu'un compte invité n'est sauvegardé que sur CET
 * appareil — une fermeture définitive ferait courir un vrai risque produit
 * (l'invité l'oublie, perd ses données un jour sans comprendre pourquoi,
 * cache vidé ou changement d'appareil).
 * ⚠️ REMONTÉ (04/08, retour direct : "je dois pouvoir scroll QUAND la barre
 * est visible, et ne plus avoir à scroller une fois qu'elle est masquée")
 * — la décision finale "masqué ou non" (`isVisible`/`onDismiss`) vit
 * maintenant dans AppContent (App.jsx), PAS ici : un `useState` strictement
 * local à ce composant ne pouvait être lu ni par le spacer du contenu
 * principal, ni par Sidebar.jsx (`guestBarVisible`) — fermer la barre ne
 * libérait donc jamais l'espace qu'elle réservait ailleurs. Le comportement
 * "session-only" (repli à zéro à chaque vrai rechargement) reste identique
 * — c'est toujours un simple `useState`, juste possédé un cran plus haut
 * (voir `isGuestBarDismissed`, App.jsx). Seul `confirmingDismiss` reste un
 * état LOCAL à ce composant : un pur détail d'affichage interne (quel
 * contenu montrer DANS la barre), personne d'autre n'en a besoin.
 * Confirmation intermédiaire (`confirmingDismiss`) plutôt qu'un clic direct
 * sur le X : le contenu de LA MÊME barre (pas une modale séparée — le
 * message est court, une modale aurait été disproportionnée pour ce texte)
 * bascule sur un rappel explicite du risque + 2 boutons ("Masquer quand
 * même" / "Annuler"), pour qu'une fermeture accidentelle ne prive jamais
 * silencieusement l'utilisateur de ce rappel de sécurité. "Masquer quand
 * même" appelle `onDismiss()` (remonté au parent) plutôt que de mettre à
 * jour un état local.
 *
 * ── Alignement 2 lignes sur le pied de page de la Sidebar (retour direct,
 * captures à l'appui) ─────────────────────────────────────────────────────
 * Passe de mono-ligne (`flex-row`) à DEUX lignes empilées
 * (`flex-col items-center justify-center gap-1 py-2`), pour reproduire
 * EXACTEMENT la structure du pied de page de Sidebar.jsx (Réglages/
 * Trophées sur une ligne, crédit "Un projet créé par..." juste en dessous,
 * même conteneur `h-[72px]`/`flex-col items-center justify-center gap-1
 * py-2`) — SANS RIEN modifier dans Sidebar.jsx elle-même, seulement
 * répliquer ici la même recette de mise en page (hauteur fixe identique,
 * même padding vertical, même gap) pour que les deux pieds de page,
 * visuellement côte à côte sur desktop, aient leurs 2 lignes à la même
 * hauteur.
 * Ligne 1 (boutons) : `text-sm font-bold`, comme "Réglages" en face.
 * Ligne 2 (texte explicatif) : passé de `text-sm` à `text-xs`, comme le
 * crédit "Un projet créé par..." en face — nécessaire pour que les 2
 * lignes de base coïncident (une taille de texte différente aurait décalé
 * la hauteur de ligne, même avec un padding/gap identique par ailleurs).
 * Texte de l'état de confirmation RACCOURCI dans la foulée ("— ce rappel
 * reviendra à ta prochaine visite" retiré) : à `text-xs` sur une largeur
 * de ligne 2 déjà contrainte par le padding horizontal, la phrase complète
 * passait mal ; le message essentiel (données sauvegardées uniquement sur
 * cet appareil) reste intact, seule la précision "ce rappel reviendra..."
 * disparaît — l'utilisateur venait de toute façon de LIRE ce rappel en
 * cliquant sur la croix, la répétition n'était pas strictement nécessaire.
 * Hauteur du conteneur INCHANGÉE (`h-[72px]`, toujours la même classe en
 * toutes lettres — voir bottomBarLayout.js pour pourquoi) : seule sa
 * disposition INTERNE change, jamais sa taille globale ni celle de
 * Sidebar.jsx.
 */
export default function GuestModeBar({ theme, isVisible, openModal, onDismiss = () => {} }) {
  const { cardBg, cardBorderStrong, textMuted, textColorClass } = theme;
  // `confirmingDismiss` : voir la docstring "Fermeture SESSION-ONLY" plus
  // haut — seul état encore local à ce composant depuis le 04/08.
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);

  if (!isVisible) return null;

  return (
    // h-[72px] INCHANGÉE (voir bottomBarLayout.js) — seule la disposition
    // INTERNE passe de mono-ligne à 2 lignes empilées
    // (`flex-col items-center justify-center gap-1 py-2`), copiée telle
    // quelle depuis le pied de page de Sidebar.jsx (voir la docstring
    // "Alignement 2 lignes" plus haut) pour que les 2 lignes de CETTE barre
    // tombent exactement sur celles de la Sidebar juste à sa gauche.
    <div className={`h-[72px] border-t-2 ${cardBorderStrong} ${cardBg} flex flex-col items-center justify-center gap-1 py-2 px-6`}>
      {confirmingDismiss ? (
        <>
          <div className="w-full flex items-center justify-center gap-3">
            <button
              onClick={onDismiss}
              className={`shrink-0 text-sm font-bold ${textColorClass} hover:opacity-80 transition-colors`}
            >
              Masquer quand même
            </button>
            <button
              onClick={() => setConfirmingDismiss(false)}
              className={`shrink-0 text-sm font-bold ${textMuted} hover:text-main transition-colors`}
            >
              Annuler
            </button>
          </div>
          <span className={`text-xs font-normal text-center ${textMuted}`}>
            Tes données resteront sauvegardées uniquement sur cet appareil.
          </span>
        </>
      ) : (
        <>
          <div className="w-full flex items-center justify-center gap-3">
            <button
              onClick={() => openModal('AUTH')}
              className={`shrink-0 text-sm font-bold ${textColorClass} hover:opacity-80 flex items-center gap-2 transition-colors`}
            >
              <UserPlus size={14} /> Se connecter
            </button>
            {/* Bouton icône seule → `ICON_BUTTON_ROUNDING` (voir
                iconButtonLayout.js pour la règle centralisée, 03/08). */}
            <button
              onClick={() => setConfirmingDismiss(true)}
              title="Masquer ce rappel pour cette visite"
              className={`shrink-0 p-1.5 ${ICON_BUTTON_ROUNDING} ${textMuted} hover:text-main hover:bg-surface-hover transition-colors`}
            >
              <X size={16} />
            </button>
          </div>
          <span className={`text-xs font-normal ${textMuted}`}>
            Données sauvegardées uniquement sur cet appareil.
          </span>
        </>
      )}
    </div>
  );
}
