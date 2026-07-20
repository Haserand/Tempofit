import { Lock, Compass } from 'lucide-react';
import { curatedSessions } from '../../data/curatedSessions';
import TemplateCard from './TemplateCard';

/**
 * DiscoverView — bibliothèque de modèles de séances ensemencés (voir
 * data/curatedSessions.js), pour éviter une page vide avant qu'une vraie
 * communauté n'existe (Cold Start Problem).
 *
 * Groupée par `category` en grille responsive (1/2/3 colonnes) — pas de
 * défilement horizontal : c'est le pattern déjà utilisé partout ailleurs
 * dans l'app (RoutinesView, PlaylistsView), plus cohérent qu'introduire un
 * nouveau type d'interaction ici pour cette seule vue.
 *
 * "Publier ma propre séance" : bouton visuellement désactivé (cadenas,
 * opacité réduite, curseur "not-allowed") — pose les bases visuelles de la
 * V2 communautaire sans promettre une fonctionnalité qui n'existe pas encore.
 */
export default function DiscoverView({ theme, onUseTemplate }) {
  const { textHighlight, textMuted, cardBg, cardBorder } = theme;

  const categories = [...new Set(curatedSessions.map(t => t.category))];

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 md:pt-12">
      <div className={`border-b ${cardBorder} pb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4`}>
        <div>
          <h1 className={`text-3xl md:text-4xl font-bold flex items-center space-x-3 ${textHighlight}`}>
            <Compass className={theme.textColorClass} size={36} /> <span>Découvrir</span>
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)] dark:[text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">Des séances prêtes à l'emploi, sélectionnées par TempoFit — un clic pour les adapter à ton profil.</p>
        </div>
        <button
          disabled
          title="Bientôt disponible"
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed opacity-60 ${cardBg} border ${cardBorder} ${textMuted}`}
        >
          <Lock size={16}/> <span>Publier ma propre séance</span>
        </button>
      </div>

      {categories.map(category => (
        <div key={category}>
          <h2 className={`text-xl font-bold mb-4 ${textHighlight}`}>{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {curatedSessions.filter(t => t.category === category).map(template => (
              <TemplateCard key={template.id} theme={theme} template={template} onUseTemplate={onUseTemplate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
