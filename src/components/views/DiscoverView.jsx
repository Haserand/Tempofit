import { useState } from 'react';
import { Compass, Search, SearchX, Users } from 'lucide-react';
import { curatedSessions, naughtyCuratedSessions } from '../../data/curatedSessions';
import TemplateCard from './TemplateCard';
import ViewHeader from '../shared/ViewHeader';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';

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
 * "Publier ma propre séance" (bouton visuellement désactivé, cadenas +
 * opacité réduite) retiré entièrement le 25/07 (chantier "polish UI des
 * en-têtes") : encombrait l'interface pour une fonctionnalité qui n'existe
 * encore nulle part (pas de V2 communautaire en vue) — à réintroduire le
 * jour où elle a une vraie destination, pas avant.
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
export default function DiscoverView({ theme, onPlayTemplate, isNaughtyMode, user, openModal }) {
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
    <div className={`${VIEW_CONTENT_WRAPPER} space-y-8`}>
      <ViewHeader
        theme={theme}
        isNaughtyMode={isNaughtyMode}
        icon={<Compass className={theme.textColorClass} size={VIEW_HEADER_ICON_SIZE} />}
        title="Découvrir"
        subtitle="Des séances prêtes à l'emploi, adaptables à ton profil en un clic."
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
            className={`flex-1 bg-transparent outline-hidden text-sm ${textHighlight}`}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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

          {/* Pastille "Profils" (Feature Sociale — Navigation, 01/08,
              retour direct : "je la veux en option dans le menu découvrir
              au départ") — délibérément SÉPARÉE des pilules de catégorie
              juste au-dessus (un `border-l` + un peu d'espace la détache
              visuellement du groupe) : ce n'est PAS un filtre de la grille
              de séances, c'est une action différente (ouvrir
              SearchUsersModal.jsx) — la confondre visuellement avec
              "Cardio Express"/"Force & Renfo" aurait laissé croire à tort
              qu'elle filtre aussi la grille du dessous. Icône `Users`
              (pas `Search`, déjà utilisé par le champ de recherche de
              séances juste au-dessus — éviter la répétition d'icône entre
              2 actions différentes sur la même vue). Masquée si non
              connecté (Login Wall déjà en place côté
              ProfileView.jsx/get_public_profile_summary — cohérent de ne
              pas proposer une recherche vouée à échouer). */}
          {user && (
            <button
              onClick={() => openModal('SEARCH_USERS')}
              className={`shrink-0 ml-2 pl-4 pr-4 py-2 border-l ${cardBorder} flex items-center gap-1.5 rounded-full text-sm font-bold transition-colors ${cardBg} border ${textMuted} hover:text-main`}
            >
              <Users size={14} />
              Profils
            </button>
          )}
        </div>
      </div>

      {isFiltering ? (
        filteredSessions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredSessions.map(template => (
              <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} isNaughtyMode={isNaughtyMode} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
            <SearchX size={40} className={textMuted}/>
            <p className={`font-bold ${textHighlight}`}>
              {normalizedQuery ? `Aucune séance trouvée pour "${searchQuery.trim()}".` : 'Aucune séance dans cette catégorie.'}
            </p>
            <p className={`text-sm ${textMuted}`}>Essaie autre chose !</p>
          </div>
        )
      ) : (
        categories.map(category => (
          <div key={category}>
            <h2 className={`text-xl font-bold mb-4 sm:mb-6 ${textHighlight}`}>{category}</h2>
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
                <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} isNaughtyMode={isNaughtyMode} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
