import { Play } from 'lucide-react';

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
 * (activité + durée) manquait au 1er jet : sans elle, impossible de savoir
 * pour quel sport/quelle durée est pensée une playlist avant de cliquer
 * dessus. Calculée depuis `template.tracks` (jamais stockée en dur) — voir
 * `totalMinutes` plus bas.
 *
 * RETOUR DIRECT (3e passe, "les dégradés font nuancier de peinture") — le
 * fond en dégradé Tailwind (`coverGradient`) est remplacé par une VRAIE
 * pochette générée (art abstrait géométrique, style DiceBear "shapes",
 * https://www.dicebear.com/styles/shapes/ — vérifié à jour, version 10.x,
 * la 8.x proposée au départ arrive en fin de vie en 2028). `coverUrl` n'est
 * PAS un champ stocké dans curatedSessions.js (qui n'a d'ailleurs plus
 * `coverGradient` du tout) — calculé ici depuis `template.title` comme
 * "seed" : DiceBear renvoie TOUJOURS la même image pour le même seed, donc
 * chaque playlist garde une pochette stable et unique sans rien stocker de
 * plus, exactement le même principe déjà appliqué au tag discret
 * (`totalMinutes` ci-dessous) et validé ensemble à cette occasion.
 *
 * `template.upvotes` n'est plus affiché du tout dans ce design minimal — le
 * seul signal de confiance qui reste visible est le badge "TEMPOFIT" sur la
 * pochette (`isOfficial`), cohérent avec le principe déjà posé (pas de faux
 * chiffre de vote) mais encore plus discret qu'avant (texte seul, sans
 * icône, pour rester lisible sur n'importe quel fond d'image abstraite).
 */
export default function TemplateCard({ theme, template, onPlayTemplate }) {
  const { textHighlight, textMuted, bgAccentClass } = theme;

  // Calculée depuis les vrais titres plutôt que stockée en dur dans
  // curatedSessions.js — jamais désynchronisée si la liste de titres change.
  // Arrondie à la minute (pas de secondes) : cette ligne doit rester très
  // discrète, "45 min" se lit d'un coup d'œil, "44m 58s" alourdit pour rien.
  const totalMinutes = Math.round(template.tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60);

  // `encodeURIComponent` : le titre peut contenir des espaces/apostrophes
  // ("Powerlifter's Anthem") — doivent être encodés proprement dans l'URL.
  // Pas de `backgroundColor` forcé : le style "shapes" varie déjà ses
  // propres couleurs à partir du seed, pas besoin d'imposer une palette par
  // catégorie qui aurait pu sembler arbitraire.
  const coverUrl = `https://api.dicebear.com/10.x/shapes/svg?seed=${encodeURIComponent(template.title)}`;

  return (
    <div className="group cursor-pointer select-none" onClick={() => onPlayTemplate(template)}>
      <div className="relative aspect-square rounded-xl overflow-hidden shadow-md bg-surface-hover">
        <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />

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
