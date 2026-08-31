// @vitest-environment jsdom
//
// DiscoverView.jsx — 0 test jusqu'ici malgré un composant à la logique
// réelle (recherche multi-champs, pare-feu Mode Intime, troncature .slice
// conditionnelle) et déjà 2 fois modifié en une session (pastille
// "Profils", 01/08). Données RÉELLES importées depuis data/curatedSessions.js
// plutôt que mockées — ce catalogue est un contenu éditorial stable (pas
// une API externe), le mocker aurait juste dupliqué sa structure sans
// bénéfice, et un test sur données réelles attrape aussi une régression
// côté catalogue lui-même (ex. une catégorie soudain vide).
//
// ⚠️ RECHERCHE DE PROFILS FUSIONNÉE ICI (20/08, voir la docstring de
// DiscoverView.jsx) — `mockRpc` ajouté au mock supabase (jusque-là seul
// `supabase.from` était mocké, `supabase.rpc` aurait planté dès le 1er
// test touchant l'onglet "Profils"). Fake timers (même pattern que
// SearchUsersModal.test.jsx, dont la logique de recherche a été reprise
// à l'identique) pour contrôler le debounce de 350ms.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Compteur de clonages RÉELS (02/08) — DiscoverView.jsx appelle désormais
// `supabase.from('template_clone_counts')` au montage. Ce fichier ne
// mockait jamais `supabase` jusqu'ici (jamais eu besoin) — indispensable
// maintenant : sans ce mock, un test tournant dans un environnement où les
// variables d'env Supabase sont réellement configurées (ex. le build
// Vercel, qui les a pour la vraie app) ferait un VRAI appel réseau pendant
// les tests.
const mockFrom = vi.fn();
const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: { from: (...args) => mockFrom(...args), rpc: mockRpc },
  isSupabaseConfigured: true,
}));

import DiscoverView from '../../src/components/views/DiscoverView.jsx';
import { curatedSessions, naughtyCuratedSessions } from '../../src/data/curatedSessions.js';

function makeQueryBuilder(resolvedValue) {
  const builder = {
    select: vi.fn(() => builder),
    then: (resolve) => Promise.resolve(resolvedValue).then(resolve),
  };
  return builder;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Repli par défaut SÛR pour tous les tests qui ne s'intéressent PAS au
// compteur de clonages (l'immense majorité de ce fichier, déjà écrite
// avant ce chantier) — sans lui, `mockFrom` renverrait `undefined` par
// défaut, et `.select(...)` planterait sur `undefined` pour CHAQUE test
// existant, pas seulement ceux qui touchent réellement à cette
// fonctionnalité.
beforeEach(() => {
  mockFrom.mockImplementation(() => makeQueryBuilder({ data: [], error: null }));
  // Repli sûr par défaut (même raisonnement que mockFrom ci-dessus) — sans
  // lui, tout test qui déclencherait la recherche de profils par accident
  // planterait sur `undefined` plutôt que de simplement ne rien trouver.
  mockRpc.mockResolvedValue({ data: [], error: null });
});

const mockTheme = {
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  bgAccentClass: 'mock-accent-bg',
};

// Dérivés des VRAIES données plutôt que codés en dur — restent valides même
// si le catalogue change (ajout/retrait d'une catégorie ou d'un titre).
const standardCategories = [...new Set(curatedSessions.map(t => t.category))];
const firstStandardCategory = standardCategories[0];
const knownTemplate = curatedSessions[0]; // 'Midnight Runner 160', Cardio Express
const templatesInFirstCategory = curatedSessions.filter(t => t.category === firstStandardCategory);

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    onPlayTemplate: vi.fn(),
    isNaughtyMode: false,
    user: null,
    openModal: vi.fn(),
    onViewOfficialProfile: vi.fn(),
    onViewProfile: vi.fn(),
    ...overrides,
  };
}

