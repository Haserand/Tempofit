import { Heart, Activity, X, Zap, List, Star, Settings, Trophy, ListPlus, Compass, Sun, Moon } from 'lucide-react';
import { MINI_PLAYER_BAR_HEIGHT_PX, GUEST_MODE_BAR_HEIGHT_PX } from '../../bottomBarLayout';

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
 * visiteurs", 25/07) — le basculeur de thème (Sun/Moon) était parti dans
 * App.jsx, à côté de "Se connecter"/l'avatar (coin haut-droit) ; le bouton
 * Trophées (qui vivait là-bas) était arrivé ici, à côté du logo — mais
 * SEULEMENT si `user` (connecté), contrairement à avant où il était visible
 * inconditionnellement : un badge de progression n'a de sens que pour
 * quelqu'un qui a un compte pour le conserver d'une session à l'autre.
 *
 * RE-RELOCALISATION (Fix UI, 27/07, "nettoyage global") — le bouton Thème
 * REVIENT ici, à côté de Trophées : le coin haut-droit flottant d'App.jsx
 * entrait en collision avec les cartes pleine largeur (ex. PlaylistHeader.jsx,
 * même session) — regrouper les 2 utilitaires (Trophées + Thème) dans le
 * header FIXE de la Sidebar élimine ce risque de collision une bonne fois
 * pour toutes, quelle que soit la vue affichée. Contrairement à Trophées,
 * le bouton Thème reste inconditionnel (pas de `user &&`) : le thème
 * clair/sombre concerne tout visiteur, connecté ou non.
 */
