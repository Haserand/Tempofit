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
 * Hauteur 40px → 64px, message et bouton empilés sur 2 lignes plutôt que
 * sur une seule (`flex flex-col` au lieu de l'ancien `flex-1` inline).
 * Couleurs : le brief d'origine demandait `text-white`/`text-red-500` en
 * dur, mais ce fond (`cardBg`) est ADAPTATIF clair/sombre (voir
 * useTheme.js/index.css) — du texte blanc fixe y serait invisible en thème
 * clair (même classe de bug que FavoritesView.jsx, déjà corrigée une fois
 * cette semaine). Remplacé par l'équivalent sémantique déjà utilisé
 * ailleurs pour ce même effet "texte proéminent" : `textHighlight` (message,
 * au lieu du `textMuted` plus discret d'avant) et `textColorClass` (bouton
 * — déjà l'accent rouge/rose adaptatif Mode Standard/Intime, inchangé dans
 * sa couleur de base, juste plus gras et sans `underline`, sur sa propre
 * ligne). Survol du bouton en `hover:opacity-80` plutôt qu'un
 * `hover:text-red-400` fixe — un rouge fixe détonnerait en Mode Intime
 * (accent rose, pas rouge) : `opacity` reste dans la même famille de
 * couleur quel que soit le mode.
 */
export default function GuestModeBar({ theme, isVisible, openModal }) {
  const { cardBg, cardBorderStrong, textHighlight, textColorClass } = theme;

  if (!isVisible) return null;

  return (
    // h-[64px] : DOIT rester une classe Tailwind écrite en toutes lettres
    // (voir bottomBarLayout.js pour pourquoi) — si cette hauteur change,
    // reporter la même valeur dans GUEST_MODE_BAR_HEIGHT_PX (bottomBarLayout.js).
    <div className={`h-[64px] border-t-2 ${cardBorderStrong} ${cardBg} flex items-center`}>
      <div className="flex-1 px-4 flex flex-col items-center justify-center h-full gap-1">
        <span className={`text-sm font-medium ${textHighlight}`}>
          Mode invité — données sauvegardées uniquement sur cet appareil.
        </span>
        <button
          onClick={() => openModal('AUTH')}
          className={`text-sm font-bold ${textColorClass} hover:opacity-80 flex items-center gap-2 transition-colors`}
        >
          <UserPlus size={14} /> Se connecter
        </button>
      </div>
    </div>
  );
}