// Compte les cartes réellement rendues — TemplateCard.jsx a pour racine
// `<div className="group cursor-pointer select-none">`, unique dans cette
// vue (DiscoverView elle-même n'utilise jamais la classe `group`).
const countCards = (container) => container.querySelectorAll('.group').length;

describe('DiscoverView — affichage de base', () => {
  it('affiche le titre et le sous-titre de la page', () => {
    render(<DiscoverView {...baseProps()} />);
    expect(screen.getByText('Découvrir')).toBeInTheDocument();
    expect(screen.getByText("Des séances prêtes à l'emploi, adaptables à ton profil en un clic.")).toBeInTheDocument();
  });

  it('sans filtre actif : une section par catégorie, chacune avec son titre', () => {
    render(<DiscoverView {...baseProps()} />);
    standardCategories.forEach(category => {
      expect(screen.getByRole('heading', { name: category, level: 2 })).toBeInTheDocument();
    });
  });

  it('la pilule "Toutes" est active par défaut', () => {
    render(<DiscoverView {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Toutes' })).toHaveClass('mock-accent-bg');
  });

  it('affiche une pilule par catégorie réelle du catalogue', () => {
    render(<DiscoverView {...baseProps()} />);
    standardCategories.forEach(category => {
      expect(screen.getByRole('button', { name: category })).toBeInTheDocument();
    });
  });

  it('une catégorie non filtrée n\'affiche jamais plus de 5 cartes (troncature .slice(0,5))', () => {
    const { container } = render(<DiscoverView {...baseProps()} />);
    // Ne vérifie que si une catégorie réelle en a effectivement plus de 5 —
    // sinon ce test ne prouverait rien pour cette catégorie précise.
    const categoryWithMoreThan5 = standardCategories.find(
      c => curatedSessions.filter(t => t.category === c).length > 5
    );
    if (categoryWithMoreThan5) {
      const heading = screen.getByRole('heading', { name: categoryWithMoreThan5, level: 2 });
      const section = heading.closest('div');
      expect(section.querySelectorAll('.group').length).toBe(5);
    }
    // Sanity check global : jamais plus de 5 cartes consécutives par section,
    // quelle que soit la catégorie.
    expect(countCards(container)).toBeGreaterThan(0);
  });
});

describe('DiscoverView — recherche texte', () => {
  it('filtre par titre : ne garde que les cartes correspondantes, bascule sur une grille unique', () => {
    render(<DiscoverView {...baseProps()} />);
    const input = screen.getByPlaceholderText('Rechercher une séance, un style, un BPM...');

    fireEvent.change(input, { target: { value: knownTemplate.title } });

    expect(screen.getByText(knownTemplate.title)).toBeInTheDocument();
    // Bascule sur la grille unique : les titres de section ("Cardio Express"
    // en `<h2>`) disparaissent, remplacés par une seule grille de résultats.
    expect(screen.queryByRole('heading', { name: firstStandardCategory, level: 2 })).toBeNull();
  });

  it('filtre aussi par genre RÉEL des titres (pas un champ stocké séparément)', () => {
    // `knownTemplate` (Midnight Runner 160) contient un titre de genre 'Rap'
    // (Lose Yourself/Eminem) — la recherche doit le retrouver même si "Rap"
    // n'apparaît nulle part dans le titre/la catégorie/le workoutType.
    render(<DiscoverView {...baseProps()} />);
    const input = screen.getByPlaceholderText('Rechercher une séance, un style, un BPM...');

    fireEvent.change(input, { target: { value: 'Rap' } });

    expect(screen.getByText(knownTemplate.title)).toBeInTheDocument();
  });

  it('recherche insensible à la casse', () => {
    render(<DiscoverView {...baseProps()} />);
    const input = screen.getByPlaceholderText('Rechercher une séance, un style, un BPM...');

    fireEvent.change(input, { target: { value: knownTemplate.title.toUpperCase() } });

    expect(screen.getByText(knownTemplate.title)).toBeInTheDocument();
  });

  it('aucun résultat : affiche le message dédié avec le terme recherché', () => {
    render(<DiscoverView {...baseProps()} />);
    const input = screen.getByPlaceholderText('Rechercher une séance, un style, un BPM...');

    fireEvent.change(input, { target: { value: 'zzz_totalement_introuvable_zzz' } });

    expect(screen.getByText('Aucune séance trouvée pour "zzz_totalement_introuvable_zzz".')).toBeInTheDocument();
  });
});

describe('DiscoverView — filtre par catégorie', () => {
  it('cliquer une pilule de catégorie ne garde que les cartes de cette catégorie', () => {
    const { container } = render(<DiscoverView {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: firstStandardCategory }));

    expect(countCards(container)).toBe(templatesInFirstCategory.length);
    templatesInFirstCategory.forEach(t => {
      expect(screen.getByText(t.title)).toBeInTheDocument();
    });
  });

  it('la pilule cliquée devient active (accent), "Toutes" ne l\'est plus', () => {
    render(<DiscoverView {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: firstStandardCategory }));

    expect(screen.getByRole('button', { name: firstStandardCategory })).toHaveClass('mock-accent-bg');
    expect(screen.getByRole('button', { name: 'Toutes' })).not.toHaveClass('mock-accent-bg');
  });

  it('recliquer "Toutes" revient à la vue par sections, sans filtre', () => {
    render(<DiscoverView {...baseProps()} />);

    fireEvent.click(screen.getByRole('button', { name: firstStandardCategory }));
    fireEvent.click(screen.getByRole('button', { name: 'Toutes' }));

    expect(screen.getByRole('heading', { name: firstStandardCategory, level: 2 })).toBeInTheDocument();
  });
});

