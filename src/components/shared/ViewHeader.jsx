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
 * `isNaughtyMode` — OMIS (pas juste `false`) pour les vues qui n'ont
 * structurellement aucune notion de mode (Trophées, Options & Comptes :
 * partagées entre les deux modes, jamais reçu `isNaughtyMode` en prop) :
 * bascule alors sur les tokens de thème adaptatifs `textHighlight`/
 * `textMuted` plutôt que la palette fixe slate-950/blanc + slate-700/300 —
 * PAS la même chose que passer `isNaughtyMode={false}` explicitement (qui,
 * lui, demande la palette fixe en mode Standard).
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
 * Normalisation typographique Mode Intime (retour direct, hérité de
 * PlaylistsView.jsx avant cette extraction : "le bordeaux/rose sur fond
 * nacré est illisible, standardise sur text-slate-900" — un 2e passage
 * après une 1re tentative en tons rose/bordeaux jugée encore incohérente).
 * Couleurs en DUR (`text-white`/`text-slate-950`/etc.) plutôt que les
 * tokens sémantiques `textHighlight`/`textMuted`, quand `isNaughtyMode` est
 * fourni : décision produit explicite, appliquée aux 2 modes uniformément.
 * Risque à surveiller, signalé mais assumé : `text-white` en repli Standard
 * suppose un fond sombre — si ce mode est un jour utilisé en thème CLAIR
 * (bg-base pâle), ce titre redeviendrait illisible à son tour,
 * symétriquement au bug déjà corrigé une fois.
 */
export default function ViewHeader({ theme, isNaughtyMode = undefined, icon, title, subtitle, right = null }) {
  const { cardBorder, textHighlight, textMuted } = theme;
  const usesFixedPalette = isNaughtyMode !== undefined;
  const titleColorClass = usesFixedPalette ? (isNaughtyMode ? 'text-slate-950' : 'text-white') : textHighlight;
  const subtitleColorClass = usesFixedPalette ? (isNaughtyMode ? 'text-slate-700' : 'text-slate-300') : textMuted;

  return (
    <div className={`border-b ${cardBorder} pb-6 pr-32 md:pr-40 flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
      {/* `min-w-0` — sans lui, un enfant de flex refuse par défaut de rétrécir
          sous la largeur de son propre contenu (`min-width: auto` implicite) :
          `truncate` sur le sous-titre juste en dessous n'aurait alors jamais
          d'effet visible sur un écran large, seulement si le texte débordait
          déjà pour une autre raison — piège Flexbox classique, pas une
          option cosmétique. */}
      <div className="min-w-0">
        <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${titleColorClass}`}>
          {icon} <span>{title}</span>
        </h1>
        {/* Sous-titre verrouillé sur UNE seule ligne (`truncate`, 25/07) —
            avant, un texte trop long passait sur 2 lignes selon la vue,
            cassant l'esthétique "Dashboard" en changeant de page (un en-tête
            plus haut qu'un autre). Toujours les MÊMES classes typographiques
            ici, jamais redéfinies par vue — voir PlaylistsView.jsx/
            GeneratorView.jsx (25/07) pour des textes raccourcis en amont,
            plutôt que de compter sur la troncature seule pour masquer un
            texte déjà trop long. */}
        <p className={`mt-2 text-sm md:text-base truncate ${subtitleColorClass}`}>{subtitle}</p>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}
