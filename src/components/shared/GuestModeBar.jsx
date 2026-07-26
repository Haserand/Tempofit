import { UserPlus } from 'lucide-react';

/**
 * GuestModeBar — barre pleine largeur, fixée en bas de l'écran, rappelant à
 * un utilisateur non connecté que ses données ne sont sauvegardées que sur
 * cet appareil. Extraite d'App.jsx (25/07, même principe que MiniPlayerBar :
 * composant qui décide LUI-MÊME s'il doit s'afficher — `if (!isVisible)
 * return null` — plutôt qu'un `{condition && <GuestModeBar/>}` répété côté
 * App.jsx à chaque futur changement de condition).
 *
 * HISTORIQUE COURT (25/07, même session) :
 * 1. Un premier essai vivait DANS Sidebar.jsx — retour direct de
 *    l'utilisateur : "pas dans la sidebar, ça surcharge le menu, plutôt une
 *    barre horizontale pleine largeur". Entièrement retiré de là-bas.
 * 2. Cette barre (fixed, pleine largeur, z-[65]) passe PAR-DESSUS la
 *    Sidebar (fixed, z-50) dans leur zone commune en bas-gauche de l'écran —
 *    ce qui recouvrait le crédit "Un projet créé par..." de la sidebar
 *    (bug remonté par capture). Plutôt que de complexifier Sidebar.jsx pour
 *    qu'elle cache conditionnellement son propre crédit, cette barre RÉPLIQUE
 *    ce même texte/lien dans une zone alignée à la largeur exacte de la
 *    sidebar (`w-64`, avec une bordure qui continue visuellement la sienne)
 *    — l'utilisateur ne voit jamais la disparition, juste une continuité.
 *    Cachée sous `md:` : la sidebar elle-même est hors-écran par défaut sur
 *    mobile (`-translate-x-full`), donc rien à imiter à cette largeur.
 *    Pour un utilisateur CONNECTÉ, cette barre entière ne s'affiche jamais
 *    (voir `isVisible` ci-dessous) — le crédit reste normalement visible
 *    dans la sidebar, sans recouvrement possible, sans besoin de réplique.
 *
 * `savedPlaylists`/`routines` (pas juste `user`) : reprend l'esprit "Soft
 * Gating" d'origine (voir PlaylistsView.jsx/StatsView.jsx) — rien à perdre
 * encore, pas la peine d'alerter dès la toute première visite. Un seul
 * signal combiné couvrant playlists ET routines plutôt que deux conditions
 * différentes vivant chacune dans leur propre vue (c'était le bug initial :
 * ce bandeau n'apparaissait que sur certaines pages). Volontairement PAS basé
 * sur `favorites` : 2 artistes de démo y sont pré-remplis dès l'installation
 * (voir useFavorites.js), ce qui rendrait la condition vraie en permanence.
 */
export default function GuestModeBar({ theme, user, savedPlaylists, routines, openModal }) {
  const { cardBg, cardBorder, textMuted, textColorClass } = theme;

  const isVisible = !user && (savedPlaylists.length > 0 || routines.length > 0);
  if (!isVisible) return null;

  return (
    <div className={`border-t ${cardBorder} ${cardBg} flex items-center`}>
      {/* Réplique du crédit de Sidebar.jsx — voir docstring ci-dessus.
          Texte/lien/style IDENTIQUES à Sidebar.jsx à dessein (illusion de
          continuité) : si ce texte change un jour dans Sidebar.jsx, penser à
          le reporter ici aussi. */}
      <div className={`hidden md:block w-64 shrink-0 px-4 py-2 text-center border-r ${cardBorder}`}>
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
