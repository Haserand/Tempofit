import { Heart, Activity, Sun, Moon, X, Zap, List, Star, Settings } from 'lucide-react';

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
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r ${cardBorder} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
          le texte des libellés (ex. "Bibliothèque") reste sélectionnable comme du
          texte normal, donc le curseur affiche un I-beam (texte éditable) au survol
          du label — trompeur pour un bouton, même si le clic fonctionnait déjà
          correctement partout. `cursor-pointer` ajouté en plus par sécurité (déjà
          le comportement par défaut d'un <button>, mais explicite plutôt qu'implicite).

          Polish "Pixel Perfect" (retour direct, 2 corrections) :
          1. État actif des boutons de premier niveau : la bordure gauche
             (`border-l-2` + couleur conditionnelle) est retirée — elle créait un
             artefact disgracieux sur les angles arrondis d'un bouton "pilule".
             L'état actif ne repose plus QUE sur `bg-surface-hover` + `text-white
             font-medium`, jamais de bordure sur une forme arrondie.
          2. Rythme vertical : chaque cluster est un conteneur `flex flex-col
             space-y-1` (espacement interne serré, loi de proximité) séparé du
             suivant par `mt-8` (respiration nette, constante, entre groupes —
             jamais la même valeur qu'à l'intérieur d'un groupe). */}
      <nav className="flex-1 flex flex-col px-4 py-6 overflow-y-auto no-scrollbar">

        {/* Cluster 1 — Création */}
        <div className="flex flex-col space-y-1">
          <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Générer</span>
          </button>

          {/* Sous-menu de "Générer" — precision alignement (retour direct,
              "la 1ère lettre du sous-menu doit tomber pile sous la 1ère lettre
              du parent") : le parent a `px-3` (12px) + icône 18px + `space-x-3`
              (12px) avant son texte = 42px de décalage total avant la 1ère
              lettre. `pl-[42px]` reproduit EXACTEMENT cette valeur (une classe
              standard comme `pl-10`/`pl-11` retomberait à 40px/44px, un décalage
              visible au pixel près) — plus d'icône ici (voir plus bas), donc
              rien d'autre ne doit compenser cet espace. `mt-0.5` : à peine plus
              que le `space-y-1` (4px) du reste du cluster, pour coller le 1er
              sous-menu à son parent un cran plus fort qu'un item de même
              niveau. Style texte pur (`text-sm text-slate-400 hover:text-white`,
              sans fond au survol) : hiérarchie secondaire clairement lisible,
              plus un bouton "pilule" miniature. */}
          <button
            onClick={() => { changeView('generator'); setShowAthleticProfile(true); }}
            className={`w-full text-left pl-[42px] pr-3 py-1.5 mt-0.5 rounded-lg transition-colors select-none cursor-pointer text-sm ${view === 'generator' && showAthleticProfile ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
          >
            Mon Profil Athlétique
          </button>
        </div>

        {/* Cluster 2 — Bibliothèque (Découvrir et Mes Routines en sous-menus,
            imbrication finale : les 3 partagent la même racine "où sont mes
            musiques/séances", Découvrir pour en trouver de nouvelles, Routines
            pour en générer automatiquement, Bibliothèque pour les consulter). */}
        <div className="flex flex-col space-y-1 mt-8">
          <button
            onClick={() => changeView('playlists')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? 'bg-surface-hover text-white font-medium' : `${textMuted} hover:bg-surface-hover hover:text-main`}`}
          >
            <List size={18} className={view === 'playlists' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Bibliothèque</span>
          </button>

          {/* Sous-menus de "Bibliothèque" — mêmes classes exactement que
              "Mon Profil Athlétique" ci-dessus (alignement `pl-[42px]`, style
              texte pur, `mt-0.5` sur le 1er) pour une hiérarchie visuelle
              identique partout dans la sidebar. */}
          <button
            onClick={() => changeView('discover')}
            className={`w-full text-left pl-[42px] pr-3 py-1.5 mt-0.5 rounded-lg transition-colors select-none cursor-pointer text-sm ${view === 'discover' ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
          >
            Découvrir
          </button>

          <button
            onClick={() => changeView('routines')}
            className={`w-full text-left pl-[42px] pr-3 py-1.5 rounded-lg transition-colors select-none cursor-pointer text-sm ${view === 'routines' ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
          >
            Mes Routines
          </button>
        </div>

        {/* Cluster 3 — Consultation */}
        <div className="flex flex-col space-y-1 mt-8">
          <button
            onClick={() => changeView('stats')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? 'bg-surface-hover text-white font-medium' : `${textMuted} hover:bg-surface-hover hover:text-main`}`}
          >
            <Activity size={18} className={view === 'stats' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Statistiques</span>
          </button>

          <button
            onClick={() => changeView('favorites')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? 'bg-surface-hover text-white font-medium' : `${textMuted} hover:bg-surface-hover hover:text-main`}`}
          >
            <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : (view === 'favorites' ? 'text-white' : '')} />
            <span className="font-bold text-sm">Mes Favoris</span>
          </button>
        </div>

        {/* "Options & Comptes" séparé du reste de la navigation principale —
            `mt-auto` le pousse tout en bas du <nav> (qui est lui-même en
            flex-col), une ligne fine au-dessus marque clairement la bascule
            "navigation" -> "réglages". */}
        <div className={`mt-auto pt-4 border-t ${cardBorder}`}>
          <button
            onClick={() => changeView('settings')}
            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'settings' ? 'bg-surface-hover text-white font-medium' : `${textMuted} hover:bg-surface-hover hover:text-main`}`}
          >
            <Settings size={18} className={view === 'settings' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Options & Comptes</span>
          </button>
        </div>

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
