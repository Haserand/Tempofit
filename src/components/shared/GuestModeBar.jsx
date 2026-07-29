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
 * Hauteur 40px → 64px (`h-[64px]`, INCHANGÉE depuis — voir plus bas).
 *
 * ── Alignement Design System, layout horizontal (28/07) ─────────────────
 * Refonte du contenu INTERNE de la barre (hauteur `h-[64px]` toujours
 * inchangée, budget de hauteur déjà validé/synchronisé — voir
 * bottomBarLayout.js) : le message + bouton empilés en 2 lignes centrées
 * (`flex-col items-center`, ancien design "bandeau d'alerte") deviennent un
 * VRAI bandeau applicatif — bloc texte titre/sous-titre (même hiérarchie
 * typographique que ViewHeader, `textHighlight` gras pour "Mode invité" +
 * `textMuted` normal pour le sous-titre) et bouton "Se connecter", plus de
 * tiret entre les 2 phrases (désormais 2 lignes distinctes du même bloc,
 * pas une seule phrase concaténée).
 * Distribution horizontale : `justify-between` (1er essai, retour direct :
 * "étire trop vers les extrémités, vide artificiel au centre") remplacé
 * par `justify-center gap-6` — texte et bouton forment un groupe COMPACT
 * centré sous le contenu principal, plutôt que plaqués chacun à une
 * extrémité. Le bloc texte garde son alignement interne à gauche
 * (`items-start`) pour préserver la hiérarchie visuelle Titre/Sous-titre
 * même une fois le groupe centré dans la barre.
 * Couleurs : `textHighlight`/`textMuted`/`textColorClass` — tous des
 * tokens déjà adaptatifs clair/sombre/Mode Intime (voir useTheme.js), un
 * hardcode (`text-white`/`text-slate-*` en dur) casserait ce réglage, même
 * classe de piège que documenté plus haut dans ce fichier. Survol du
 * bouton en `hover:opacity-80` (inchangé) plutôt qu'une couleur fixe, pour
 * la même raison (Mode Intime = accent rose, pas rouge).
 */
export default function GuestModeBar({ theme, isVisible, openModal }) {
  const { cardBg, cardBorderStrong, textHighlight, textMuted, textColorClass } = theme;

  if (!isVisible) return null;

  return (
    // h-[64px] : DOIT rester une classe Tailwind écrite en toutes lettres
    // (voir bottomBarLayout.js pour pourquoi) — si cette hauteur change,
    // reporter la même valeur dans GUEST_MODE_BAR_HEIGHT_PX (bottomBarLayout.js).
    <div className={`h-[64px] border-t-2 ${cardBorderStrong} ${cardBg} flex flex-row justify-center items-center gap-6 px-6`}>
      <div className="flex flex-col items-start min-w-0">
        <span className={`font-bold text-base ${textHighlight}`}>Mode invité</span>
        <span className={`text-sm font-normal mt-0.5 truncate ${textMuted}`}>
          Données sauvegardées uniquement sur cet appareil.
        </span>
      </div>
      <button
        onClick={() => openModal('AUTH')}
        className={`shrink-0 text-sm font-bold ${textColorClass} hover:opacity-80 flex items-center gap-2 transition-colors`}
      >
        <UserPlus size={14} /> Se connecter
      </button>
    </div>
  );
}