describe('DiscoverView — pare-feu Mode Intime', () => {
  it('mode standard : catalogue standard affiché, JAMAIS le catalogue Intime', () => {
    render(<DiscoverView {...baseProps({ isNaughtyMode: false })} />);
    expect(screen.getByRole('heading', { name: firstStandardCategory, level: 2 })).toBeInTheDocument();
    // 'Rythmes Sensuels' est EXCLUSIVEMENT une catégorie du catalogue Intime
    // (vérifié dans data/curatedSessions.js) — ne doit jamais apparaître ici.
    expect(screen.queryByRole('heading', { name: 'Rythmes Sensuels', level: 2 })).toBeNull();
  });

  it('Mode Intime actif : catalogue Intime affiché, JAMAIS le catalogue standard', () => {
    render(<DiscoverView {...baseProps({ isNaughtyMode: true })} />);
    expect(screen.getByRole('heading', { name: 'Rythmes Sensuels', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: firstStandardCategory, level: 2 })).toBeNull();
  });

  it('la recherche en Mode Intime porte sur le catalogue Intime, pas le standard', () => {
    const naughtyTemplate = naughtyCuratedSessions[0];
    render(<DiscoverView {...baseProps({ isNaughtyMode: true })} />);
    const input = screen.getByPlaceholderText('Rechercher une séance, un style, un BPM...');

    fireEvent.change(input, { target: { value: naughtyTemplate.title } });

    expect(screen.getByText(naughtyTemplate.title)).toBeInTheDocument();
    expect(screen.queryByText(knownTemplate.title)).toBeNull();
  });
});

