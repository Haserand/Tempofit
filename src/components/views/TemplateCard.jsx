import { Play, Music2 } from 'lucide-react';
import { buildCoverUrl } from '../../utils/coverArt';

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
 */

export default function TemplateCard({ theme, template, onPlayTemplate }) {
  const { textHighlight, textMuted, bgAccentClass } = theme;

  // Calculée depuis les vrais titres plutôt que stockée en dur dans
  // curatedSessions.js — jamais désynchronisée si la liste de titres change.
  // Arrondie à la minute (pas de secondes) : cette ligne doit rester très
  // discrète, "45 min" se lit d'un coup d'œil, "44m 58s" alourdit pour rien.
  const totalMinutes = Math.round(template.tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60);

  // Palette/format d'URL désormais dans utils/coverArt.js (réutilisée telle
  // quelle par App.jsx, `openCuratedPlaylist`, pour que la pochette
  // persiste sur la fiche détail de la playlist — voir ce fichier).
  const coverUrl = buildCoverUrl(template.title);

  return (
    <div className="group cursor-pointer select-none" onClick={() => onPlayTemplate(template)}>
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

        {template.isOfficial && (
          <span className="absolute top-2 left-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white">
            TempoFit
          </span>
        )}

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
            onClick={(e) => { e.stopPropagation(); onPlayTemplate(template); }}
            title="Écouter cette playlist"
            className={`w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 hover:scale-105 ${bgAccentClass}`}
          >
            <Play size={20} className="fill-white ml-0.5"/>
          </button>
        </div>
      </div>

      <div className="mt-2 px-0.5">
        <h3 className={`font-bold text-sm truncate ${textHighlight}`}>{template.title}</h3>
        <p className={`text-xs truncate ${textMuted}`}>{template.author}</p>
        <p className={`text-xs truncate ${textMuted} opacity-70`}>{template.workoutType} • {totalMinutes} min</p>
      </div>
    </div>
  );
}
