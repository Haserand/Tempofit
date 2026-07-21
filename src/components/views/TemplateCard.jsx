import { Play, Sparkles, Music2 } from 'lucide-react';

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
 * `template.upvotes` n'est plus affiché du tout dans ce design minimal — le
 * seul signal de confiance qui reste visible est le badge "TempoFit" sur la
 * pochette (`isOfficial`), cohérent avec le principe déjà posé (pas de faux
 * chiffre de vote) mais encore plus discret qu'avant.
 */
export default function TemplateCard({ theme, template, onPlayTemplate }) {
  const { textHighlight, textMuted, bgAccentClass } = theme;

  // Calculée depuis les vrais titres plutôt que stockée en dur dans
  // curatedSessions.js — jamais désynchronisée si la liste de titres change.
  // Arrondie à la minute (pas de secondes) : cette ligne doit rester très
  // discrète, "45 min" se lit d'un coup d'œil, "44m 58s" alourdit pour rien.
  const totalMinutes = Math.round(template.tracks.reduce((s, t) => s + (t.duration || 0), 0) / 60);

  return (
    <div className="group cursor-pointer select-none" onClick={() => onPlayTemplate(template)}>
      <div className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${template.coverGradient} shadow-md`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Music2 size={40} className="text-white/25" />
        </div>

        {template.isOfficial && (
          <span className="absolute top-2 left-2 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/25 text-white/80 backdrop-blur-sm">
            <Sparkles size={9}/> TempoFit
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