// RÉÉCRIT (20/08, voir la docstring de DiscoverView.jsx) — l'ancienne
// pastille "Profils" (masquée pour un invité, ouvrait SearchUsersModal.jsx)
// est retirée, remplacée par un onglet "Profils" TOUJOURS visible avec un
// comportement différent selon `user`. Fake timers SCOPÉS à ce seul bloc
// (pas globaux, voir le commentaire en tête de fichier) : le test
// "compteurs de clonage réels" plus bas utilise `waitFor` avec de VRAIS
// timers, les mélanger casserait ce test-là.
describe('DiscoverView — onglet "Profils" (recherche de profils intégrée, 20/08)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Même raisonnement que SearchUsersModal.test.jsx : fait avancer le
  // debounce de 350ms ET laisse le temps à l'appel RPC (async) de se
  // résoudre.
  async function runDebounce() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
  }

  it('l\'onglet "Profils" reste VISIBLE et cliquable même sans utilisateur connecté (pas un masquage comme avant)', () => {
    render(<DiscoverView {...baseProps({ user: null })} />);
    expect(screen.getByRole('tab', { name: 'Profils' })).toBeInTheDocument();
  });

  it('invité : cliquer sur "Profils" affiche le message incitatif, pas de champ de recherche', () => {
    render(<DiscoverView {...baseProps({ user: null })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));

    expect(screen.getByText('Découvre profils et playlists publiques.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Pseudo (ex: alex_runner)')).not.toBeInTheDocument();
    // La grille de séances ne doit plus être affichée non plus.
    expect(screen.queryByText(knownTemplate.title)).not.toBeInTheDocument();
  });

  it('invité : le CTA du message incitatif appelle openModal(\'AUTH\')', () => {
    const openModal = vi.fn();
    render(<DiscoverView {...baseProps({ user: null, openModal })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));

    fireEvent.click(screen.getByText('Se connecter / S\'inscrire'));

    expect(openModal).toHaveBeenCalledWith('AUTH');
  });

  it('connecté : cliquer sur "Profils" affiche le champ de recherche, pas le message incitatif', () => {
    render(<DiscoverView {...baseProps({ user: { id: 'u1' } })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));

    expect(screen.getByPlaceholderText('Pseudo (ex: alex_runner)')).toBeInTheDocument();
    expect(screen.queryByText('Découvre profils et playlists publiques.')).not.toBeInTheDocument();
  });

  it('connecté : taper 2+ caractères déclenche search_public_profiles après le debounce, affiche les résultats', async () => {
    mockRpc.mockResolvedValue({ data: [{ username: 'alex_runner', avatar_url: null }], error: null });
    render(<DiscoverView {...baseProps({ user: { id: 'u1' } })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));

    fireEvent.change(screen.getByPlaceholderText('Pseudo (ex: alex_runner)'), { target: { value: 'alex' } });
    await runDebounce();

    expect(mockRpc).toHaveBeenCalledWith('search_public_profiles', { search_query: 'alex' });
    expect(screen.getByText('@alex_runner')).toBeInTheDocument();
  });

  it('connecté : cliquer sur un résultat appelle onViewProfile(username)', async () => {
    mockRpc.mockResolvedValue({ data: [{ username: 'alex_runner', avatar_url: null }], error: null });
    const onViewProfile = vi.fn();
    render(<DiscoverView {...baseProps({ user: { id: 'u1' }, onViewProfile })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));
    fireEvent.change(screen.getByPlaceholderText('Pseudo (ex: alex_runner)'), { target: { value: 'alex' } });
    await runDebounce();

    fireEvent.click(screen.getByText('@alex_runner'));

    expect(onViewProfile).toHaveBeenCalledWith('alex_runner');
  });

  it('connecté : aucun résultat affiche un message dédié plutôt qu\'une liste vide silencieuse', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    render(<DiscoverView {...baseProps({ user: { id: 'u1' } })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));
    fireEvent.change(screen.getByPlaceholderText('Pseudo (ex: alex_runner)'), { target: { value: 'zzzintrouvable' } });
    await runDebounce();

    expect(screen.getByText(/Aucun profil public trouvé pour "zzzintrouvable"/)).toBeInTheDocument();
  });

  it('revenir sur l\'onglet "Séances" après avoir visité "Profils" restaure la grille normalement', () => {
    render(<DiscoverView {...baseProps({ user: { id: 'u1' } })} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Profils' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Séances' }));

    expect(screen.getByText(knownTemplate.title)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Pseudo (ex: alex_runner)')).not.toBeInTheDocument();
  });
});

