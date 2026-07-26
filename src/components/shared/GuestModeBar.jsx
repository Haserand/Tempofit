import { UserPlus } from 'lucide-react';

/**
 * GuestModeBar — barre pleine largeur, fixée en bas de l'écran, rappelant à
 * un utilisateur non connecté que ses données ne sont sauvegardées que sur
 * cet appareil. Extraite d'App.jsx (25/07).
 *
 * HISTORIQUE COURT (25/07, même session) :
 * 1. Un premier essai vivait DANS Sidebar.jsx — retour direct de
 *    l'utilisateur : "pas dans la sidebar, ça surcharge le menu, plutôt une
 *    barre horizontale pleine largeur". Entièrement retiré de là-bas.
 * 2. Cette barre (fixed, pleine largeur, z-[65]) passe PAR-DESSUS la
 *    Sidebar (fixed, z-50) dans leur zone commune en bas-gauche de l'écran —
 *    ce qui recouvrait le crédit "Un projet créé par..." de la sidebar sur
 *    CERTAINES pages seulement (bug remonté par capture). Cette barre
 *    RÉPLIQUE ce même texte/lien dans une zone alignée à la largeur exacte
 *    de la sidebar (`w-64`, avec une bordure qui continue visuellement la
 *    sienne). Cachée sous `md:` : la sidebar elle-même est hors-écran par
 *    défaut sur mobile (`-translate-x-full`), donc rien à imiter à cette
 *    largeur.
 * 3. BUG RÉEL CORRIGÉ : sur les pages où le contenu de la sidebar est plus
 *    court (ex. "Profil Athlétique", moins de liens actifs que "Mes
 *    Séances"), son crédit d'origine remonte plus haut et n'est alors PLUS
 *    recouvert par cette barre — les deux crédits (l'original ET la
 *    réplique) s'affichaient donc EN MÊME TEMPS, empilés, visiblement en
 *    double. `isVisible` ne suffisait pas à lui seul à garantir l'illusion
 *    de continuité : il fallait aussi que Sidebar.jsx cache SON crédit
 *    original exactement dans les mêmes conditions où cette barre-ci
 *    l'affiche. D'où le changement ci-dessous : `isVisible` n'est plus
 *    calculé ICI (ça obligeait Sidebar.jsx à recalculer la même formule de
 *    son côté pour rester synchronisé — exactement le genre de duplication
 *    qui a fini par diverger et causer ce bug) mais reçu tout fait en prop,
 *    calculé UNE SEULE FOIS dans App.jsx et partagé avec Sidebar.jsx (voir
 *    son commentaire `guestBarVisible`, aussi utilisée pour réserver de la
 *    place en bas du menu — voir Sidebar.jsx). Une seule source de vérité pour "faut-il
 *    afficher la réplique / cacher l'original ?", plutôt que deux formules
 *    séparées censées toujours rester identiques.
 */
export default function GuestModeBar({ theme, isVisible, openModal }) {
  const { cardBg, cardBorder, textMuted, textColorClass } = theme;

  if (!isVisible) return null;

  return (
    <div className={`border-t ${cardBorder} ${cardBg} flex items-center`}>
      {/* Réplique du crédit de Sidebar.jsx — voir docstring ci-dessus.
          Texte/lien/style IDENTIQUES à Sidebar.jsx à dessein (illusion de
          continuité) : si ce texte change un jour dans Sidebar.jsx, penser à
          le reporter ici aussi.
          Bordure haute épaisse posée ICI (sur cette colonne w-64
          uniquement), pas sur le conteneur global — retour direct : seul ce
          segment, aligné avec la sidebar au-dessus, doit ressortir comme les
          autres bordures "macro" de structure ; le reste de la barre (côté
          "Mode invité") garde un tracé neutre. Couleur pleine (pas de
          transparence, contrairement à un essai précédent en `white/20` —
          trop translucide pour se distinguer d'un simple 1px à l'œil). */}
      <div className={`hidden md:block w-64 shrink-0 px-4 py-2 text-center border-r ${cardBorder} border-t-2 border-slate-300 dark:border-white/70`}>
        <a
          href="https://www.linkedin.com/in/damiengrange/"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-medium ${textMuted} hover:text-main transition-colors`}
        >
          Un projet créé par <span className="font-bold underline">Damien Grangé</span>
        </a>
      </div>
      <div className="flex-1 px-4 py-2 text-center">
        <p className={`text-xs ${textMuted}`}>
          Mode invité — données sauvegardées uniquement sur cet appareil.{' '}
          <button onClick={() => openModal('AUTH')} className={`inline-flex items-center gap-1 font-bold underline ${textColorClass}`}>
            <UserPlus size={11} /> Créer un compte
          </button>
        </p>
      </div>
    </div>
  );
}
