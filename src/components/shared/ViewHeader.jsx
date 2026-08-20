/**
 * ViewHeader — en-tête standard de TOUTE vue de premier niveau (celles
 * listées dans la Sidebar : Nouvelle séance, Mes Séances, Découvrir, Mes
 * Routines, Mes Favoris, Statistiques, Trophées, Options & Comptes...
 * — ordre mis à jour le 20/08, voir Sidebar.jsx : "Mes Séances"/"Mes
 * Routines" ont échangé leur place).
 *
 * NAISSANCE DE CE COMPOSANT (25/07) — après un chantier "uniformisation des
 * largeurs de vues et alignement vertical" qui a dû corriger le même pattern
 * à la main dans 9 fichiers différents, et qui a bien failli en manquer
 * deux (`TrophiesView.jsx`/`PlaylistDetailView.jsx`, jamais explicitement
 * listés dans la demande, retrouvés en scannant tout le dossier `views/` par
 * précaution) : au passage, deux AUTRES divergences pré-existantes ont été
 * repérées (`TrophiesView.jsx`/`SettingsView.jsx` gardaient encore l'ancien
 * style de sous-titre avec `text-shadow`, que ce même chantier avait déjà
 * retiré de GeneratorView.jsx pour cette exacte raison de cohérence — un
 * oubli qui avait échappé à TOUTES les vérifications précédentes). Ce
 * composant existe pour que ce genre de divergence devienne structurellement
 * impossible plutôt que dépendante d'une relecture manuelle exhaustive à
 * chaque nouvelle vue : une nouvelle vue qui utilise `<ViewHeader/>` a
 * AUTOMATIQUEMENT la bonne largeur de clairance anti-collision, les bonnes
 * tailles de police, le bon espacement — elle ne PEUT pas diverger sans le
 * faire explicitement et visiblement (une classe ajoutée à la main à côté,
 * pas une classe oubliée dans une copie manuelle du pattern).
 *
 * Usage minimal (la grande majorité des vues) :
 *   <ViewHeader theme={theme} isNaughtyMode={isNaughtyMode}
 *     icon={<Zap className={theme.textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
 *     title="Sculpte ta séance" subtitle="Laisse l'algorithme..." />
 * (`VIEW_HEADER_ICON_SIZE`, importée de `viewHeaderLayout.js` — plus de
 * taille codée en dur ici depuis le Refactor UI "ligne de flottaison",
 * 29/07 ; voir ce fichier pour le budget de hauteur qui la contraint.)
 *
 * `icon` — un ÉLÉMENT déjà construit (`<Zap className="..." size={34}/>`),
 * pas juste un composant : la couleur de l'icône suit parfois une règle
 * spéciale propre à une vue (ex. StatsView, rose en Mode Intime plutôt que
 * `textColorClass`) — plus simple de laisser l'appelant construire l'icône
 * lui-même que d'essayer d'encoder toutes les règles possibles ici.
 *
 * `right` — contenu optionnel affiché à droite du titre (ex. le bouton
 * "Partager mon bilan" de StatsView) — empile en colonne sous le titre sur
 * mobile, revient à côté à partir de `sm:`. À utiliser avec prudence : voir
 * DiscoverView.jsx (25/07, chantier "polish UI des en-têtes") où un bouton
 * ("Publier ma propre séance") est retiré d'ici — un bouton assez large
 * combiné à `pr-32 md:pr-40` pouvait laisser trop peu de place au titre/
 * sous-titre. Pas de solution générique imposée ici : selon le cas, la
 * bonne réponse peut être de raccourcir le texte, de le déplacer ailleurs
 * dans la vue (voir DiscoverView.jsx, redescendu face aux filtres avant
 * d'être retiré), ou de le supprimer si la fonctionnalité qu'il annonce
 * n'existe pas encore.
 *
 * `pr-32 md:pr-40` toujours appliqué, inconditionnellement : protège le
 * titre d'une collision avec les boutons Thème/Connexion, `absolute` et
 * toujours au-dessus (voir App.jsx, `<main>`) — aucune vue n'a de raison
 * légitime de s'en passer, donc pas une prop, pour qu'il n'y ait justement
 * rien à oublier de préciser.
 *
 * BUG RÉEL CORRIGÉ (25/07, "fix UI — lisibilité du sous-titre") : titre ET
 * sous-titre utilisaient une palette fixe codée en dur (`text-white`/
 * `text-slate-950` pour le titre, `text-slate-300`/`text-slate-700` pour le
 * sous-titre, choisie selon `isNaughtyMode`) — SANS variante `dark:`, alors
 * que l'app a un vrai bouton clair/sombre indépendant du Mode Intime. En
 * thème clair + mode Standard : `text-white` sur un fond clair, quasiment
 * invisible (confirmé par capture d'écran). Cette palette fixe datait d'AVANT
 * le chantier "Design System sémantique" (voir useTheme.js) qui a justement
 * centralisé `text-main`/`text-muted` dans des variables CSS (`:root`/
 * `.dark`/`.naughty`, voir index.css) gérant DÉJÀ clair/sombre ET Mode
 * Intime ensemble — `useTheme.js` le dit explicitement dans son propre
 * commentaire sur `textMuted` ("le ternaire n'est plus nécessaire"), jamais
 * répercuté ici au moment de la création de ce composant. `theme.textHighlight`/
 * `theme.textMuted` remplacent maintenant la palette fixe pour la couleur DE
 * BASE du titre/sous-titre — `isNaughtyMode` reste bel et bien lu, mais
 * UNIQUEMENT pour le `dark:text-white` conditionnel du sous-titre (voir plus
 * bas), pas pour la couleur de base elle-même, qui vient exclusivement du
 * thème.
 */