export default function Sidebar({
  cardBorder, cardBorderStrong, bgAccentClass, isNaughtyMode, textHighlight, textColorClass, textMuted,
  isMobileMenuOpen, setIsMobileMenuOpen,
  changeView, view,
  favorites,
  user, userStats,
  guestBarVisible, playerBarVisible,
  toggleNaughtyMode,
  theme, toggleTheme,
}) {
  // BUG CORRIGÉ (25/07, retour direct : "je ne peux pas cliquer sur Options
  // & Comptes quand le lecteur audio est actif") — le padding précédent
  // (`pb-10` conditionnel) ne réservait de la place QUE pour GuestModeBar.jsx
  // seule ; il ne tenait pas compte de MiniPlayerBar.jsx, qui vient
  // s'empiler AU-DESSUS de GuestModeBar dans le même conteneur `fixed` (voir
  // App.jsx). Quand les deux sont visibles en même temps, la pile du bas
  // est plus haute que ce que la sidebar réservait, et vient recouvrir
  // "Options & Comptes".
  // Valeurs resserrées (25/07, retour direct suivant : "dommage d'avoir
  // tout cet espace inutilisé") — un premier essai reprenait telles quelles
  // les hauteurs `h-40`/`h-10` du spacer utilisé pour le CONTENU PRINCIPAL
  // (`<main>`, App.jsx), qui inclut volontairement une marge de sécurité
  // généreuse (contenu qui défile, hauteur moins prévisible — voir son
  // commentaire). La sidebar n'a pas ce problème : ses éléments ont une
  // hauteur fixe et connue, pas besoin d'autant de coussin — additionner
  // les 2 marges de sécurité (160+40=200px) donnait un espace vide bien
  // plus grand que nécessaire. Resserré à des valeurs plus fidèles à la
  // hauteur réelle des 2 barres (MiniPlayerBar ~70px, GuestModeBar ~40px),
  // tout en gardant un peu de marge plutôt qu'une valeur pile ajustée au
  // pixel.
  // Layout Dashboard (27/07) : ne sert plus QU'EN MOBILE — sur desktop, ces
  // barres ne recouvrent plus la Sidebar (calées à sa droite, voir App.jsx),
  // donc plus besoin de lui réserver de la place ; neutralisé à partir de
  // `md` via `md:pb-0` posé directement sur le <aside> plus bas, plutôt que
  // de complexifier cette formule elle-même avec une notion de breakpoint.
  const bottomBarPadding = playerBarVisible && guestBarVisible
    ? 'pb-28'
    : playerBarVisible
      ? 'pb-20'
      : guestBarVisible
        ? 'pb-10'
        : '';

  // Hauteur RÉELLE (en px) des barres du bas actuellement visibles — miroir
  // de bottomBarPadding ci-dessus, mais en pixels exacts plutôt qu'en classe
  // Tailwind arrondie : sert à synchroniser la hauteur de la case crédit
  // juste plus bas, pas à réserver un espace vide.
  // MINI_PLAYER_BAR_HEIGHT_PX/GUEST_MODE_BAR_HEIGHT_PX importées depuis
  // bottomBarLayout.js (27/07) — seule source de vérité pour ces 2 nombres,
  // partagée avec les classes Tailwind `h-[90px]`/`h-[40px]` de
  // MiniPlayerBar.jsx/GuestModeBar.jsx (qui, elles, DOIVENT rester écrites
  // en dur — voir bottomBarLayout.js pour la contrainte Tailwind derrière ce
  // choix). `null` = aucune barre visible, la case crédit garde sa hauteur
  // naturelle (basée sur son padding).
  const creditRowHeight = playerBarVisible && guestBarVisible
    ? MINI_PLAYER_BAR_HEIGHT_PX + GUEST_MODE_BAR_HEIGHT_PX
    : playerBarVisible
      ? MINI_PLAYER_BAR_HEIGHT_PX
      : guestBarVisible
        ? GUEST_MODE_BAR_HEIGHT_PX
        : null;

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-surface border-r-2 ${cardBorderStrong} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${bottomBarPadding} md:pb-0`}>
      <div className={`p-6 mb-2 border-b-2 ${cardBorderStrong} flex items-center justify-between shrink-0`}>
         {/* Logo cliquable = retour à l'accueil ("Nouvelle séance"). */}
         <button
           onClick={() => changeView('generator')}
           title="Retour à l'accueil"
           className="flex items-center space-x-3 cursor-pointer"
         >
            <div className={`${bgAccentClass} p-1.5 rounded-lg transition-colors duration-500 ${isNaughtyMode ? 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>
              {isNaughtyMode ? <Heart size={28} className="text-white fill-white" /> : <Activity size={28} className="text-white" />}
            </div>
            <span className={`font-bold text-2xl tracking-tight leading-none ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
         </button>
         <div className="flex items-center gap-2">
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
           {/* Bouton Thème — relocalisé depuis App.jsx (Fix UI 27/07, "nettoyage
               global") : vivait avant `absolute top-4 right-4` en haut de
               `<main>`, ce qui pouvait entrer en collision avec le contenu des
               cartes pleine largeur (voir PlaylistHeader.jsx, même session).
               Ici, à côté de Trophées, dans le header FIXE de la Sidebar :
               plus jamais de superposition possible avec le contenu, quelle
               que soit la vue. Visible inconditionnellement (pas de `user &&`
               comme Trophées) — le thème clair/sombre concerne tout le monde,
               connecté ou non. */}
           <button
             onClick={toggleTheme}
             title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
             className={`p-2 rounded-lg transition-colors ${textMuted} hover:bg-surface-hover hover:text-main`}
           >
             {theme === 'dark' ? <Sun size={20} strokeWidth={2} /> : <Moon size={20} strokeWidth={2} />}
           </button>
           <button className="md:hidden text-gray-500 hover:text-gray-900 dark:hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
         </div>
      </div>

      {/* Sortie du Mode Intime, TOUJOURS accessible (25/07, retour direct :
          "une fois en mode intime il faudrait toujours avoir une option
          pour revenir à la normale") — avant ça, `toggleNaughtyMode` n'était
          câblé qu'à UN SEUL endroit dans toute l'app (une petite icône dans
          un coin de carte, à l'étape 1 du wizard de génération) : en
          Mode Intime sur n'importe quelle autre page (Statistiques, Mes
          Séances, Profil Athlétique...), aucun moyen d'en sortir sans
          retourner spécifiquement à cet endroit précis — un vrai trou, pas
          juste une gêne. Placé ici, dans la Sidebar (présente sur toutes
          les pages), donc toujours atteignable quel que soit l'endroit où
          le Mode Intime a été activé. */}
      {/* Zone scrollable centrale (défile indépendamment du logo et des
          Réglages, qui restent fixes) — corrige le bug d'ergonomie sur petit
          écran où "Options & Comptes" pouvait se retrouver poussé hors de
          la zone visible : avant cette refonte, TOUT (Création, Mon Espace,
          Réglages) vivait dans le même conteneur `flex-1 overflow-y-auto`,
          et Réglages n'était "collé en bas" que par un `mt-auto` interne à
          ce même conteneur — donc lui aussi poussé hors champ si le contenu
          au-dessus dépassait la hauteur disponible. `px-4` (absent de la
          demande initiale mais nécessaire) : remplace le padding horizontal
          qu'apportait jusqu'ici le conteneur unique qu'on scinde ici. */}
      <div className="flex-1 overflow-y-auto no-scrollbar py-2 px-4">
      {isNaughtyMode && (
        <div className={`py-2 border-b ${cardBorder}`}>
          {/* Mêmes classes que les boutons du menu juste en dessous
              (`px-3 py-2`, icône 18px, `text-sm font-bold`) — retour direct :
              "démarrer au même point horizontal, même taille de police" —
              plutôt qu'un style à part. */}
          <button
            onClick={toggleNaughtyMode}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer text-rose-500 hover:bg-rose-500/10"
          >
            <Heart size={18} className="fill-rose-500" />
            <span className="font-bold text-sm">Quitter le Mode Intime</span>
          </button>
        </div>
      )}

      {/* `select-none` sur chaque bouton (retour utilisateur, hérité de
          l'ancienne version) : sans ça, le texte des libellés reste
          sélectionnable comme du texte normal, donc le curseur affiche un
          I-beam (texte éditable) au survol du label — trompeur pour un
          bouton, même si le clic fonctionnait déjà correctement partout.
          `cursor-pointer` ajouté en plus par sécurité (déjà le comportement
          par défaut d'un <button>, mais explicite plutôt qu'implicite).

          3 clusters par INTENTION (voir docstring en haut de fichier), chacun
          un conteneur `flex flex-col space-y-1` (espacement interne serré).
          Hiérarchie des en-têtes de section renforcée (28/07, retour direct :
          "CRÉATION/MON ESPACE/RÉGLAGES manquent de distinction, se font
          écraser par les boutons actifs") — typographie "chapeau de
          section" (`text-[10px] sm:text-xs uppercase tracking-widest
          font-bold`, ${'${textMuted}'} — PAS de slate-500/400 codé en dur :
          textMuted est le token déjà adaptatif clair/sombre ET Mode Intime,
          voir useTheme.js, un hardcode perdrait ce dernier réglage) +
          respiration portée par l'en-tête de "Mon Espace" (`mt-4` — voir
          plus bas), plutôt que `mb-8` sur le conteneur "Création" précédent
          comme avant, pour ne jamais l'additionner deux fois entre les 2
          sections.
          Densité verticale resserrée EN 2 PASSES (28/07, retour direct :
          "Mes Favoris passe sous la ligne de flottaison à 100% de zoom") —
          1re passe : `py-3` → `py-2.5`, "Mon Espace" `mt-8` → `mt-6`,
          uniquement dans la zone SCROLLABLE (Création + Mon Espace + le
          toggle Mode Intime juste au-dessus), footer RÉGLAGES pas touché
          (hors budget de hauteur, symétrie Boy Scout préservée). Insuffisant
          (retour direct : "toujours coupé") — 2e passe, plus agressive :
          `py-2.5` → `py-2` PARTOUT, y COMPRIS le footer RÉGLAGES ; en-têtes
          "Création"/"Mon Espace" : `mb-3` → `mb-1.5`, "Mon Espace"
          `mt-6` → `mt-4`.
          3e passe — DÉCOMPRESSION assumée (28/07, retour direct suivant :
          "la Sidebar a perdu son élégance") — la fusion du footer Réglages
          en un seul bouton (voir plus bas) a entre-temps libéré assez de
          hauteur pour ne plus avoir besoin de la 2e passe : `py-2` →
          `py-2.5` à nouveau PARTOUT (liens de nav + Réglages), `space-y-1`
          → `space-y-2`, en-têtes `mb-1.5` → `mb-3`. "Mon Espace" `mt-4`
          délibérément PAS remonté à `mt-6` (pas demandé cette fois, et la
          fusion du footer a changé l'équation de hauteur disponible —
          inutile de redonner tout ce qu'avait pris la 2e passe). */}
      <nav className="flex flex-col">

        {/* --- CRÉATION --- */}
        <div className="flex flex-col space-y-2">
          <div className={`px-3 mb-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold ${textMuted}`}>Création</div>

          <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Nouvelle séance</span>
          </button>

          <button onClick={() => changeView('routines')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'routines' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <ListPlus size={18} className={view === 'routines' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Routines</span>
          </button>

          <button onClick={() => changeView('discover')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'discover' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Compass size={18} className={view === 'discover' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Découvrir</span>
          </button>
        </div>

        {/* --- MON ESPACE --- */}
        <div className="flex flex-col space-y-2 mb-8">
          <div className={`px-3 mt-4 mb-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold ${textMuted}`}>Mon Espace{!user && ' • Invité'}</div>

          <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <List size={18} className={view === 'playlists' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Séances</span>
          </button>

          <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : (view === 'favorites' ? 'text-white' : '')} />
            <span className="font-bold text-sm">Mes Favoris</span>
          </button>

          <button onClick={() => changeView('stats')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Activity size={18} className={view === 'stats' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Statistiques</span>
          </button>
        </div>

      </nav>
      </div>

      {/* Pied de page FIGÉ (shrink-0) — Réglages + crédit, toujours visibles
          sans avoir à faire défiler la zone centrale au-dessus. Avant cette
          refonte, les deux vivaient dans le même conteneur `flex-1
          overflow-y-auto` que Création/Mon Espace (voir le commentaire sur
          le wrapper scrollable plus haut) — c'est justement ce qui les
          rendait poussés hors champ sur petit écran. */}
      <div className="shrink-0">

        {/* --- RÉGLAGES --- */}
        {/* Fix UI Boy Scout (28/07, retour direct : "espace beaucoup trop
            grand par rapport au haut, bordure quasi invisible") — 2
            incohérences corrigées par rapport au header (`border-b-2
            ${cardBorderStrong}` + conteneur scrollable `py-2` avant
            "Création", voir plus haut) :
            1. Bordure passée de `border-t ${cardBorder}` (micro, 1px —
               pensée pour du contenu interne, pas pour séparer 2 BLOCS
               structurels) à `border-t-2 ${cardBorderStrong}` (macro, 2px —
               même token que la bordure du logo tout en haut).
            2. `mt-8` (ajouté par erreur lors du chantier hiérarchie des
               en-têtes, 27/07 — pensé pour séparer 2 sections DANS la même
               zone scrollable, pas pour l'espacement bordure-titre du
               footer) retiré de l'en-tête ; `pt-4` posé à la place sur CE
               conteneur. PAS `pt-2` (l'espacement du haut n'est pas QUE le
               `py-2` du conteneur scrollable — il s'additionne au `mb-2` du
               header du logo, posé APRÈS sa propre bordure : 8px + 8px =
               16px de bordure à texte en haut ; `pt-4` = 16px reproduit
               exactement ce total ici, pas une valeur approchante). */}
        <div className={`flex flex-col space-y-2 pt-4 pb-4 px-4 border-t-2 ${cardBorderStrong}`}>
          {/* Fix UI (28/07, retour direct : "Réglages ne doit pas attirer
              l'œil plus que Statistiques") — RETIRÉ : le style bouton
              PRIMAIRE (`view === 'settings' ? bgAccentClass text-white` — le
              même mécanisme actif/rouge que les autres liens de nav) que ce
              bouton avait hérité en copiant leurs classes. Volontairement
              une EXCEPTION à la convention "actif = accent" du reste de la
              Sidebar : ce bouton reste TOUJOURS dans son style discret par
              défaut (`${textMuted} hover:bg-surface-hover hover:text-main`),
              même quand `view === 'settings'` — Réglages n'est pas un point
              d'attention comme "Nouvelle séance", juste un accès utilitaire
              parmi d'autres. Padding vertical du CONTENEUR (`pt-4 pb-4`,
              symétrique) plutôt qu'un mélange pt-4/pas-de-pb comme avant
              (ligne de bordure du crédit juste en dessous — sans pb-4, le
              bouton collait contre elle alors qu'il respirait 16px côté
              bordure macro du dessus). */}
          <button onClick={() => changeView('settings')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-colors select-none cursor-pointer ${textMuted} hover:bg-surface-hover hover:text-main`}>
            <Settings size={18} className={textColorClass} />
            <span className="font-bold text-sm">Réglages</span>
          </button>
        </div>

        {/* Crédit du projet, en bas de la sidebar — discret, ouvre dans un nouvel onglet
            pour ne pas faire quitter l'app en un clic accidentel.
            Vit dans le même pied de page FIGÉ (shrink-0) que Réglages, juste
            au-dessus — plus besoin de `mt-auto` pour le pousser en bas : ce
            n'est plus un enfant d'un conteneur flex-1 à remplir, juste le 2e
            élément empilé d'un pied de page de hauteur naturelle, déjà
            ancré en bas de la sidebar par la structure flex-col en 3 blocs
            (header shrink-0 / zone scrollable flex-1 / ce pied de page
            shrink-0).
            TOUJOURS affiché désormais (27/07, layout Dashboard) — plus de
            condition `!guestBarVisible` : GuestModeBar.jsx ne recouvre plus
            jamais la Sidebar sur desktop (calée à sa droite,
            `md:left-64 md:w-[calc(100%-16rem)]` sur le conteneur commun,
            App.jsx) et n'affiche donc plus de réplique de ce crédit à
            synchroniser — ce bloc-ci est maintenant la SEULE source. */}
        <div
          className={`px-4 py-4 border-t-2 ${cardBorderStrong} text-center flex items-center justify-center`}
          style={creditRowHeight ? { height: `${creditRowHeight}px` } : undefined}
        >
          <a
            href="https://www.linkedin.com/in/damiengrange/"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs font-medium truncate ${textMuted}`}
          >
            {/* Signature redevenue discrète (27/07, retour direct : "trop
                bruyante, `font-bold` + highlight") — `font-bold`/
                `textHighlight` retirés du nom ; toute la phrase reste au
                même ton `textMuted` au repos, SEUL le nom réagit au survol
                (`underline decoration-transparent hover:decoration-current`
                + couleur d'accent, pour garder l'affordance de lien LinkedIn
                sans repeindre toute la phrase).
                PIÈGE TAILWIND ÉVITÉ (voir bottomBarLayout.js/passation du
                26-27/07, même piège que `hover:${'${cardBg}'}` jamais
                généré) : `hover:${'${textColorClass}'}` construit par
                interpolation N'AURAIT PAS marché — Tailwind scanne le texte
                SOURCE littéralement, une classe assemblée à l'exécution
                n'apparaît jamais telle quelle dans le fichier. Écrit ici en
                toutes lettres pour CHACUNE des 2 classes composant
                `textColorClass` (voir sa définition, useTheme.js :
                `text-{couleur}-500 dark:text-{couleur}-500/400`), sous
                forme d'un ternaire complet sur `isNaughtyMode` — même
                technique déjà utilisée juste au-dessus dans ce fichier pour
                le halo du logo en Mode Intime. */}
            Un projet créé par{' '}
            <span
              className={
                "underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current " +
                (isNaughtyMode ? "hover:text-rose-500 dark:hover:text-rose-400" : "hover:text-red-500 dark:hover:text-red-500")
              }
            >
              Damien Grangé
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
