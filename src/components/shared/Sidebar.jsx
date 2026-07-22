import { Heart, Activity, Sun, Moon, X, Zap, Gauge, ListPlus, List, Star, Settings, Compass } from 'lucide-react';

/**
 * Sidebar — navigation principale (logo, toggle thème clair/sombre, liens
 * vers les vues, crédit en bas de page). Extrait de App.jsx (retour direct :
 * "prends du recul sur le code, comment tu diviserais App.jsx ?" — 3e et
 * dernier chantier de cette série, après les 8 modales et le moteur
 * Spotify).
 *
 * Extraction pure : les tokens de couleur (`cardBorder`, `bgAccentClass`...)
 * arrivent en props individuelles plutôt que via `theme={themeTokens}` —
 * contrairement aux modales (qui utilisaient `theme.x` en interne), la
 * sidebar les consommait déjà directement, un à un, dans App.jsx ; garder la
 * même forme évite de réécrire chaque usage pour un gain minime.
 */
export default function Sidebar({
  cardBorder, bgAccentClass, isNaughtyMode, textHighlight, textColorClass, textMuted,
  theme, toggleTheme,
  isMobileMenuOpen, setIsMobileMenuOpen,
  changeView, view,
  showAthleticProfile, setShowAthleticProfile,
  favorites,
  hasActiveTrack,
}) {
  return (
    // `fixed inset-y-0` : cette aside est positionnée par rapport au VIEWPORT,
    // pas par rapport à un ancêtre — un padding-bottom posé plus haut dans
    // l'arbre (sur AppContent) n'aurait donc AUCUN effet ici. `hasActiveTrack`
    // (App.jsx, useAudioPlayer()) pilote directement ce pb-32 : quand
    // MiniPlayerBar (fixed bottom-0, voir MiniPlayerBar.jsx) est affichée,
    // elle recouvrirait sinon le bloc crédits tout en bas (bug signalé :
    // "Options & Comptes"/crédits caché par le lecteur). Même valeur (pb-32)
    // que le <main> dans App.jsx, pour que les 2 s'arrêtent à la même hauteur.
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r ${cardBorder} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${hasActiveTrack ? 'pb-32' : ''}`}>
      <div className={`p-6 border-b ${cardBorder} flex items-center justify-between`}>
         <button
           onClick={() => changeView('generator')}
           title="Retour à l'accueil"
           className="flex items-center space-x-3 cursor-pointer"
         >
            <div className={`${bgAccentClass} p-1.5 rounded-lg transition-colors duration-500 ${isNaughtyMode ? 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>
              {isNaughtyMode ? <Heart size={20} className="text-white fill-white" /> : <Activity size={20} className="text-white" />}
            </div>
            <span className={`font-bold text-xl tracking-tight leading-none ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
         </button>
         <div className="flex items-center gap-1">
           <button
             onClick={toggleTheme}
             title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
             className={`p-2 rounded-lg transition-colors ${textMuted} hover:bg-surface-hover hover:text-main`}
           >
             {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
           </button>
           <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
         </div>
      </div>

      {/* `select-none` sur chaque bouton ci-dessous (retour utilisateur) : sans ça,
          le texte des libellés (ex. "Mes Séances") reste sélectionnable comme du
          texte normal, donc le curseur affiche un I-beam (texte éditable) au survol
          du label — trompeur pour un bouton, même si le clic fonctionnait déjà
          correctement partout. `cursor-pointer` ajouté en plus par sécurité (déjà
          le comportement par défaut d'un <button>, mais explicite plutôt qu'implicite). */}
      <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto no-scrollbar">

        <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
          <span className="font-bold text-sm">Générer</span>
        </button>

        {/* Sous-menu de "Générer" (retour direct : "personne ne le verra dans
            Options & Comptes", puis "j'imaginais ça en sous-menu de Générer") —
            indenté et en retrait visuel (pas de pastille pleine, icône/texte
            plus petits, léger décalage à gauche) pour bien signaler que ce
            n'est pas une section de même niveau que les autres, mais une
            sous-partie de "Générer" spécifiquement. Ouvre directement le
            panneau (voir showAthleticProfile, remonté dans App.jsx) plutôt que
            d'atterrir sur Générer avec le panneau encore replié. */}
        <button
          onClick={() => { changeView('generator'); setShowAthleticProfile(true); }}
          className={`w-full flex items-center space-x-2.5 pl-8 pr-3 py-2 rounded-lg transition-colors select-none cursor-pointer ${view === 'generator' && showAthleticProfile ?
            `${textColorClass} bg-surface-hover font-bold` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}
        >
          <Gauge size={15} className="shrink-0" />
          <span className="text-xs font-semibold">Mon Profil Athlétique</span>
        </button>

        <button onClick={() => changeView('discover')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'discover' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <Compass size={18} />
          <span className="font-bold text-sm">Découvrir</span>
        </button>

        <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'routines' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <ListPlus size={18} />
          <span className="font-bold text-sm">Mes Routines</span>
        </button>

        <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <List size={18} />
          <span className="font-bold text-sm">Mes Séances</span>
        </button>

        <button onClick={() => changeView('stats')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <Activity size={18} />
          <span className="font-bold text-sm">Statistiques</span>
        </button>

        <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : ""} />
          <span className="font-bold text-sm">Mes Favoris</span>
        </button>

        <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'settings' ? `bg-surface-hover ${textHighlight}` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
          <Settings size={18} />
          <span className="font-bold text-sm">Options & Comptes</span>
        </button>

      </nav>

      {/* Crédit du projet, en bas de la sidebar — discret, ouvre dans un nouvel onglet
          pour ne pas faire quitter l'app en un clic accidentel.
          `mt-auto` : déjà poussé en bas aujourd'hui par le `flex-1` de <nav>
          juste au-dessus (un seul enfant qui grandit dans ce flex-col suffit
          à coller celui-ci en bas) — ajouté quand même explicitement ici,
          pour que ce bloc reste ancré en bas MÊME si <nav> perd un jour son
          flex-1 (ex. contenu qui dépasse et qu'on passe en scroll interne
          sans flex-1), plutôt que de dépendre implicitement d'un réglage
          fait sur un autre élément. */}
      <div className={`mt-auto px-4 py-4 border-t ${cardBorder} text-center`}>
        <a
          href="https://www.linkedin.com/in/damiengrange/"
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-medium ${textMuted} hover:text-main transition-colors`}
        >
          Un projet créé par <span className="font-bold underline">Damien Grangé</span>
        </a>
      </div>
    </aside>
  );
}
