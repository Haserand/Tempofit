import { useState, useEffect } from 'react';
import { Compass, Search, SearchX, Users, Lock, UserX, Loader2 } from 'lucide-react';
import { curatedSessions, naughtyCuratedSessions } from '../../data/curatedSessions';
import TemplateCard from './TemplateCard';
import ViewHeader from '../shared/ViewHeader';
import TabPills from '../shared/TabPills';
import { VIEW_HEADER_ICON_SIZE, VIEW_CONTENT_WRAPPER } from '../../layout/viewHeaderLayout';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';

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
 *
 * ⚠️ RECHERCHE DE PROFILS FUSIONNÉE ICI (20/08, retour direct — "pouvoir
 * chercher un compte utilisateur directement depuis l'onglet découvrir,
 * via un onglet dans la barre de recherche") — la pastille "Profils"
 * séparée qui ouvrait `SearchUsersModal.jsx` (01/08) est retirée,
 * remplacée par un VRAI sélecteur de mode (`searchMode`, onglets
 * "Séances"/"Profils") juste au-dessus de la barre de recherche : la
 * MÊME barre sert maintenant aux deux, seul ce qu'elle interroge change.
 * Logique de recherche de profils (debounce 350ms, `search_public_profiles`)
 * REPRISE À L'IDENTIQUE de SearchUsersModal.jsx (toujours d'actualité,
 * accessible depuis le menu avatar — 2 chemins vers la même fonctionnalité,
 * pas dupliquée en profondeur : voir sa docstring pour le détail du Login
 * Wall/de ce que la fonction RPC renvoie).
 *
 * Invités (`!user`) : PAS de simple masquage comme avant (l'ancienne
 * pastille "Profils" disparaissait purement et simplement) — l'onglet
 * "Profils" reste VISIBLE et cliquable, mais bascule sur un message
 * incitatif ("Rejoins la communauté...") plutôt qu'un champ de recherche
 * voué à échouer. Décision consciente (retour direct, même échange) : la
 * fonction `search_public_profiles` reste verrouillée aux comptes
 * authentifiés côté serveur (`revoke ... from anon`, supabase-schema.sql)
 * — un visiteur non connecté ne PEUT PAS chercher un pseudo (recherche =
 * énumération potentielle de comptes existants, sujet différent de
 * "peut-on consulter un profil trouvé"), seulement être invité à se
 * connecter pour y accéder. Distinct du Login Wall de ProfileView.jsx
 * (qui, lui, verrouille la CONSULTATION d'un profil déjà identifié) —
 * ici on verrouille la RECHERCHE elle-même, une étape avant.
 */
export default function DiscoverView({ theme, onPlayTemplate, isNaughtyMode, user, openModal, onViewOfficialProfile, onViewProfile }) {
  const { textHighlight, textMuted, cardBg, cardBorder, inputBg, inputBorder, bgAccentClass } = theme;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toutes');

  // Recherche de profils (20/08, voir la docstring en tête de fichier) —
  // state INDÉPENDANT de `searchQuery`/`activeCategory` ci-dessus : basculer
  // d'un onglet à l'autre garde chaque recherche intacte plutôt que
  // d'effacer l'une en changeant l'autre.
  const [searchMode, setSearchMode] = useState('sessions'); // 'sessions' | 'profiles'
  const [profileQuery, setProfileQuery] = useState('');
  const [profileResults, setProfileResults] = useState([]);
  const [profileSearchStatus, setProfileSearchStatus] = useState('idle'); // 'idle' | 'searching' | 'ready'

  // Debounce 350ms — repris à l'identique de SearchUsersModal.jsx (voir sa
  // docstring pour le raisonnement complet). `user`/`isSupabaseConfigured`
  // gardés en dépendances : si l'un des deux devient faux en cours de route
  // (déconnexion), la recherche s'arrête proprement au lieu de continuer à
  // interroger une fonction qui va de toute façon refuser l'appel.
  useEffect(() => {
    if (searchMode !== 'profiles' || !user || !isSupabaseConfigured) return;
    const trimmed = profileQuery.trim();
    if (trimmed.length < 2) { setProfileResults([]); setProfileSearchStatus('idle'); return; }

    setProfileSearchStatus('searching');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_public_profiles', { search_query: trimmed });
      if (cancelled) return;
      setProfileResults(!error && Array.isArray(data) ? data : []);
      setProfileSearchStatus('ready');
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [profileQuery, searchMode, user]);

  // Compteurs de clonages RÉELS (02/08, retour direct : "je veux que
  // chaque playlist en Découvrir ait au minimum une indication du nombre
  // de clonage... honnête, 0 par défaut") — table PUBLIQUE en lecture
  // (`template_clone_counts`, supabase-schema.sql), MÊME source que la
  // vitrine `@tempofit_officiel` (officialVitrineProfile.js) : un
  // template affiche donc TOUJOURS le même nombre ici et là-bas. ⚠️
  // RÉÉLARGI (14/08) : s'incrémente désormais aussi bien depuis Découvrir
  // ("Ajouter", handleSavePlaylist) que depuis la vitrine ("Sauvegarder",
  // handleClonePlaylist) — voir la docstring de TemplateCard.jsx pour le
  // détail de ce changement. Un seul fetch au montage (table petite, ~30
  // templates + 4 routines fictives — pas la peine de re-fetch à chaque
  // changement de recherche/catégorie, purement des filtres locaux qui ne
  // changent jamais ce total).
  const [realCloneCounts, setRealCloneCounts] = useState({});

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    supabase.from('template_clone_counts').select('template_id, clone_count').then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('[DiscoverView] échec de la récupération des compteurs de clonage réels :', error);
        return;
      }
      if (data) setRealCloneCounts(Object.fromEntries(data.map(row => [row.template_id, row.clone_count])));
    });
    return () => { cancelled = true; };
  }, []);

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
        {/* Sélecteur de mode Séances/Profils (20/08) — standardisé sur
            TabPills.jsx (21/08, retour direct), même composant partagé
            désormais avec PlaylistsView.jsx/ProfileView.jsx/
            SettingsView.jsx/TrophiesView.jsx. */}
        <TabPills
          theme={theme}
          activeTab={searchMode}
          onChange={setSearchMode}
          tabs={[
            { value: 'sessions', label: 'Séances' },
            { value: 'profiles', label: 'Profils' },
          ]}
        />

        {/* Barre de recherche — UNIQUE pour les 2 onglets, seul ce qu'elle
            interroge change. Masquée en mode "Profils" pour un invité (pas
            de champ actif menant nulle part) : le message incitatif
            plus bas la remplace entièrement. */}
        {(searchMode === 'sessions' || user) && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${inputBorder} ${inputBg}`}>
            {searchMode === 'profiles' ? <Users size={20} className={textMuted}/> : <Search size={20} className={textMuted}/>}
            <input
              type="text"
              value={searchMode === 'profiles' ? profileQuery : searchQuery}
              onChange={(e) => searchMode === 'profiles' ? setProfileQuery(e.target.value.toLowerCase()) : setSearchQuery(e.target.value)}
              placeholder={searchMode === 'profiles' ? 'Pseudo (ex: alex_runner)' : 'Rechercher une séance, un style, un BPM...'}
              className={`flex-1 bg-transparent outline-hidden text-sm ${textHighlight}`}
            />
            {searchMode === 'profiles' && profileSearchStatus === 'searching' && <Loader2 size={16} className={`animate-spin ${textMuted}`}/>}
          </div>
        )}

        {/* Pilules de catégorie — UNIQUEMENT en mode "Séances" (sans objet
            en mode "Profils", pas de catégorie à filtrer). L'ancienne
            pastille "Profils" séparée (01/08) qui vivait ici, en bout de
            rangée, est retirée — remplacée par le sélecteur d'onglet
            ci-dessus, plus visible et qui ne se confond plus avec une
            simple pilule de catégorie. */}
        {searchMode === 'sessions' && (
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
          </div>
        )}
      </div>

      {searchMode === 'profiles' ? (
        !user ? (
          // Message incitatif (PAS un simple masquage) — retour direct :
          // "concevoir un autre message incitatif à se créer un compte pour
          // avoir accès à ces comptes utilisateurs là où tu implémentes la
          // fonction pour les connectés". Même famille visuelle que le
          // Login Wall de ProfileView.jsx (icône ronde + titre + texte +
          // CTA), mais PAS le même verrou : celui-ci porte sur la
          // RECHERCHE elle-même (voir la docstring en tête de fichier),
          // pas sur la consultation d'un profil déjà identifié.
          <div className="flex flex-col items-center justify-center text-center py-16 gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${bgAccentClass} text-white`}>
              <Lock size={28} />
            </div>
            {/* FUSIONNÉ EN UNE SEULE LIGNE (retour direct, 28/08 — "prends du
                recul... j'aime bien comme pour la vue stats n'avoir qu'un
                bouton avec un message au-dessus") — même chantier que celui
                du 20/08 sur StatsView.jsx (voir sa docstring : "titre blanc"
                + "sous-titre gris qui redit presque la même chose" faisait
                trop) : avant, `<p>` titre "Rejoins la communauté TempoFit"
                + `<p>` gris "Trouve d'autres utilisateurs..." en dessous —
                redondant, le titre générique n'apportait rien que le
                sous-titre n'expliquait pas déjà mieux. Un seul texte
                maintenant, même construction ("Découvre..." plutôt que
                "Rejoins..."), même style que le message de StatsView.jsx
                (`text-lg font-bold max-w-sm mx-auto`) — RÉUTILISE le budget
                de caractères déjà confirmé réel là-bas (38-40 caractères à
                cette taille/largeur, voir sa docstring) plutôt que d'en
                réestimer un nouveau à l'aveugle. 39 caractères ici (aucune
                variable — contrairement à ProfileView.jsx juste après, qui
                doit composer avec un pseudo de longueur variable — donc
                garanti sur une ligne, pas juste une estimation). */}
            <h3 className={`text-lg font-bold max-w-sm mx-auto ${textHighlight}`}>
              Découvre profils et playlists publiques.
            </h3>
            <button
              onClick={() => openModal('AUTH')}
              className={`mt-2 px-6 py-3 rounded-xl font-bold text-white shadow-md hover:brightness-110 transition-all ${bgAccentClass}`}
            >
              Se connecter / S'inscrire
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {profileQuery.trim().length > 0 && profileQuery.trim().length < 2 && (
              <p className={`text-xs text-center py-4 ${textMuted}`}>Encore un caractère...</p>
            )}

            {profileQuery.trim().length === 0 && (
              <div className="flex flex-col items-center text-center py-16 gap-3">
                <Users size={40} className={textMuted}/>
                <p className={`text-sm ${textMuted}`}>Cherche un pseudo pour trouver d'autres utilisateurs.</p>
              </div>
            )}

            {profileSearchStatus === 'ready' && profileResults.length === 0 && profileQuery.trim().length >= 2 && (
              <div className="flex flex-col items-center text-center py-16 gap-3">
                <UserX size={40} className={textMuted}/>
                <p className={`font-bold ${textHighlight}`}>Aucun profil public trouvé pour "{profileQuery.trim()}".</p>
              </div>
            )}

            {profileResults.map(r => (
              <button
                key={r.username}
                onClick={() => onViewProfile(r.username)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-surface-hover transition-colors text-left"
              >
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5 font-bold`}>
                    {r.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className={`font-bold text-sm truncate ${textHighlight}`} title={`@${r.username}`}>@{r.username}</span>
              </button>
            ))}
          </div>
        )
      ) : isFiltering ? (
        filteredSessions.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {filteredSessions.map(template => (
              <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} isNaughtyMode={isNaughtyMode} onViewOfficialProfile={onViewOfficialProfile} cloneCount={realCloneCounts[template.id] || 0} />
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
                <TemplateCard key={template.id} theme={theme} template={template} onPlayTemplate={onPlayTemplate} isNaughtyMode={isNaughtyMode} onViewOfficialProfile={onViewOfficialProfile} cloneCount={realCloneCounts[template.id] || 0} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
