import { Heart, Activity, X, Zap, List, Star, Settings, Trophy, ListPlus, Compass, Gauge } from 'lucide-react';

/**
 * Sidebar — navigation principale (logo, bouton Trophées si connecté, liens
 * vers les vues, crédit en bas de page). Extrait de App.jsx (retour direct :
 * "prends du recul sur le code, comment tu diviserais App.jsx ?").
 *
 * REFONTE UX/UI (25/07, suggestion Gemini, vérifiée puis appliquée) —
 * aplatissement de l'architecture : "Mes Routines"/"Découvrir"/"Mon Profil
 * Athlétique" vivaient avant en sous-menus décalés (`pl-[42px]`, style texte
 * pur sans icône) sous "Générer"/"Bibliothèque" — invisibles au premier coup
 * d'œil et pénibles sur mobile/tablette (pas de survol pour les révéler).
 * Tous les liens sont maintenant au même niveau, regroupés par INTENTION
 * sous 3 en-têtes discrets plutôt que par imbrication visuelle :
 * CRÉATION (démarrer quelque chose de nouveau), MON ESPACE (consulter ce qui
 * existe déjà), RÉGLAGES (configuration, séparé par une bordure + `mt-auto`
 * comme avant). Tous les boutons partagent maintenant le même style actif
 * (`bgAccentClass text-white shadow-lg`) — avant, seul "Générer" l'avait,
 * les autres utilisaient un simple `bg-surface-hover` plus discret, une
 * incohérence sans raison fonctionnelle.
 *
 * Renommages associés : "Générer" → "Nouvelle séance" (plus explicite sur ce
 * que fait ce bouton) ; "Bibliothèque" → "Mes Séances" (revient au nom déjà
 * utilisé PARTOUT ailleurs dans l'app — info-bulles, description de trophée,
 * aide contextuelle dans StatsView — seul le titre de page disait encore
 * "Bibliothèque", une incohérence interne pas voulue ; voir PlaylistsView.jsx).
 *
 * Extraction pure : les tokens de couleur (`cardBorder`, `bgAccentClass`...)
 * arrivent en props individuelles plutôt que via `theme={themeTokens}` —
 * contrairement aux modales (qui utilisaient `theme.x` en interne), la
 * sidebar les consommait déjà directement, un à un, dans App.jsx ; garder la
 * même forme évite de réécrire chaque usage pour un gain minime.
 *
 * RETOUR DIRECT (inversion Thème/Trophées, "un header épuré pour les
 * visiteurs") — le basculeur de thème (Sun/Moon) qui vivait ici est parti
 * dans App.jsx, à côté de "Se connecter"/l'avatar (coin haut-droit) ; le
 * bouton Trophées (qui vivait là-bas) arrive ici, à côté du logo — mais
 * SEULEMENT si `user` (connecté), contrairement à avant où il était visible
 * inconditionnellement : un badge de progression n'a de sens que pour
 * quelqu'un qui a un compte pour le conserver d'une session à l'autre.
 */
