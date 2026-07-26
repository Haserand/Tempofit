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
 */
export default function GuestModeBar({ theme, isVisible, openModal }) {
  const { cardBg, textMuted, textColorClass } = theme;

  if (!isVisible) return null;

  return (
    <div className={`border-t-2 border-slate-200 dark:border-white/20 ${cardBg} flex items-center`}>
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
