/**
 * ViewHeader — en-tête standard de TOUTE vue de premier niveau (celles
 * listées dans la Sidebar : Nouvelle séance, Mes Routines, Découvrir, Mes
 * Séances, Mes Favoris, Statistiques, Trophées, Options & Comptes...).
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
 *     icon={<Zap className={theme.textColorClass} size={36} />}
 *     title="Sculpte ta séance" subtitle="Laisse l'algorithme..." />
 *
 * `icon` — un ÉLÉMENT déjà construit (`<Zap className="..." size={36}/>`),
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
 * `theme.textMuted` remplacent maintenant la palette fixe INCONDITIONNELLEMENT
 * (`isNaughtyMode` n'a donc plus d'effet sur la couleur du texte — il reste
 * accepté en prop pour compatibilité mais n'est plus lu ici).
 */
export default function ViewHeader({ theme, icon, title, subtitle, right = null }) {
  const { cardBorder, textHighlight, textMuted } = theme;

  return (
    <div className={`border-b ${cardBorder} pb-6 pr-32 md:pr-40 flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
      {/* `min-w-0` — permet à ce bloc de rétrécir sous la largeur de son
          contenu si besoin (`min-width: auto` est la valeur par défaut d'un
          enfant de flex, qui l'en empêcherait sinon) : garde une bonne
          hygiène Flexbox même sans `truncate` (retiré, voir plus bas) — utile
          si un titre+icône très long devait un jour cohabiter avec `right`. */}
      <div className="min-w-0">
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
          {icon} <span>{title}</span>
        </h1>
        {/* BUG RÉEL CORRIGÉ (25/07, découvert et confirmé via inspection live
            après un signalement "le sous-titre est invisible, mais visible
            si j'ouvre les DevTools") — `truncate` posait `overflow: hidden`
            sur ce `<p>`, DIRECTEMENT enfant (via le wrapper `min-w-0`) du
            conteneur `animate-in slide-in-from-bottom-4` de CHAQUE vue (voir
            GeneratorView.jsx/PlaylistsView.jsx/etc.) — un conteneur qui
            ANIME un `transform` à l'entrée. Bug de rendu Chromium connu :
            du contenu `overflow: hidden` à l'intérieur d'un ancêtre dont le
            `transform` est en cours d'animation peut ne jamais se peindre
            au premier rendu (DOM/classes/texte corrects, confirmé par
            inspection — zéro pixel visible tant qu'aucun reflow forcé
            n'est déclenché, ex. ouvrir les DevTools). `truncate` retiré :
            le sous-titre peut à nouveau passer sur 2 lignes sur un écran
            très étroit avec un texte très long, un compromis largement
            préférable à un texte invisible pour tout le monde au premier
            chargement. Les textes déjà raccourcis (même chantier) rendent
            ce cas rare en pratique. */}
        <p className={`mt-2 text-sm md:text-base ${textMuted}`}>{subtitle}</p>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
