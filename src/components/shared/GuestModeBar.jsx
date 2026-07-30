import { UserPlus } from 'lucide-react';

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
 */
export default function GuestModeBar({ theme, isVisible, openModal }) {
  const { cardBg, cardBorderStrong, textMuted, textColorClass } = theme;

  if (!isVisible) return null;

  return (
    // h-[72px] (64→72, +8px, Refactor UI "aération footer/GuestBar", 29/07,
    // retour direct : "la ligne de crédit frôle la bordure inférieure") —
    // DOIT rester une classe Tailwind écrite en toutes lettres (voir
    // bottomBarLayout.js pour pourquoi) — reporté depuis GUEST_MODE_BAR_HEIGHT_PX
    // (bottomBarLayout.js), déjà mis à jour à l'identique. Disposition
    // mono-ligne (`flex-row items-center justify-center gap-3`) INCHANGÉE :
    // le contenu profite juste des 8px supplémentaires pour se centrer
    // verticalement avec un peu plus d'air, sans aucune restructuration.
    <div className={`h-[72px] border-t-2 ${cardBorderStrong} ${cardBg} flex flex-row items-center justify-center gap-3 px-6`}>
      <span className={`text-sm font-normal ${textMuted}`}>
        Données sauvegardées uniquement sur cet appareil.
      </span>
      <button
        onClick={() => openModal('AUTH')}
        className={`shrink-0 text-sm font-bold ${textColorClass} hover:opacity-80 flex items-center gap-2 transition-colors`}
      >
        <UserPlus size={14} /> Se connecter
      </button>
    </div>
  );
}
