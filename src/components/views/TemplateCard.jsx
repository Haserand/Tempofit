import { Play, Music2 } from 'lucide-react';

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
 *      `COVER_BACKGROUND_COLORS` plus bas) — sans lui, DiceBear piochait
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
 */

// Palette volontairement large et variée (12 teintes) — voir le retour
// direct plus haut. Format hex SANS le "#" (attendu tel quel par l'API
// DiceBear pour le paramètre backgroundColor).
const COVER_BACKGROUND_COLORS = [
  'f87171', 'fb923c', 'fbbf24', 'a3e635', '4ade80', '2dd4bf',
  '38bdf8', '818cf8', 'a78bfa', 'e879f9', 'fb7185', '94a3b8',
].join(',');

export default function TemplateCard({ theme, template, onPlayTemplate }) {
  const { textHighlight, textMuted, bgAccentClass } = theme;

  // Calculée depuis les vrais titres plutôt que stockée en dur dans
  // curatedSessions.js — jamais désynchronisée si la liste de titres change.
  // Arrondie à la minute (pas de secondes) : cette ligne doit rester très
  // discrète, "45 min" se lit d'un coup d'œil, "44m 58s" alourdit pour rien.
  const totalMinutes = Math.round(template.tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60);

  // `encodeURIComponent` : le titre peut contenir des espaces/apostrophes
  // ("Powerlifter's Anthem") — doivent être encodés proprement dans l'URL.
  const coverUrl = `https://api.dicebear.com/10.x/shapes/svg?seed=${encodeURIComponent(template.title)}&backgroundColor=${COVER_BACKGROUND_COLORS}`;

  return (
    <div className="group cursor-pointer select-none" onClick={() => onPlayTemplate(template)}>
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md bg-surface-hover">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />

        {/* Repère visuel "pochette d'album" — semi-transparent pour rester
            discret par-dessus n'importe quelle couleur de fond générée. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Music2 size={36} className="text-white/40" />
        </div>

        {template.isOfficial && (
          <span className="absolute top-2 left-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-white">
            TempoFit
          </span>
        )}

        {/* Overlay + bouton play — invisible tant qu'on ne survole pas la
            pochette (opacity-0 → 100 sur .group:hover), translaté légèrement
            vers le bas au repos pour un petit effet de "montée" au survol,
            comme sur Spotify. */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        <button
          onClick={(e) => { e.stopPropagation(); onPlayTemplate(template); }}
          title="Écouter cette playlist"
          className={`absolute bottom-2 right-2 w-11 h-11 rounded-full text-white shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all hover:scale-105 ${bgAccentClass}`}
        >
          <Play size={18} className="fill-white ml-0.5"/>
        </button>
      </div>

      <div className="mt-2 px-0.5">
        <h3 className={`font-bold text-sm truncate ${textHighlight}`}>{template.title}</h3>
        <p className={`text-xs truncate ${textMuted}`}>{template.author}</p>
        <p className={`text-xs truncate ${textMuted} opacity-70`}>{template.workoutType} • {totalMinutes} min</p>
      </div>
    </div>
  );
}
