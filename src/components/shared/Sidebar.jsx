import { Heart, Activity, X, Zap, List, Star, Settings, Trophy, Compass, Sun, Moon } from 'lucide-react';
import { MINI_PLAYER_BAR_HEIGHT_PX, GUEST_MODE_BAR_HEIGHT_PX } from '../../layout/bottomBarLayout';
import { VIEW_HEADER_TOP_PADDING } from '../../layout/viewHeaderLayout';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';
import {
  SIDEBAR_LINK_PADDING, SIDEBAR_LINK_GAP, SIDEBAR_SECTION_TITLE_MARGIN,
  SIDEBAR_SEPARATOR_MARGIN, SIDEBAR_SCROLL_PADDING, SIDEBAR_FOOTER_LINK_PADDING,
  SIDEBAR_LINK_PADDING_COMPACT, SIDEBAR_LINK_GAP_COMPACT, SIDEBAR_SECTION_TITLE_MARGIN_COMPACT,
  SIDEBAR_SCROLL_PADDING_COMPACT,
} from '../../layout/sidebarLayout';

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
 * sous des en-têtes discrets plutôt que par imbrication visuelle : à
 * l'origine 3 groupes — CRÉATION (démarrer quelque chose de nouveau), MON
 * ESPACE (consulter ce qui existe déjà POUR SOI), RÉGLAGES (configuration,
 * séparé par une bordure + `mt-auto` comme avant). Un 4e groupe CONCEPTUEL,
 * DÉCOUVERTE, est venu s'ajouter le 21/08 (voir plus bas, section
 * "--- DÉCOUVERTE ---") — "Découvrir" vivait dans CRÉATION jusque-là, par
 * défaut plutôt que par un vrai choix : ce n'est ni créer pour soi, ni
 * consulter ce qui est à soi, mais parcourir ce que D'AUTRES ont fait,
 * une intention distincte des 2 premières. ⚠️ SANS EN-TÊTE VISIBLE
 * (retiré le même jour, retour direct suite à capture) — un seul lien
 * ("Découvrir") sous un titre quasi-identique ("Découverte") ne groupait
 * rien, contrairement à CRÉATION/MON ESPACE qui groupent chacun 2 liens
 * aux noms distincts ; le séparateur au-dessus suffit à l'isoler
 * visuellement de "Mon Espace", pas besoin d'un texte en plus. Tous les
 * boutons partagent maintenant le même style actif (`bgAccentClass
 * text-white shadow-lg`) — avant, seul "Générer" l'avait, les autres
 * utilisaient un simple `bg-surface-hover` plus discret, une incohérence
 * sans raison fonctionnelle.
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
 *
 * SÉPARATION DÉFINITIVE (03/08, retour direct : "déplacer le bouton
 * trophées juste à côté du bouton réglages, et laisser le bouton lumière
 * au même endroit que quand on est invité") — Trophées quitte le header
 * pour le pied de page, juste à côté de Réglages (compact, icône seule,
 * même ligne — voir sa docstring plus bas pour le budget de hauteur).
 * Thème reste SEUL dans le header, dans tous les cas désormais — corrige
 * un vrai défaut relevé par l'utilisateur : avant ce changement, la
 * position du bouton Thème se décalait de quelques pixels selon l'état de
 * connexion (seul si invité, juste après Trophées si connecté). Il occupe
 * maintenant une position FIXE, identique pour tout le monde. Raisonnement
 * de regroupement : Trophées et Réglages sont tous les deux des éléments
 * PERSONNELS (progression, compte) — les regrouper au pied de page a plus
 * de sens que Trophées à côté du logo, plutôt territoire "identité de
 * l'app".
 */
export default function Sidebar({
  cardBorder, cardBorderStrong, bgAccentClass, isNaughtyMode, textHighlight, textColorClass, textMuted,
  isMobileMenuOpen, setIsMobileMenuOpen,
  changeView, view,
  onOpenSettings,
  favorites,
  user, unseenTrophyCount,
  guestBarVisible, playerBarVisible,
  toggleNaughtyMode,
  theme, toggleTheme,
}) {
  // Compaction conditionnelle du menu en Mode Intime (Refactor UI, 29/07,
  // retour direct : "Statistiques passe sous la ligne de flottaison,
  // scroll indésirable") — le bouton "Quitter le Mode Intime" (visible
  // SEULEMENT dans ce mode, en plus des liens habituels) ajoute une
  // hauteur que le mode normal n'a jamais à absorber. 3 variables locales,
  // calculées UNE SEULE FOIS ici puis réutilisées à chaque usage (au lieu
  // de répéter le ternaire à chaque bouton) — normal (`!isNaughtyMode`)
  // garde EXACTEMENT ses valeurs d'origine, aucun changement visuel :
  // seul le Mode Intime bascule vers les variantes compactes de
  // sidebarLayout.js.
  const linkPadding = isNaughtyMode ? SIDEBAR_LINK_PADDING_COMPACT : SIDEBAR_LINK_PADDING;
  const linkGap = isNaughtyMode ? SIDEBAR_LINK_GAP_COMPACT : SIDEBAR_LINK_GAP;
  const sectionTitleMargin = isNaughtyMode ? SIDEBAR_SECTION_TITLE_MARGIN_COMPACT : SIDEBAR_SECTION_TITLE_MARGIN;
  // 3e itération (même jour, retour direct : "supprimer le léger mouvement
  // de scroll restant") — même principe, sur le padding du conteneur
  // scrollable lui-même cette fois (voir sidebarLayout.js).
  const scrollPadding = isNaughtyMode ? SIDEBAR_SCROLL_PADDING_COMPACT : SIDEBAR_SCROLL_PADDING;

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
  // partagée avec les classes Tailwind `h-[90px]`/`h-[72px]` de
  // MiniPlayerBar.jsx/GuestModeBar.jsx (qui, elles, DOIVENT rester écrites
  // en dur — voir bottomBarLayout.js pour la contrainte Tailwind derrière ce
  // choix). `null` = aucune barre visible, la case crédit garde sa hauteur
  // naturelle (basée sur son padding).
  // (Les autres réglages d'espacement de ce fichier — paddings des liens,
  // marges des titres, séparateur — sont centralisés dans sidebarLayout.js,
  // voir ce fichier pour le pourquoi de chaque valeur actuelle.)
  const creditRowHeight = playerBarVisible && guestBarVisible
    ? MINI_PLAYER_BAR_HEIGHT_PX + GUEST_MODE_BAR_HEIGHT_PX
    : playerBarVisible
      ? MINI_PLAYER_BAR_HEIGHT_PX
      : guestBarVisible
        ? GUEST_MODE_BAR_HEIGHT_PX
        : null;

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-64 h-full bg-surface border-r-2 ${cardBorderStrong} flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} ${bottomBarPadding} md:pb-0`}>
      <div className={`${VIEW_HEADER_TOP_PADDING} px-6 pb-6 mb-2 border-b-2 ${cardBorderStrong} flex items-center justify-between shrink-0`}>
         {/* Logo cliquable = retour à l'accueil ("Nouvelle Playlist"). */}
         <button
           onClick={() => changeView('generator')}
           title="Retour à l'accueil"
           className="flex items-center space-x-3 cursor-pointer"
         >
            <div className={`${bgAccentClass} p-1.5 rounded-lg transition-colors duration-500 ${isNaughtyMode ? 'shadow-[0_0_15px_rgba(244,63,94,0.4)]' : ''}`}>
              {/* `size={34}` : valeur de RÉFÉRENCE que `VIEW_HEADER_ICON_SIZE`
                  (viewHeaderLayout.js, importée par les icônes de titre H1
                  de chaque vue) reproduit — reste un littéral ICI, pas une
                  constante importée : ce logo est la source à laquelle les
                  autres s'alignent, pas l'inverse.
                  Micro-ajustement (Refactor UI "ligne de flottaison", 29/07,
                  5e itération, retour direct : "agrandir un poil le logo,
                  de l'ordre de 5/6 pixels") — `size=28` → `size=34` (+6px)
                  UNIQUEMENT : l'icône est déjà l'élément le plus haut de
                  cette ligne (badge = icône + padding `p-1.5` inchangé),
                  donc l'agrandir pousse mécaniquement le liseret sous le
                  logo de +6px, sans toucher au padding. `VIEW_HEADER_ICON_SIZE`
                  suit la même valeur — les titres de page grandissent du
                  même coup, sans changement de leur `pb-3.5` (voir
                  ViewHeader.jsx, budget de hauteur absorbé automatiquement
                  par cette seule icône plus grande). */}
              {isNaughtyMode ? <Heart size={34} className="text-white fill-white" /> : <Activity size={34} className="text-white" />}
            </div>
            {/* Taille conditionnelle (Refactor UI "Verrouillage du bouton
                Thème", 29/07, retour direct : "TempoIntime pousse le
                bouton thème contre le séparateur") — la ligne entière est
                déjà en `justify-between` (logo à gauche, boutons à
                droite) : en théorie, la position du bouton thème ne
                dépend PAS de la longueur du texte du logo, `justify-
                between` ancre les 2 groupes aux extrémités du conteneur,
                quel que soit ce qu'il y a entre les deux. Le VRAI problème
                : "TempoIntime" (11 caractères) est assez large pour faire
                DÉBORDER le contenu total au-delà de la largeur disponible
                de la Sidebar (256px − px-6×2 = 208px), ce qui casse cet
                ancrage — calcul : badge(46) + gap(12) + bouton thème seul
                en mode invité(36) = 94px de côtés fixes, laissant 114px
                pour le texte ; "TempoFit" (~108px à `text-2xl`) tient
                dedans, "TempoIntime" (~148px à la même taille) déborde de
                ~34px. `text-lg` (au lieu de `text-2xl`) UNIQUEMENT en Mode
                Intime ramène "TempoIntime" à ~111px, sous la barre des
                114px — `tracking-tighter` (au lieu de `tracking-tight`) en
                plus, pour une marge de sécurité supplémentaire face à
                l'approximation de cette estimation (aucun navigateur réel
                dans cet environnement de dev pour mesurer la largeur
                exacte). "TempoFit" (mode normal) garde `text-2xl
                tracking-tight` EXACTEMENT comme avant — seule la variante
                "TempoIntime" est concernée par cette réduction. */}
            <span className={`font-bold leading-none ${isNaughtyMode ? 'text-lg tracking-tighter' : 'text-2xl tracking-tight'} ${textHighlight}`}>Tempo<span className={textColorClass}>{isNaughtyMode ? 'Intime' : 'Fit'}</span></span>
         </button>
         <div className="flex items-center gap-2">
           {/* Bouton Thème — relocalisé depuis App.jsx (Fix UI 27/07, "nettoyage
               global") : vivait avant `absolute top-4 right-4` en haut de
               `<main>`, ce qui pouvait entrer en collision avec le contenu des
               cartes pleine largeur (voir PlaylistHeader.jsx, même session).
               Ici, dans le header FIXE de la Sidebar : plus jamais de
               superposition possible avec le contenu, quelle que soit la vue.
               Visible inconditionnellement (pas de `user &&`) — le thème
               clair/sombre concerne tout le monde, connecté ou non.
               ⚠️ SEUL bouton de ce header depuis le 03/08 (voir Trophées,
               déménagé au pied de page à côté de Réglages) — retour direct :
               "la position du bouton thème change selon que je suis
               connecté ou non, ça devrait être fixe". C'était vrai : avant
               ce déménagement, Trophées vivait ICI (`user &&`), donc ce
               bouton Thème se décalait de quelques pixels selon l'état de
               connexion (seul en mode invité, juste après Trophées sinon).
               Il occupe maintenant TOUJOURS la même position, y compris
               connecté — le calcul de largeur du logo "TempoIntime" plus
               haut (`badge(46) + gap(12) + bouton thème seul(36) = 94px`)
               n'est donc plus un cas "invité seulement" mais LE seul cas,
               point, ce qui élimine au passage un risque de dépassement
               latent non mesuré (le calcul d'origine ne couvrait jamais
               explicitement "connecté + Mode Intime", le seul cas où
               Trophées ET le texte élargi "TempoIntime" auraient coexisté
               ici). */}
           <button
             onClick={toggleTheme}
             title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
             className={`p-2 ${ICON_BUTTON_ROUNDING} transition-colors ${textMuted} hover:bg-surface-hover hover:text-main`}
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
          Mode Intime sur n'importe quelle autre page (Mes Statistiques, Mes
          Playlists, Profil Athlétique...), aucun moyen d'en sortir sans
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
      <div className={`flex-1 overflow-y-auto no-scrollbar ${scrollPadding}`}>
      {isNaughtyMode && (
        <div className={`pt-0.5 pb-3.5 border-b ${cardBorder}`}>
          {/* Padding ASYMÉTRIQUE (Refactor UI "Centrage du bouton Quitter le
              Mode Intime", 29/07, 3e itération, retour direct : "pile entre
              le trait du logo en haut et le liseret de Création en bas") —
              l'ancien `py-2` (8px/8px, symétrique) ne centrait PAS
              réellement le bouton : le conteneur scrollable parent ajoute
              DÉJÀ 12px au-dessus (`scrollPadding` compact, py-3, voir
              sidebarLayout.js) avant que ce wrapper ne commence, alors que
              rien d'équivalent ne s'ajoute après sa bordure — l'espace
              "au-dessus" du bouton était donc 12+8=20px contre seulement
              8px "en-dessous", visiblement décentré vers le bas.
              Calcul : espace_haut = 12 (scrollPadding compact) + pt ;
              espace_bas = pb ; on veut les 2 égaux, en gardant pt+pb=16
              (même total qu'avant, donc AUCUN changement de hauteur ici) —
              12+pt = 16−pt => pt = 2px (`pt-0.5`), pb = 14px (`pb-3.5`) :
              espace_haut = 12+2 = 14px = espace_bas. Les 2 valeurs
              (`scrollPadding` ET ce padding) sont calculées ENSEMBLE —
              changer l'une sans l'autre décale à nouveau le bouton. */}
          <button
            onClick={toggleNaughtyMode}
            className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer text-rose-500 hover:bg-rose-500/10`}
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
          un conteneur `flex flex-col ${'${SIDEBAR_LINK_GAP}'}`. Typographie
          "chapeau de section" sur les titres (`text-[10px] sm:text-xs
          uppercase tracking-widest font-bold`, ${'${textMuted}'} — PAS de
          slate-500/400 codé en dur : textMuted est le token déjà adaptatif
          clair/sombre ET Mode Intime, voir useTheme.js, un hardcode perdrait
          ce dernier réglage).

          ⚠️ HISTORIQUE DE 9 PASSES (28/07) sur ces espacements — retiré
          d'ici (28/07 suite, "chantier en suspens" traité) : les valeurs
          ci-dessous sont parties dans les 2 sens plusieurs fois le même jour
          (`py-2` ↔ `py-2.5` ↔ `py-3`, `my-5` ↔ `my-6`, `mt-4` ↔ `mt-6` ↔
          `mt-12`...) avant de se stabiliser. Le récit complet de CE
          POURQUOI (quel retour a motivé quel changement, dans quel ordre)
          vivait ici en commentaire — désormais dans l'historique Git de ce
          fichier plutôt que dupliqué en prose à cet endroit, pour ne pas
          laisser grossir indéfiniment ce bloc à chaque futur ajustement.
          Les valeurs FINALES stabilisées, elles, vivent maintenant dans
          `src/layout/sidebarLayout.js` (constantes `SIDEBAR_LINK_PADDING`,
          `SIDEBAR_SECTION_TITLE_MARGIN`, `SIDEBAR_SEPARATOR_MARGIN`,
          `SIDEBAR_SCROLL_PADDING`, `SIDEBAR_FOOTER_LINK_PADDING`) — TOUT
          futur ajustement doit changer LÀ-BAS, pas ici, pour rester la
          référence unique. Résumé de l'état final (pour lecture rapide sans
          ouvrir l'autre fichier) : liens de nav en `py-2.5`, titres de
          section en `mb-4` (strictement identiques, sans `mt-*` sur le
          bouton suivant), séparateur physique en `my-5` (pas un simple
          vide), conteneur scrollable en `py-4` (seule source de l'équilibre
          haut/bas, aucun enfant ne doit plus porter sa propre marge de fin),
          bouton Réglages du footer en `py-1.5` (délibérément différent : ce
          conteneur a une hauteur stricte à respecter, voir plus bas). */}
      <nav className="flex flex-col">

        {/* --- CRÉATION --- */}
        <div className={`flex flex-col ${linkGap}`}>
          <div className={`px-3 ${sectionTitleMargin} text-[10px] sm:text-xs uppercase tracking-widest font-bold ${textMuted}`}>Création</div>

          <button onClick={() => changeView('generator')} className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer ${view === 'generator' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Zap size={18} className={view === 'generator' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Nouvelle Playlist</span>
          </button>

          {/* Rapprochée de "Nouvelle séance" (retour direct, 20/08 :
              "les séances juste en dessous du bouton de génération de
              séance") — "Nouvelle séance" produit directement UNE séance,
              la rapprocher de son résultat direct crée un flux
              créer→consulter lisible.
              ⚠️ Historique du même jour : d'abord un simple ÉCHANGE de
              position avec "Mes Routines" (qui descendait dans "Mon
              Espace"), PUIS "Mes Routines" fusionnée en onglet DANS "Mes
              Séances" (voir plus bas, "Mes Routines RETIRÉ D'ICI" —
              PlaylistsView.jsx) — l'échange initial est donc devenu sans
              objet, il n'y a plus qu'un seul bouton "Mes Séances" ici,
              plus de bouton "Mes Routines" à placer où que ce soit dans la
              Sidebar. Raisonnement d'origine gardé ci-dessus : il explique
              toujours pourquoi ce bouton est monté ici plutôt que dans
              "Mon Espace", même si sa 2e moitié (où va "Mes Routines") ne
              s'applique plus telle quelle.
              ⚠️ RENOMMÉ (même jour, retour direct utilisateur suite à un
              retour terrain : "la notion de 'séance' parle aux utilisateurs
              qui font du sport régulièrement mais beaucoup moins à ceux qui
              testent juste par curiosité, ils se disent pas qu'il y a une
              playlist même si on fait bien plus") — "Nouvelle séance" →
              "Nouvelle Playlist", "Mes Séances" → "Mes Playlists". Décision
              assumée comme réversible par l'utilisateur ("au pire je fais
              un mauvais choix et reviendrai en arrière") — le raisonnement
              "séance > playlist" documenté plus haut dans ce fichier
              reste VALIDE sur le fond (plan d'entraînement structuré, pas
              une simple liste de titres), mais perdait un signal important
              pour les visiteurs curieux/premiers contacts. Le nom de ce
              bouton a changé, pas sa position ni la logique de section qui
              l'y a amené. */}
          <button onClick={() => changeView('playlists')} className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer ${view === 'playlists' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <List size={18} className={view === 'playlists' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Playlists</span>
          </button>
        </div>

        {/* Séparateur physique (28/07, "Polish UI — normalisation du rythme
            vertical") — remplace la marge géante (`mt-6`/`mt-8`, avant sur
            l'en-tête de "Mon Espace") par une VRAIE ligne de démarcation
            entre les 2 univers ("Création" et "Mon Espace"). `border-divider`
            (micro, 1px, ${'${cardBorder}'}) plutôt que `border-divider-strong` :
            cette ligne sépare 2 GROUPES DE LIENS à l'intérieur de la même
            zone scrollable, pas 2 BLOCS structurels de la Sidebar (header/
            scrollable/footer, qui eux utilisent la bordure macro 2px — voir
            plus haut/plus bas dans ce fichier) — même distinction que
            cardBorder/cardBorderStrong partout ailleurs dans l'app (voir
            useTheme.js). Marge (`SIDEBAR_SEPARATOR_MARGIN`) centralisée dans
            sidebarLayout.js — voir ce fichier pour la valeur actuelle. */}
        <div className={`border-t ${cardBorder} w-full ${SIDEBAR_SEPARATOR_MARGIN}`}></div>

        {/* --- MON ESPACE --- */}
        <div className={`flex flex-col ${linkGap}`}>
          <div className={`px-3 ${sectionTitleMargin} text-[10px] sm:text-xs uppercase tracking-widest font-bold ${textMuted}`}>Mon Espace{!user && ' • Invité'}</div>

          {/* "Mes Routines" RETIRÉ D'ICI (20/08, fusion en onglet — retour
              direct : "j'imagine la partie routines comme un onglet
              spécifique du menu séance, comme sur un profil utilisateur").
              Ce n'est plus une entrée de Sidebar séparée : c'est maintenant
              le 2e onglet de "Mes Playlists" (bouton juste au-dessus, dans
              "Création") — voir PlaylistsView.jsx pour le détail complet.
              L'échange de position du 20/08 ("Mes Séances" ↔ "Mes
              Routines" entre les 2 sections, voir commit précédent) est
              donc devenu sans objet : il n'y a plus qu'UN SEUL lien ici,
              plus besoin de choisir sa section. */}

          <button onClick={() => changeView('favorites')} className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer ${view === 'favorites' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Star size={18} className={favorites.useFavorites && favorites.artists.length > 0 ? "text-yellow-500 fill-yellow-500/20" : (view === 'favorites' ? 'text-white' : '')} />
            <span className="font-bold text-sm">Mes Favoris</span>
          </button>

          <button onClick={() => changeView('stats')} className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer ${view === 'stats' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Activity size={18} className={view === 'stats' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Mes Statistiques</span>
          </button>
        </div>

        {/* Séparateur — même traitement que celui entre Création et Mon
            Espace juste au-dessus (voir sa docstring pour le raisonnement
            complet du choix `border-divider` micro plutôt que
            `border-divider-strong`). */}
        <div className={`border-t ${cardBorder} w-full ${SIDEBAR_SEPARATOR_MARGIN}`}></div>

        {/* --- DÉCOUVERTE (retour direct, 21/08) ---
            "Découvrir" vivait dans CRÉATION depuis la refonte du 25/07 (voir
            docstring en tête de fichier) — mais n'y correspond pas vraiment :
            CRÉATION, c'est démarrer quelque chose de SOI-MÊME (générer une
            séance) ; MON ESPACE, c'est consulter ce qui existe déjà POUR SOI
            (ses propres playlists/favoris/stats). Découvrir, lui, sert à
            parcourir ce que D'AUTRES ont fait (modèles du catalogue,
            profils publics) — une 3e intention, ni l'une ni l'autre, qui
            méritait sa propre section plutôt que d'être rattachée à
            CRÉATION par défaut faute d'un meilleur endroit à l'époque.
            Position choisie : juste au-dessus du pied de page fixe
            (Réglages) — dernière section de la zone scrollable, donc
            visuellement adjacente à Réglages sans toucher au budget de
            hauteur strict de son conteneur (`creditRowHeight`, voir la
            docstring du pied de page plus bas).
            ⚠️ TITRE DE SECTION RETIRÉ (même jour, retour direct suite à
            capture) — contrairement à CRÉATION/MON ESPACE, qui groupent
            chacun 2 liens aux noms DISTINCTS (Nouvelle Playlist/Mes
            Playlists, Mes Favoris/Mes Statistiques), un en-tête "Découverte"
            au-dessus d'un unique bouton "Découvrir" ne groupait rien —
            juste le même mot répété deux fois de suite. Rendre le TITRE
            lui-même cliquable a été envisagé puis écarté : les titres de
            section sont purement typographiques PARTOUT ailleurs dans
            cette Sidebar, jamais interactifs — en faire une exception
            silencieuse ici aurait cassé cette convention sans qu'aucun
            visiteur ne s'y attende. Séparateur au-dessus conservé (reste
            visuellement distinct de "Mon Espace"), seul le texte
            "Découverte" disparaît. */}
        <div className={`flex flex-col ${linkGap}`}>
          <button onClick={() => changeView('discover')} className={`w-full flex items-center space-x-3 ${linkPadding} rounded-xl transition-colors select-none cursor-pointer ${view === 'discover' ? `${bgAccentClass} text-white shadow-lg` : `${textMuted} hover:bg-surface-hover hover:text-main`}`}>
            <Compass size={18} className={view === 'discover' ? 'text-white' : textColorClass} />
            <span className="font-bold text-sm">Découvrir</span>
          </button>
        </div>

      </nav>
      </div>

      {/* Pied de page FIGÉ (shrink-0) — Réglages + crédit, toujours visibles
          sans avoir à faire défiler la zone centrale au-dessus.
          Fix UI (28/07, retour direct : "effet escalier" — la bordure du
          haut de ce pied de page ne s'alignait plus avec celle de
          GuestModeBar.jsx sur la partie droite de l'écran) : la CAUSE était
          que Réglages vivait dans son PROPRE conteneur (hauteur naturelle,
          non synchronisée), EMPILÉ AU-DESSUS du conteneur crédit (lui,
          hauteur fixe = `creditRowHeight`, synchronisée avec
          MiniPlayerBar/GuestModeBar) — la hauteur TOTALE du pied de page
          dépassait donc `creditRowHeight`, décalant sa bordure supérieure
          vers le haut par rapport à celle de la barre du bas. Réglages et
          le crédit fusionnent maintenant dans UN SEUL conteneur, dont la
          hauteur (quand une barre du bas est visible) est EXACTEMENT
          `creditRowHeight` — la bordure de ce conteneur unique s'aligne
          donc de nouveau, sur toute la largeur de l'écran, avec celle de
          MiniPlayerBar/GuestModeBar. */}
      <div className="shrink-0">
        <div
          className={`flex flex-col items-center justify-center gap-1 py-2 px-4 border-t-2 ${cardBorderStrong}`}
          style={creditRowHeight ? { height: `${creditRowHeight}px` } : undefined}
        >
          {/* Style volontairement DISCRET (28/07, retour direct : "Réglages
              ne doit pas attirer l'œil plus que Statistiques") — pas de
              mécanisme actif/rouge comme les autres liens de nav
              (`view === 'settings' ? bgAccentClass...`), même quand cette
              vue est active : Réglages reste un accès utilitaire parmi
              d'autres, pas un point d'attention comme "Nouvelle séance".
              `py-1.5` (plutôt que `py-2.5` comme les autres liens) : ce
              conteneur a maintenant une hauteur STRICTE (72px minimum,
              `GUEST_MODE_BAR_HEIGHT_PX`, 64→72 le 29/07) à partager avec la
              signature juste en dessous — un padding aussi généreux que les
              liens de la zone scrollable (qui, eux, ont de la place à
              volonté) ferait déborder l'ensemble hors de cette hauteur
              fixe.
              `py-2` sur le conteneur PARENT (Refactor UI "aération
              footer/GuestBar", 29/07, retour direct : "la ligne de crédit
              frôle la bordure inférieure", PUIS "les crédits sont coupés"
              — BUG RÉEL, corrigé dans la foulée) — le premier essai
              (`py-3`, 24px) faisait DÉBORDER le contenu (bouton Réglages +
              gap + texte de signature, ≈50px) hors des 72px fixes de ce
              conteneur (`style={{height: creditRowHeight+'px'}}` plus bas) :
              50 + 24 = 74px > 72px, d'où le texte visuellement rogné en
              bas. `py-2` (16px) laisse 6px de marge (50+16=66 ≤ 72) — le
              texte respire un peu plus qu'avant SANS déborder. Disposition
              (`flex flex-col items-center justify-center gap-1`) toujours
              INCHANGÉE — seule cette valeur de padding a bougé. */}
          {/* `onOpenSettings` (03/08, PAS `changeView('settings')` direct) —
              voir sa docstring, App.jsx : réinitialise l'onglet de départ de
              SettingsView avant d'y naviguer, pour ne jamais hériter d'un
              `'account'` posé par une visite précédente via le dropdown
              avatar (App.jsx, "cliquer sur mon compte").
              ⚠️ BUG CORRIGÉ (05/08, retour direct, capture d'écran — clic
              sur "Réglages" depuis la vue invité : en-tête "Mon Compte",
              aucun onglet actif, contenu vide) : `onClick={onOpenSettings}`
              passait la fonction TELLE QUELLE à `onClick` — React l'appelle
              alors avec le SyntheticEvent du clic comme 1er argument.
              `handleOpenSettings = (tab = null) => ...` (App.jsx) reçoit
              donc cet event comme `tab` (un objet, TOUJOURS "truthy" — le
              paramètre par défaut `= null` ne s'applique QUE si l'appelant
              ne passe RIEN, pas juste une valeur fausse), jamais `null`.
              `initialTab` (SettingsView.jsx) valait donc cet event, ni
              'profile' ni 'music' ni 'account' — aucune branche des
              ternaires (en-tête, onglet actif, contenu) ne matchait,
              d'où l'en-tête replié sur son "else" ("Mon Compte"), aucun
              onglet visuellement actif, et un contenu vide. Corrigé en
              enveloppant l'appel (`() => onOpenSettings()`), comme PARTOUT
              ailleurs dans ce fichier pour ce type de callback — c'était
              d'ailleurs le SEUL endroit du projet où ce piège était présent
              (audit fait sur les autres callbacks à paramètre optionnel). */}
          <div className="w-full flex items-center gap-2">
            <button onClick={() => onOpenSettings()} className={`flex-1 min-w-0 flex items-center space-x-3 ${SIDEBAR_FOOTER_LINK_PADDING} rounded-xl transition-colors select-none cursor-pointer ${textMuted} hover:bg-surface-hover hover:text-main`}>
              <Settings size={18} className={textColorClass} />
              <span className="font-bold text-sm">Réglages</span>
            </button>
            {/* Bouton Trophées (03/08, déménagé ici depuis le header à côté
                du logo — retour direct : "déplacer le bouton trophées juste
                à côté du bouton réglages, et laisser le bouton lumière au
                même endroit que quand on est invité"). Comportement
                identique à avant (discret/gris tant qu'aucun trophée n'est
                débloqué, doré + badge du nombre sinon, `user &&` inchangé)
                — seule la position change. `shrink-0` + icône seule (pas de
                libellé, contrairement à Réglages) : compact exprès pour
                tenir sur CETTE ligne sans agrandir la hauteur du pied de
                page (budget strict, `creditRowHeight`, voir la docstring du
                conteneur juste au-dessus) — `py-1.5` partagé avec Réglages
                pour que les 2 boutons s'alignent exactement à la même
                hauteur. `ICON_BUTTON_ROUNDING` (PAS `rounded-xl` comme
                Réglages juste à côté) — icône seule sans libellé, voir
                iconButtonLayout.js pour la règle complète.
                `mr-2` (03/08, retour direct, capture d'écran à l'appui :
                "l'icône trophée doit se trouver sur la même ligne
                verticale que le bouton thème") — sans ce décalage, le
                bouton Trophées atterrit visuellement 8px trop à droite par
                rapport au bouton Thème (header, ligne ~241) : le conteneur
                du header utilise `px-6` (24px) alors que ce pied de page
                utilise `px-4` (16px, voir la docstring du conteneur
                scrollable juste au-dessus, même raison) — un écart de 8px
                entre les deux marges de droite. Corrigé ICI, sur CE bouton
                seul (pas en touchant le padding du conteneur entier, qui
                décalerait aussi Réglages et le texte de crédit en dessous,
                sans raison de bouger eux) : `mr-2` compense exactement
                l'écart, alignant le bord droit de Trophées sur celui de
                Thème, quelle que soit la largeur propre de chaque bouton
                (l'alignement porte sur le bord droit commun, pas sur le
                centre — les 2 boutons n'ont pas exactement la même
                largeur, `p-2`/20px vs `px-2.5 py-1.5`/18px, mais un écart
                de 2px sur la largeur est imperceptible comparé aux 8px de
                décalage qu'on corrige).
                `unseenTrophyCount` (PAS `userStats.unlockedTrophies.length`,
                03/08, retour direct, capture d'écran : "quand j'ai ouvert
                la partie trophées, l'icône doit devenir grise... et les
                notifications '5' doit être retiré, sinon on pollue
                visuellement") — voir la docstring complète côté
                `useUserStats.js` (`markTrophiesSeen`) pour le
                raisonnement : ce bouton ne connaît QUE le nombre à
                afficher, jamais la logique "vu/pas vu" elle-même. */}
            {user && (
              <button
                onClick={() => changeView('trophies')}
                title="Trophées"
                className={`relative shrink-0 mr-2 px-2.5 py-1.5 ${ICON_BUTTON_ROUNDING} transition-colors ${
                  unseenTrophyCount > 0
                    ? 'text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                    : `${textMuted} hover:bg-surface-hover hover:text-main`
                }`}
              >
                <Trophy size={18} className={unseenTrophyCount > 0 ? "fill-yellow-500" : ""} />
                {unseenTrophyCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                    {unseenTrophyCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Crédit du projet — discret, ouvre dans un nouvel onglet pour ne
              pas faire quitter l'app en un clic accidentel.
              TOUJOURS affiché désormais (27/07, layout Dashboard) — plus de
              condition `!guestBarVisible` : GuestModeBar.jsx ne recouvre plus
              jamais la Sidebar sur desktop (calée à sa droite,
              `md:left-64 md:w-[calc(100%-16rem)]` sur le conteneur commun,
              App.jsx) et n'affiche donc plus de réplique de ce crédit à
              synchroniser — ce bloc-ci est maintenant la SEULE source. */}
          <a
            href="https://www.linkedin.com/in/damiengrange/"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs font-medium truncate ${textMuted}`}
            title="Un projet créé par Damien Grangé"
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
