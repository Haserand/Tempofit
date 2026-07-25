import { useState } from 'react';
import { Lock, Compass, Search, SearchX } from 'lucide-react';
import { curatedSessions, naughtyCuratedSessions } from '../../data/curatedSessions';
import TemplateCard from './TemplateCard';
import ViewHeader from '../shared/ViewHeader';

/**
 * DiscoverView — bibliothèque de modèles de séances ensemencés (voir
 * data/curatedSessions.js), pour éviter une page vide avant qu'une vraie
 * communauté n'existe (Cold Start Problem).
 *
 * Groupée par `category` en grille responsive (1/2/3 colonnes) — pas de
 * défilement horizontal pour la grille elle-même : c'est le pattern déjà
 * utilisé partout ailleurs dans l'app (RoutinesView, PlaylistsView), plus
 * cohérent qu'introduire un nouveau type d'interaction ici pour cette seule
 * vue. Le défilement horizontal N'EST utilisé que pour la rangée de pilules
 * de catégories (voir plus bas), là où c'est déjà l'usage établi ailleurs
 * dans l'app (voir Genres, GeneratorView.jsx).
 *
 * "Publier ma propre séance" : bouton visuellement désactivé (cadenas,
 * opacité réduite, curseur "not-allowed") — pose les bases visuelles de la
 * V2 communautaire sans promettre une fonctionnalité qui n'existe pas encore.
 *
 * RETOUR DIRECT ("recherche + filtres, maintenant que le catalogue est à 30
 * playlists") — recherche/filtre entièrement LOCAUX à ce composant (pas de
 * state levé dans App.jsx) : purement de l'affichage, rien à synchroniser
 * ailleurs. La recherche porte sur `title`/`category`/`workoutType`/les
 * genres RÉELS des titres (`template.tracks[].genre`) — PAS sur une
 * `description`/des `tags` stockés, qui n'existent plus dans le modèle de
 * données depuis les pivots précédents (voir curatedSessions.js).
 *
 * UX choisie pour le rendu filtré (le brief laissait le choix) : dès qu'un
 * filtre est actif (recherche texte OU catégorie ≠ "Toutes"), on bascule
 * sur UNE SEULE grille unifiée des résultats — plutôt que de garder le
 * découpage par section, qui laisserait des titres de catégorie répétés
 * pour rien (si on a déjà choisi une pilule de catégorie précise) ou des
 * sections partiellement vides (si la recherche ne matche que certaines
 * catégories).
 */
export default function DiscoverView({ theme, onPlayTemplate, isNaughtyMode }) {
  const { textHighlight, textMuted, cardBg, cardBorder, inputBg, inputBorder, bgAccentClass } = theme;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toutes');

  // Pare-feu Mode Intime (retour direct : "Découvrir mélange les contenus
  // des deux modes") — UN SEUL catalogue actif à la fois, choisi ici et
  // utilisé PARTOUT ensuite dans ce composant (recherche, catégories,
  // grille) : jamais de référence directe à `curatedSessions` plus bas,
  // toujours à `activeSessions`, pour ne pas avoir 2 chemins de code à
  // maintenir en parallèle pour une même logique d'affichage.
  const activeSessions = isNaughtyMode ? naughtyCuratedSessions : curatedSessions;

  const categories = [...new Set(activeSessions.map(t => t.category))];

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchesSearch = (template) => {
    if (!normalizedQuery) return true;
    const genres = [...new Set(template.tracks.map(t => t.genre).filter(Boolean))];
    const haystack = [template.title, template.category, template.workoutType, ...genres].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  };
  const matchesCategory = (template) => activeCategory === 'Toutes' || template.category === activeCategory;

  const isFiltering = normalizedQuery !== '' || activeCategory !== 'Toutes';
  const filteredSessions = activeSessions.filter(t => matchesCategory(t) && matchesSearch(t));

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <ViewHeader
        theme={theme} isNaughtyMode={isNaughtyMode}
        icon={<Compass className={theme.textColorClass} size={36} />}
        title="Découvrir"
        subtitle="Des séances prêtes à l'emploi, sélectionnées par TempoFit — un clic pour les adapter à ton profil."
      />

      {/* Recherche + filtres — voir la docstring pour ce qui est réellement
          cherché (pas de description/tags stockés dans le modèle actuel). */}
      <div className="space-y-4">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${inputBorder} ${inputBg}`}>
          <Search size={20} className={textMuted}/>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une séance, un style, un BPM..."
            className={`flex-1 bg-transparent outline-none text-sm ${textHighlight}`}
          />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Bloc de gauche : Pilules de catégories */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
            <button
              onClick={() => setActiveCategory('Toutes')}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeCategory === 'Toutes' ? `${bgAccentClass} text-white` : `${cardBg} border ${cardBorder} ${textMuted} hover:text-main`}`}
            >
              Toutes
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-colors ${activeCategory === category ? `${bgAccentClass} text-white` : `${cardBg} border ${cardBorder} ${textMuted} hover:text-main`}`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Bloc de droite : Bouton Publier — redescendu ici (25/07) depuis
              le ViewHeader : la marge de sécurité `pr-32 md:pr-40` du
              ViewHeader (anti-collision avec les boutons flottants
              Thème/Connexion) laissait trop peu de place à un bouton aussi
              large que "Publier ma propre séance" à côté du titre — l'en-tête
              doit rester pur (titre + sous-titre uniquement), ce bouton
              d'action trouve sa place naturelle ici, face aux filtres. */}
          <button
            disabled
            title="Bientôt disponible"
            className={`shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed opacity-60 ${cardBg} border ${cardBorder} ${textMuted}`}
          >
            <Lock size={16}/> <span>Publier ma propre séance</span>
          </button>
        </div>
      </div>

      {isFiltering ? (
        filteredSessions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredSessions.map(template => (
              <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <SearchX size={40} className={isNaughtyMode ? 'text-slate-800' : 'text-slate-400'}/>
            <p className={`font-bold ${isNaughtyMode ? 'text-slate-950' : 'text-white'}`}>
              {normalizedQuery ? `Aucune séance trouvée pour "${searchQuery.trim()}".` : 'Aucune séance dans cette catégorie.'}
            </p>
            <p className={`text-sm ${isNaughtyMode ? 'text-slate-800' : 'text-slate-400'}`}>Essaie autre chose !</p>
          </div>
        )
      ) : (
        categories.map(category => (
          <div key={category}>
            <h2 className={`text-xl font-bold mb-4 sm:mb-6 ${isNaughtyMode ? 'text-slate-950' : 'text-white'}`}>{category}</h2>
            {/* .slice(0, 5) — retour direct ("la 6e carte retombe seule sur
                une 2e ligne, grand vide inutile") : la grille passe à 6
                colonnes seulement à partir de `xl:` (voir grid-cols
                ci-dessous) — en dessous de ce point de rupture (desktop à
                100%, la plupart des résolutions courantes), une catégorie de
                6 playlists laisse déjà sa dernière carte seule sur une
                nouvelle ligne quel que soit le nombre de colonnes réel à cet
                instant. Uniquement ICI (vue par catégorie, catalogue
                ensemencé) — jamais sur `filteredSessions` juste au-dessus :
                des résultats de recherche/filtre doivent rester complets,
                perdre silencieusement des correspondances au-delà de la 5e
                serait un vrai bug, pas une amélioration visuelle. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {activeSessions.filter(t => t.category === category).slice(0, 5).map(template => (
                <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
