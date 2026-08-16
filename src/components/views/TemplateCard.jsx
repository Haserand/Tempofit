import { Play, Music2, Copy } from 'lucide-react';
import { buildCoverUrl } from '../../utils/coverArt';
import { CATEGORY_DESCRIPTIONS } from '../../data/curatedSessions';

/**
 * TemplateCard — carte d'une playlist ensemencée (voir data/curatedSessions.js),
 * utilisée par DiscoverView.jsx.
 *
 * PIVOT DESIGN (retour direct, "ambiance Spotify") — ancienne version :
 * grande carte texte (description, tags, gros bouton "Utiliser ce modèle").
 * Remplacée par une vraie pochette carrée (`aspect-square`), un bouton play
 * qui n'apparaît qu'au survol (overlay), et titre + auteur + une ligne
 * technique très discrète (activité, durée) en dessous — le format le plus
 * dense et reconnaissable pour parcourir une bibliothèque musicale, plutôt
 * qu'une carte de type "article de blog".
 *
 * RETOUR DIRECT (2e passe, raffinement visuel) — la ligne technique
 * (activité + durée) manquait au 1er jet. Calculée depuis `template.tracks`
 * (jamais stockée en dur) — voir `totalMinutes` plus bas.
 *
 * RETOUR DIRECT (3e passe, "les dégradés font nuancier de peinture") — le
 * fond en dégradé Tailwind est remplacé par une pochette générée (art
 * abstrait géométrique, style DiceBear "shapes"). `coverUrl` n'est PAS un
 * champ stocké dans curatedSessions.js — calculé ici depuis `template.title`
 * comme "seed" (même image stable pour la même playlist à chaque visite).
 *
 * RETOUR DIRECT (4e passe, "pas assez de couleurs différentes, remettre la
 * note de musique au milieu") — 2 corrections :
 *   1. `backgroundColor` forcé avec une LISTE large de teintes (voir
 *      `utils/coverArt.js`, réutilisé ici et par App.jsx) — sans lui, DiceBear piochait
 *      dans son propre choix par défaut, visiblement étroit (bleu/orange/
 *      crème qui reviennent sur presque toutes les pochettes). Une couleur
 *      de cette liste est choisie de façon déterministe à partir du titre
 *      (même seed), donc toujours la même par playlist, mais réparties sur
 *      une palette bien plus large.
 *   2. La note de musique (`Music2`) est réintégrée en overlay CENTRÉ
 *      par-dessus l'image (pas dans l'image elle-même, que DiceBear génère
 *      seul) — repère visuel "pochette d'album" que la 3e passe avait
 *      supprimé par erreur en même temps que l'ancien fond en dégradé.
 *
 * `template.upvotes` n'est plus affiché du tout dans ce design minimal — le
 * seul signal de confiance qui reste visible est le badge "TEMPOFIT" sur la
 * pochette (`isOfficial`).
 *
 * RETOUR DIRECT (5e passe, "la note se voit mal, ajouter une bordure au
 * survol") — 2 corrections : la note (voir plus bas, `Music2`) est agrandie
 * et reçoit une ombre portée pour rester visible sur les teintes CLAIRES de
 * la palette (jaune, citron vert) où elle devenait presque invisible ;
 * `ring-2 ring-white` apparaît au survol sur la pochette elle-même, pas
 * seulement sur le bouton play.
 *
 * RETOUR DIRECT (6e passe, "ajouter le BPM à côté du nom de l'auteur") —
 * BPM moyen calculé depuis `template.tracks` (même formule que
 * PlaylistHeader.jsx/SessionSummaryCard.jsx/StatsView.jsx/App.jsx, jamais
 * une 5e version de ce calcul), affiché sur la ligne auteur plutôt que
 * celle activité/durée juste en dessous — repère utile pour distinguer des
 * modèles au titre peu explicite (ex. "Turbo Cardio", contrairement à
 * "Midnight Runner 160" qui l'indique déjà dans son nom).
 *
 * RETOUR DIRECT (7e passe, 02/08, "chaque playlist en Découvrir devrait au
 * minimum avoir une indication du nombre de clonages") — compteur affiché
 * ici, PARTAGÉ avec `officialVitrineProfile.js` (même template = même
 * nombre, quel que soit l'écran consulté).
 *
 * ⚠️ CORRIGÉ (02/08, 2e retour direct : "je veux que ce compteur soit
 * honnête, 0 par défaut") — n'est PLUS calculé ici en interne
 * (`fakeCloneCountForId`, RETIRÉE de curatedSessions.js, "ambitieux mais
 * faux"). `cloneCount` est maintenant une PROP fournie par
 * `DiscoverView.jsx`, qui la récupère depuis la vraie table
 * `template_clone_counts` (supabase-schema.sql).
 *
 * ⚠️ RÉÉLARGI (14/08, retour direct avec capture : "pourquoi je vois quand
 * même le compteur à 0 pour la playlist que j'ai pourtant clonée ?") — ce
 * compteur s'incrémentait JUSQU'ICI uniquement quand quelqu'un cliquait
 * "Sauvegarder" sur la vitrine `@tempofit_officiel`
 * (`PublicRoutinePreviewModal`/`handleClonePlaylist` pour les playlists),
 * PAS en cliquant "Ajouter" ici (Découvrir) — la distinction de départ
 * ("Ajouter" génère sa propre nouvelle séance, ce n'est pas "copier le
 * contenu de quelqu'un") tenait sur le papier, mais Découvrir étant de
 * très loin le chemin le plus emprunté pour récupérer un template, le
 * compteur restait quasi systématiquement à 0 en pratique — plus trompeur
 * qu'honnête. Les deux chemins créditent désormais le MÊME compteur (voir
 * `handleSavePlaylist`, usePlaylistLibrary.js).
 *
 * RETOUR DIRECT (8e passe, 02/08, "mets les descriptions aussi, pour voir
 * à quoi ça ressemble visuellement") — d'abord un texte de remplissage
 * unique (Lorem ipsum) le temps de voir le rendu, PUIS ⚠️ CORRIGÉ (9e
 * passe, même jour, retour direct : "on ne peut pas avoir une description
 * sur la carte Découvrir et rien du tout en ouvrant la playlist — il faut
 * une synchronisation partout dans l'app") — remplacé par
 * `CATEGORY_DESCRIPTIONS` (curatedSessions.js), la MÊME source déjà
 * utilisée par la vitrine `@tempofit_officiel`
 * (officialVitrineProfile.js) ET par `openCuratedPlaylist`
 * (useNavigation.js, qui reconstruit la playlist réelle à l'ouverture,
 * n'avait ELLE-MÊME jamais eu de description avant ce correctif) — les 3
 * endroits lisent maintenant la même chose, plus de version isolée qui
 * divergeait des 2 autres. Toujours PAS une vraie description par
 * template (juste par catégorie) — l'utilisateur prévoit de réécrire ces
 * templates en profondeur prochainement (voir README.md, "État
 * d'avancement").
 */