export default function ViewHeader({ theme, icon, title, subtitle, right = null, isNaughtyMode = false }) {
  const { cardBorder, textHighlight, textMuted } = theme;

  return (
    <div className={`border-b ${cardBorder} pb-2 pr-32 md:pr-40 flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
      {/* `min-w-0` est nécessaire ici (pas juste sur le <p>) : dans un flex
          item, la largeur par défaut ne descend jamais sous le contenu
          (`min-width: auto`), donc sans ça le sous-titre ne serait JAMAIS
          contraint, quel que soit le mécanisme utilisé pour la 1 ligne. */}
      {/* 9e ITÉRATION (Refactor UI "ligne de flottaison", 29/07, retour
          direct : "les titres ne sont pas alignés avec le logo") — VRAIE
          CAUSE trouvée, ratée lors des itérations précédentes : le badge du
          logo (Sidebar.jsx) a un PADDING autour de son icône (`p-1.5` =
          12px), que l'icône du titre H1 ICI n'a jamais eu (icône nue, pas
          de badge) — même en donnant la MÊME VALEUR NUMÉRIQUE aux deux
          icônes (34px, 5e itération), la ligne du logo restait donc 12px
          plus haute que celle du titre (badge 34+12=46px contre icône
          seule 34px), décalant leurs centres de 6px l'un par rapport à
          l'autre malgré un `pt-6` déjà partagé.
          2 corrections possibles : ajouter le même padding autour de
          l'icône du titre (mais ça n'aurait laissé que 2px de marge avant
          la bordure, `pb-0.5`, trop serré) — ÉCARTÉE au profit d'un simple
          DÉCALAGE du bloc titre+sous-titre de 6px vers le bas (`mt-1.5` sur
          le conteneur juste en dessous), qui recentre les 2 lignes sans
          ajouter de volume visuel :
          - Sidebar (référence FIXE) : pt-6 (24px) + badge (icône 34px +
            padding 12px = 46px) + pb-6 (24px) = 94px jusqu'à sa bordure.
          - `<main>` partage déjà pt-6 (24px) — reste 94 − 24 = 70px.
          - Contenu : `mt-1.5` (6px, le décalage) + icône 34px (ligne
            dominée par elle, sans badge) + `mt-1` (4px) + sous-titre
            `text-sm leading-tight` (≈18px) = 62px → `pb` nécessaire =
            70 − 62 = 8px = `pb-2`, un palier standard, raisonnable (ni
            trop serré comme l'aurait été l'alternative au padding, ni
            trop large comme l'ancien `pb-3.5` calculé sans ce décalage).
          Reste une ESTIMATION de métriques de police (aucun navigateur
          réel dans cet environnement de dev) — calcul complet, documenté,
          à confirmer sur un vrai déploiement. */}
      <div className="min-w-0 mt-1.5">
        <h1 className={`text-2xl font-bold tracking-tight leading-none flex items-center gap-2 ${textHighlight}`}>
          {icon} <span>{title}</span>
        </h1>
        {/* TENTATIVE 25/07 (nouvelle session) — `line-clamp-1` plutôt que
            `truncate`. Les deux forcent une seule ligne, mais par des
            mécanismes de rendu différents : `truncate` = `text-overflow:
            ellipsis` + `white-space:nowrap`, un calcul connu pour mal se
            comporter dans Chromium au tout premier paint quand le parent flex
            change de direction selon un breakpoint (`flex-col sm:flex-row`,
            exactement notre cas) — la troncature peut se calculer sur un état
            de layout pas encore stabilisé, d'où un texte présent dans le DOM
            mais visuellement absent jusqu'à un reflow forcé (resize, DevTools).
            `line-clamp-1` (`display:-webkit-box`+`-webkit-line-clamp`, natif
            Tailwind depuis 3.3, aucun plugin requis) reste utilisé ici à
            travers toutes les itérations suivantes de ce fichier — jamais
            remis en cause, aucun symptôme rapporté depuis son introduction.

            COULEUR CONDITIONNELLE (25/07, retour direct : "uniquement pour
            le mode intime, uniquement pour le mode dark, changer la couleur
            des sous-titres par du blanc") — `isNaughtyMode` était accepté en
            prop par CE composant depuis sa création (voir docstring
            "Usage minimal" en haut de fichier) mais n'était en réalité
            JAMAIS lu ici, ET aucun appelant ne le passait vraiment (juste
            l'exemple en commentaire) — donc sans effet, nulle part. Corrigé
            ici ET dans les 9 vues qui utilisent ce composant. `dark:text-white`
            posé UNIQUEMENT quand `isNaughtyMode` est vrai (condition JS) :
            la variante `dark:` de Tailwind, elle, ne s'active QUE dans un
            contexte `.dark` (voir tailwind.config.js, `darkMode: 'class'`) —
            la combinaison des deux donne exactement "blanc seulement si
            Mode Intime ET thème sombre en même temps", sans plugin ni
            variante Tailwind personnalisée à ajouter. Hors de ce cas précis
            (donc en mode standard, ou en Mode Intime + thème clair), le
            sous-titre garde `textMuted` comme avant — comportement
            inchangé partout ailleurs. */}
        <p className={`mt-1 text-sm leading-tight ${textMuted} line-clamp-1 ${isNaughtyMode ? 'dark:text-white' : ''}`} title={subtitle}>{subtitle}</p>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