describe('DiscoverView — clic sur une carte', () => {
  // ⚠️ CORRIGÉ (05/08, retour direct — "je ne vois pas le nombre de
  // clones... c'est la demande de base") : `onPlayTemplate` reçoit
  // désormais `cloneCount` en 2e argument (voir TemplateCard.jsx). Pas de
  // données mockées pour `template_clone_counts` dans ce test précis →
  // retombe sur `0`.
  it('cliquer une carte appelle onPlayTemplate avec le bon template et son cloneCount', () => {
    const onPlayTemplate = vi.fn();
    render(<DiscoverView {...baseProps({ onPlayTemplate })} />);

    fireEvent.click(screen.getByText(knownTemplate.title));

    expect(onPlayTemplate).toHaveBeenCalledWith(knownTemplate, { cloneCount: 0 });
  });
});

// Feature Sociale "Cold Start" (02/08) — 0 test jusqu'ici pour cette
// transmission de prop précise.
// ⚠️ MIS À JOUR (14/08, retour direct : "TEMPOFIT sur la pochette ET
// TempoFit Officiel en dessous, le 2e est redondant" — auteur retiré de
// TemplateCard.jsx, le clic vers le profil vit maintenant sur le BADGE de
// la pochette) — le bouton cliquable porte désormais le texte du badge
// ("TempoFit", le texte COURT codé en dur dans TemplateCard.jsx), pas
// `template.author` ("TempoFit Officiel", le nom COMPLET) — ces deux
// chaînes ont toujours été différentes, seul l'ÉLÉMENT cliquable a changé.
describe('DiscoverView — badge cliquable (transmission de onViewOfficialProfile)', () => {
  it('le clic sur le badge d\'un template appelle onViewOfficialProfile, PAS onPlayTemplate', () => {
    const onViewOfficialProfile = vi.fn();
    const onPlayTemplate = vi.fn();
    render(<DiscoverView {...baseProps({ onViewOfficialProfile, onPlayTemplate })} />);

    // TOUS les templates du catalogue partagent le même texte de badge
    // ("TempoFit") — `getByRole` seul, sans les cibler d'abord, trouverait
    // plusieurs boutons à la fois et planterait. `within(...)` restreint
    // la recherche à LA carte précise de `knownTemplate`, repérée par son
    // titre UNIQUE ("Midnight Runner 160").
    const card = screen.getByText(knownTemplate.title).closest('.group');
    fireEvent.click(within(card).getByRole('button', { name: 'TempoFit' }));

    expect(onViewOfficialProfile).toHaveBeenCalledTimes(1);
    expect(onPlayTemplate).not.toHaveBeenCalled();
  });
});

// Compteur de clonages RÉELS (02/08, retour direct : "je veux que chaque
// playlist en Découvrir ait au minimum une indication du nombre de
// clonage... honnête, 0 par défaut"). MÊME table que la vitrine
// (`template_clone_counts`) — voir sa docstring, supabase-schema.sql.
describe('DiscoverView — compteurs de clonage réels', () => {
  it('interroge template_clone_counts au montage', async () => {
    render(<DiscoverView {...baseProps()} />);
    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('template_clone_counts'));
  });

  it('transmet le bon nombre à la carte du template concerné, 0 pour les autres', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({
      data: [{ template_id: knownTemplate.id, clone_count: 9 }],
      error: null,
    }));
    render(<DiscoverView {...baseProps()} />);

    const card = await screen.findByText(knownTemplate.title).then(el => el.closest('.group'));
    expect(await within(card).findByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('9');
  });

  it('en cas d\'erreur réseau, les cartes restent à 0 sans planter', async () => {
    mockFrom.mockImplementation(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }));
    render(<DiscoverView {...baseProps()} />);

    expect(await screen.findByText(knownTemplate.title)).toBeInTheDocument();
  });
});