export default function TemplateCard({ theme, template, onPlayTemplate, isNaughtyMode, onViewOfficialProfile, cloneCount = 0 }) {
  const { textHighlight, textMuted, bgAccentClass } = theme;

  // Calculée depuis les vrais titres plutôt que stockée en dur dans
  // curatedSessions.js — jamais désynchronisée si la liste de titres change.
  // Arrondie à la minute (pas de secondes) : cette ligne doit rester très
  // discrète, "45 min" se lit d'un coup d'œil, "44m 58s" alourdit pour rien.
  const totalMinutes = Math.round(template.tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60);

  // Même formule que PlaylistHeader.jsx/SessionSummaryCard.jsx/StatsView.jsx/
  // App.jsx (`avgBpm`), jamais recalculée différemment ici — retour direct
  // ("ajouter le BPM à côté du nom de l'auteur, dans Découvrir").
  const avgBpm = template.tracks.length > 0
    ? Math.round(template.tracks.reduce((s, t) => s + (t.bpm || 0), 0) / template.tracks.length)
    : null;

  // Palette/format d'URL désormais dans utils/coverArt.js (réutilisée telle
  // quelle par App.jsx, `openCuratedPlaylist`, pour que la pochette
  // persiste sur la fiche détail de la playlist — voir ce fichier).
  const coverUrl = buildCoverUrl(template.title);

  return (
    // `cloneCount` transmis à `onPlayTemplate` (05/08, retour direct : "je
    // ne vois pas le nombre de clones dans une playlist... c'est la
    // demande de base") — cette carte reçoit déjà `cloneCount` en prop
    // (calculé une fois pour toute la grille par DiscoverView.jsx/
    // ProfileView.jsx), mais ce chiffre s'arrêtait jusqu'ici à la carte :
    // le clic ouvrait `template` seul, sans lui, laissant la page détail
    // (PlaylistHeader.jsx) sans AUCUN moyen de l'afficher — pas caché,
    // jamais reçu. `{ cloneCount }` correspond à la signature de
    // `openCuratedPlaylist(template, extraFields)` (useNavigation.js),
    // fusionné dans `currentPlaylist` comme n'importe quel autre champ de
    // `extraFields`.
    <div className="group cursor-pointer select-none" onClick={() => onPlayTemplate(template, { cloneCount })}>
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md bg-surface-hover ring-2 ring-transparent group-hover:ring-white transition-all">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />

        {/* RETOUR DIRECT ("la note se voit mal sur les teintes claires") —
            agrandie (36 → 56) et une ombre portée (`drop-shadow`) ajoutée :
            sans elle, une icône blanche semi-transparente devient quasi
            invisible sur les fonds jaune/citron vert de la palette, alors
            qu'elle ressortait déjà bien sur les fonds sombres — l'ombre
            garantit un contraste qui ne dépend plus de la couleur de fond
            tirée au sort. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Music2 size={56} className="text-white/80 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-opacity duration-300 group-hover:opacity-0" />
        </div>

        {/* ⚠️ BUG RÉEL CORRIGÉ (14/08, retour direct : "TEMPOFIT est pas
            cliquable alors qu'on a dit que c'était l'emplacement dédié
            pour le pseudo") — le clic était bien câblé (onClick +
            stopPropagation), mais jamais ATTEINT : l'overlay du bouton
            play juste en dessous (`absolute inset-0`, transparent tant
            qu'on ne survole pas) vient APRÈS ce badge dans le DOM — sans
            z-index explicite, 2 éléments en `position: absolute`
            s'empilent selon leur ordre DANS LE DOM, celui qui vient après
            passe AU-DESSUS, même invisible. Cet overlay couvre TOUTE la
            carte (`inset-0`), donc il recouvrait le coin du badge et
            interceptait le clic avant qu'il n'atteigne le bouton en
            dessous — remontant alors jusqu'au `onClick` de la carte
            entière (ouvrir la playlist) au lieu du badge (voir profil).
            `z-10` fait gagner le badge dans l'empilement, quel que soit
            l'ordre DOM. */}
        {template.isOfficial && (
          onViewOfficialProfile ? (
            <button
              onClick={(e) => { e.stopPropagation(); onViewOfficialProfile(); }}
              className="absolute top-2 left-2 z-10 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-colors cursor-pointer"
              title="Voir le profil TempoFit Officiel"
            >
              TempoFit
            </button>
          ) : (
            <span className="absolute top-2 left-2 z-10 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white">
              TempoFit
            </span>
          )
        )}

        {/* Compteur de clonages (02/08) — DÉPLACÉ sur la pochette (14/08,
            retour direct : "pour gagner de la place, le compteur en bas à
            droite de la pochette ?") — complète le badge "TempoFit" en
            haut à gauche par une symétrie diagonale, et libère la ligne
            "chapeau" entière qui ne contenait plus que lui depuis le
            retrait de l'auteur (voir plus bas). `z-10` posé DIRECTEMENT
            ici dès l'écriture — pas après coup cette fois — même leçon que
            le badge "TempoFit" juste au-dessus : sans lui, l'overlay du
            bouton play (`absolute inset-0`, juste en dessous dans le DOM)
            s'empilerait par-dessus lui à l'assombrissement du survol
            (`group-hover:bg-black/20`), l'atténuant visiblement alors que
            le badge "TempoFit", lui, resterait net — incohérence purement
            esthétique ici (ce badge n'est pas cliquable, pas de bug
            fonctionnel possible), mais autant les traiter à égalité. */}
        <span
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white"
          title="Nombre de fois où cette playlist a été clonée"
        >
          <Copy size={10} />{cloneCount}
        </span>

        {/* Overlay + bouton play — invisible tant qu'on ne survole pas la
            pochette (opacity-0 → 100 sur .group:hover). Le bouton n'est PLUS
            positionné en absolute lui-même (ancien bottom-2 right-2, en
            décalage avec la note centrale qu'il ne remplaçait pas) — il est
            maintenant un enfant flex normal de CET overlay (déjà en
            `absolute inset-0`), centré par le `flex items-center
            justify-center` du conteneur plutôt que par son propre
            positionnement : mêmes classes de centrage que le bouton play de
            l'en-tête de playlist (PlaylistHeader.jsx), pour une expérience
            de survol identique partout dans l'app. */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <button
            onClick={(e) => { e.stopPropagation(); onPlayTemplate(template, { cloneCount }); }}
            title="Écouter cette playlist"
            className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 hover:scale-105 ${bgAccentClass}`}
          >
            <Play size={20} className="fill-white ml-0.5"/>
          </button>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        {/* Ligne "chapeau" (auteur + compteur de clonages) — RETIRÉE
            ENTIÈREMENT (14/08). Historique : l'auteur avait déjà été
            retiré plus tôt le même jour (redondant avec le badge
            "TempoFit" sur la pochette) ; ce qui restait — le seul
            compteur de clonages — vient maintenant lui aussi de déménager
            sur la pochette (coin inférieur droit, voir plus haut), sur
            demande explicite ("pour gagner de la place"). Le titre suit
            donc directement la pochette, sans ligne intermédiaire. */}
        <h3 className={`font-bold text-sm truncate ${textHighlight}`} title={template.title}>{template.title}</h3>
        {/* RETOUR RECUL (harmonisation contraste, juillet 2026) : `opacity-70`
            retirée — elle atténuait un texte DÉJÀ atténué (`textMuted`),
            contraste final ~1.8:1 sur fond clair (illisible, cause directe
            du problème signalé en Mode Intime). `textMuted` seul (voir la
            correction du token --color-muted dans index.css) suffit
            largement à distinguer cette ligne du titre au-dessus. */}
        <div className={`flex items-center gap-1 text-xs truncate ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`}>
          {/* `title=` (14/08, retour direct : "il manque pas les infobulles
              sur les metadata de Découvrir ?") — motif DIFFÉRENT de la
              convention "icônes seules" déjà actée (README.md) : ici pas
              d'icône du tout, c'est du texte TRONQUÉ (`truncate`,
              ellipsis) sans moyen de voir le reste au survol. Même
              correctif appliqué au titre juste au-dessus (`h3`, lui aussi
              tronqué). Motif bien plus large que cette seule carte — voir
              README.md, nouvelle section dédiée. */}
          <span className="truncate" title={`${template.workoutType} • ${totalMinutes} min${avgBpm != null ? ` • ${avgBpm} BPM` : ''}`}>
            {template.workoutType} • {totalMinutes} min{avgBpm != null ? ` • ${avgBpm} BPM` : ''}
          </span>
        </div>
        {/* Description par CATÉGORIE (9e passe, 02/08) — voir la docstring
            en tête de fichier : même source que la vitrine ET la playlist
            réellement ouverte (openCuratedPlaylist, useNavigation.js) —
            plus de version isolée. `line-clamp-1` (05/08, resserré depuis
            `line-clamp-2` — retour direct : "je voulais UNE ligne max ;
            pas 2"), même convention que PublicItemCard (ProfileView.jsx)
            pour une vraie playlist/routine. */}
        <p className={`text-xs mt-1 line-clamp-1 ${textMuted} ${isNaughtyMode ? 'dark:text-white' : ''}`} title={CATEGORY_DESCRIPTIONS[template.category]}>
          {CATEGORY_DESCRIPTIONS[template.category]}
        </p>
      </div>
    </div>
  );
}