export default function Sidebar({
  cardBorder, bgAccentClass, isNaughtyMode, textHighlight, textColorClass, textMuted,
  isMobileMenuOpen, setIsMobileMenuOpen,
  changeView, view,
  showAthleticProfile, setShowAthleticProfile,
  favorites,
  user, userStats,
}) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r ${cardBorder} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`p-6 border-b ${cardBorder} flex items-center justify-between`}>
         {/* Logo cliquable = retour à l'accueil ("Nouvelle séance") — referme
             aussi le Profil Athlétique s'il était ouvert (comportement
             identique au bouton "Nouvelle séance" ci-dessous, pour que le
             logo ne soit pas un raccourci à moitié fonctionnel qui laisserait
             le Profil Athlétique affiché malgré `view === 'generator'`). */}
         <button
           onClick={() => { changeView('generator'); setShowAthleticProfile(false); }}
           title="Retour à l'accueil"
           className="flex items-center space-x-3 cursor-pointer"
         >
            <div className={`${bgAccentClass} p-1.5 rounded-lg transition-colors duration-500 ${isNaughtyMode ? 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>
              {isNaughtyMode ? <Heart size={20} className="text-white fill-white" /> : <Activity size={20} className="text-white" />}
            </div>
            <span className={`font-bold text-xl tracking-tight leading-none ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
         </button>
         <div className="flex items-center gap-1">
           {/* Bouton Trophées — même comportement qu'avant son déménagement
               (discret/gris tant qu'aucun trophée n'est débloqué, doré +
               badge du nombre sinon, pour garder l'effet de surprise/
               récompense au 1er déblocage sans le rendre invisible) — SEUL
               changement réel : `user &&` en plus, un visiteur non connecté
               ne voit plus ce bouton du tout. */}
           {user && (
             <button
               onClick={() => changeView('trophies')}
               title="Trophées"
               className={`relative p-2 rounded-lg transition-colors ${
                 userStats.unlockedTrophies.length > 0
                   ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                   : `${textMuted} hover:bg-surface-hover hover:text-main`
               }`}
             >
               <Trophy size={18} className={userStats.unlockedTrophies.length > 0 ? "fill-yellow-500" : ""} />
               {userStats.unlockedTrophies.length > 0 && (
                 <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                   {userStats.unlockedTrophies.length}
                 </span>
               )}
             </button>
           )}
           <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
         </div>
      </div>

      {/* `select-none` sur chaque bouton (retour utilisateur, hérité de
          l'ancienne version) : sans ça, le texte des libellés reste
          sélectionnable comme du texte normal, donc le curseur affiche un
          I-beam (texte éditable) au survol du label — trompeur pour un
          bouton, même si le clic fonctionnait déjà correctement partout.
          `cursor-pointer` ajouté en plus par sécurité (déjà le comportement
          par défaut d'un <button>, mais explicite plutôt qu'implicite).

          3 clusters par INTENTION (voir docstring en haut de fichier), chacun
          un conteneur `flex flex-col space-y-1` (espacement interne serré)
          séparé du suivant par `mb-8`/`mt-8` (respiration nette, constante,
          entre groupes — jamais la même valeur qu'à l'intérieur d'un groupe).
          Tous les boutons — plus de distinction "top-level" vs "sous-menu",
          plus d'icône manquante ou de décalage `pl-[42px]` à maintenir en
          synchronisation avec la largeur du parent. */}
      <nav className="flex-1 flex flex-col px-4 py-6 overflow-y-auto no-scrollbar">

        {/* --- CRÉATION --- */}
        <div className="flex flex-col space-y-1 mb-8">
          <div className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Création</div>

          <button onClick={() => { changeView('generator'); setShowAthleticProfile(false); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' && !showAthleticProfile ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Zap size={18} className={view === 'generator' && !showAthleticProfile ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Nouvelle séance</span>
          </button>

          <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'routines' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <ListPlus size={18} className={view === 'routines' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Routines</span>
          </button>

          <button onClick={() => changeView('discover')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'discover' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Compass size={18} className={view === 'discover' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Découvrir</span>
          </button>
        </div>

        {/* --- MON ESPACE --- */}
        <div className="flex flex-col space-y-1 mb-8">
          <div className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Mon Espace</div>

          <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <List size={18} className={view === 'playlists' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Séances</span>
          </button>

          <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : (view === 'favorites' ? 'text-white' : '')} />
            <span className="font-bold text-sm">Mes Favoris</span>
          </button>

          <button onClick={() => changeView('stats')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Activity size={18} className={view === 'stats' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Statistiques</span>
          </button>
        </div>

        {/* --- RÉGLAGES --- */}
        <div className={`mt-auto flex flex-col space-y-1 pt-4 border-t ${cardBorder}`}>
          <div className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-wider ${textMuted}`}>Réglages</div>

          {/* Masqué en Mode Intime (retour direct : "n'a aucun sens
              fonctionnel dans ce mode et affiche une page vide") — le Profil
              Athlétique configure des zones de BPM par activité SPORTIVE
              (Course à pied/Cyclisme/Musculation), un concept sans équivalent
              en Mode Intime (workoutType y est toujours "Ambiance", jamais
              une vraie activité — voir PlaylistDetailContext.jsx/appConfig.js).
              Voir aussi useNavigation.js pour le filet de sécurité qui
              referme ce panneau automatiquement si l'utilisateur bascule en
              Mode Intime pendant qu'il y est. */}
          {!isNaughtyMode && (
            <button onClick={() => { changeView('generator'); setShowAthleticProfile(true); }} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' && showAthleticProfile ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
              <Gauge size={18} className={view === 'generator' && showAthleticProfile ? 'text-white' : textColorClass} />
              <span className="font-bold text-sm">Profil Athlétique</span>
            </button>
          )}

          <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-colors select-none cursor-pointer ${view === 'settings' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
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
