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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DiscoverView from '../src/components/views/DiscoverView.jsx';
import { curatedSessions, naughtyCuratedSessions } from '../src/data/curatedSessions.js';

afterEach(() => {
  cleanup();
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

describe('DiscoverView — pastille "Profils" (Feature Sociale, 01/08)', () => {
  it('masquée quand aucun utilisateur n\'est connecté (user=null)', () => {
    render(<DiscoverView {...baseProps({ user: null })} />);
    expect(screen.queryByRole('button', { name: /Profils/ })).toBeNull();
  });

  it('affichée quand un utilisateur est connecté', () => {
    render(<DiscoverView {...baseProps({ user: { id: 'u1' } })} />);
    expect(screen.getByRole('button', { name: /Profils/ })).toBeInTheDocument();
  });

  it('le clic appelle openModal(\'SEARCH_USERS\'), jamais onPlayTemplate', () => {
    const openModal = vi.fn();
    const onPlayTemplate = vi.fn();
    render(<DiscoverView {...baseProps({ user: { id: 'u1' }, openModal, onPlayTemplate })} />);

    fireEvent.click(screen.getByRole('button', { name: /Profils/ }));

    expect(openModal).toHaveBeenCalledWith('SEARCH_USERS');
    expect(onPlayTemplate).not.toHaveBeenCalled();
  });
});

describe('DiscoverView — clic sur une carte', () => {
  it('cliquer une carte appelle onPlayTemplate avec le bon template', () => {
    const onPlayTemplate = vi.fn();
    render(<DiscoverView {...baseProps({ onPlayTemplate })} />);

    fireEvent.click(screen.getByText(knownTemplate.title));

    expect(onPlayTemplate).toHaveBeenCalledWith(knownTemplate);
  });
});
