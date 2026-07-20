import { Heart, Sparkles, ArrowRight } from 'lucide-react';

/**
 * TemplateCard — carte d'un modèle de séance ensemencé (voir
 * data/curatedSessions.js), utilisée par DiscoverView.jsx.
 *
 * Isolée volontairement pour validation AVANT de construire toute la vue
 * (grille/défilement par catégorie) — voir la discussion : design très aéré
 * (gros paddings, coins très arrondis), façon carte Spotify.
 *
 * RETOUR DIRECT ("pas de faux upvotes présentés comme réels") — le nombre de
 * votes ne s'affiche QUE si `template.upvotes > 0` (aucun modèle ensemencé
 * n'en a pour l'instant, voir curatedSessions.js) ; le badge "Sélection
 * TempoFit" (`isOfficial`) sert de preuve sociale à la place, HONNÊTE
 * puisque vérifiable (c'est vraiment nous qui l'avons créé), contrairement à
 * un chiffre de vote inventé.
 */
export default function TemplateCard({ theme, template, onUseTemplate }) {
  const { cardBg, cardBorder, textHighlight, textMuted, bgAccentClass } = theme;

  return (
    <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} shadow-sm hover:border-gray-400 transition-colors flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className={`font-bold text-xl leading-snug ${textHighlight}`}>{template.title}</h3>
        {template.isOfficial && (
          <span className={`shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full text-white ${bgAccentClass}`}>
            <Sparkles size={11}/> Sélection TempoFit
          </span>
        )}
      </div>

      <p className={`text-sm ${textMuted}`}>{template.description}</p>

      <div className="flex flex-wrap gap-2">
        {template.tags.map((tag, i) => (
          <span key={i} className={`text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-hover ${textMuted}`}>
            {tag}
          </span>
        ))}
      </div>

      <div className={`flex items-center justify-between pt-3 mt-auto border-t ${cardBorder}`}>
        <div className={`text-xs ${textMuted}`}>
          Par <span className="font-semibold">{template.author}</span>
        </div>
        {template.upvotes > 0 && (
          <div className={`flex items-center gap-1 text-xs font-bold ${textMuted}`}>
            <Heart size={14} className="text-red-400 fill-red-400"/> {template.upvotes}
          </div>
        )}
      </div>

      <button
        onClick={() => onUseTemplate(template)}
        className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all hover:brightness-110 flex items-center justify-center gap-2 ${bgAccentClass}`}
      >
        <span>Utiliser ce modèle</span>
        <ArrowRight size={16}/>
      </button>
    </div>
  );
}
