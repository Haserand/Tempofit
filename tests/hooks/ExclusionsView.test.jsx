// @vitest-environment jsdom
//
// Premier fichier de test pour ExclusionsView.jsx (28/08, chantier
// "mécanisme d'exclusion") — même patron que FavoritesView.test.js.
// `musicCatalog.js` mocké pour la même raison : `getGenresForDisplay` est
// déjà couverte par tests/config/musicCatalog.test.js (fonction pure).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
  STANDARD_GENRES: ['Pop', 'Rock'],
  NAUGHTY_GENRES: ['R&B Sensuel'],
  EXTRA_GENRES: ['Jazz', 'Autre'],
}));

import ExclusionsView from '../../src/components/views/ExclusionsView.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  bgAccentClass: 'mock-accent-bg',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
};

const excludedTrack = { trackId: 'deezer-1', title: 'Photograph', artist: 'Nickelback', bpm: 100, genre: 'Rock' };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isNaughtyMode: false,
    exclusions: { tracks: [], artists: [], genres: [] },
    toggleTrackExclusion: vi.fn(),
    toggleArtistExclusion: vi.fn(),
    toggleGenreExclusion: vi.fn(),
    newExclusionArtist: '',
    setNewExclusionArtist: vi.fn(),
    isAddingExclusionArtist: false,
    setIsAddingExclusionArtist: vi.fn(),
    ...overrides,
  };
}

describe('ExclusionsView', () => {
  it('message "aucun titre exclu" quand la liste des titres est vide', () => {
    render(<ExclusionsView {...baseProps()} />);
    expect(screen.getByText(/Aucun titre exclu/)).toBeInTheDocument();
  });

  it('affiche les titres exclus (titre, artiste, BPM)', () => {
    render(<ExclusionsView {...baseProps({ exclusions: { tracks: [excludedTrack], artists: [], genres: [] } })} />);
    expect(screen.getByText('Photograph')).toBeInTheDocument();
    expect(screen.getByText(/Nickelback/)).toBeInTheDocument();
    expect(screen.getByText('100 BPM')).toBeInTheDocument();
  });

  it('retirer un titre exclu appelle toggleTrackExclusion avec ce titre', () => {
    const toggleTrackExclusion = vi.fn();
    render(<ExclusionsView {...baseProps({ exclusions: { tracks: [excludedTrack], artists: [], genres: [] }, toggleTrackExclusion })} />);

    fireEvent.click(screen.getByTitle('Retirer des exclusions'));

    expect(toggleTrackExclusion).toHaveBeenCalledWith(excludedTrack);
  });

  it('affiche les artistes exclus, retrait au clic sur le X', () => {
    const toggleArtistExclusion = vi.fn();
    render(<ExclusionsView {...baseProps({ exclusions: { tracks: [], artists: ['Nickelback'], genres: [] }, toggleArtistExclusion })} />);

    expect(screen.getByText('Nickelback')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Nickelback').parentElement.querySelector('button'));

    expect(toggleArtistExclusion).toHaveBeenCalledWith('Nickelback');
  });

  it('bouton "+" ouvre le formulaire d\'ajout d\'artiste', () => {
    const setIsAddingExclusionArtist = vi.fn();
    render(<ExclusionsView {...baseProps({ setIsAddingExclusionArtist })} />);

    fireEvent.click(screen.getByTitle('Exclure un artiste'));

    expect(setIsAddingExclusionArtist).toHaveBeenCalledWith(true);
  });

  it('formulaire ouvert : Entrée sur le champ appelle toggleArtistExclusion avec le nom tapé', () => {
    const toggleArtistExclusion = vi.fn();
    const setNewExclusionArtist = vi.fn();
    const setIsAddingExclusionArtist = vi.fn();
    render(<ExclusionsView {...baseProps({
      isAddingExclusionArtist: true, newExclusionArtist: 'Coldplay',
      toggleArtistExclusion, setNewExclusionArtist, setIsAddingExclusionArtist,
    })} />);

    fireEvent.keyDown(screen.getByPlaceholderText("Nom de l'artiste..."), { key: 'Enter' });

    expect(toggleArtistExclusion).toHaveBeenCalledWith('Coldplay');
    expect(setNewExclusionArtist).toHaveBeenCalledWith('');
    expect(setIsAddingExclusionArtist).toHaveBeenCalledWith(false);
  });

  it('formulaire ouvert : Échap ferme sans appeler toggleArtistExclusion', () => {
    const toggleArtistExclusion = vi.fn();
    const setIsAddingExclusionArtist = vi.fn();
    render(<ExclusionsView {...baseProps({
      isAddingExclusionArtist: true, newExclusionArtist: 'Coldplay',
      toggleArtistExclusion, setIsAddingExclusionArtist,
    })} />);

    fireEvent.keyDown(screen.getByPlaceholderText("Nom de l'artiste..."), { key: 'Escape' });

    expect(toggleArtistExclusion).not.toHaveBeenCalled();
    expect(setIsAddingExclusionArtist).toHaveBeenCalledWith(false);
  });

  it('champ vide (espaces uniquement) : n\'appelle pas toggleArtistExclusion', () => {
    const toggleArtistExclusion = vi.fn();
    render(<ExclusionsView {...baseProps({ isAddingExclusionArtist: true, newExclusionArtist: '   ', toggleArtistExclusion })} />);

    fireEvent.keyDown(screen.getByPlaceholderText("Nom de l'artiste..."), { key: 'Enter' });

    expect(toggleArtistExclusion).not.toHaveBeenCalled();
  });
});

// NOUVEAU (28/08, "prends du recul, pouvoir exclure un style au besoin ?")
// — liste complète (STANDARD_GENRES + NAUGHTY_GENRES + EXTRA_GENRES,
// dédoublonnée, "Autre" écarté), volontairement PAS filtrée par
// isNaughtyMode (voir la docstring du composant).
describe('ExclusionsView — genres exclus', () => {
  it('affiche toutes les pastilles de genre (mock : Pop, Rock, R&B Sensuel, Jazz — "Autre" écarté)', () => {
    render(<ExclusionsView {...baseProps()} />);
    expect(screen.getByText('Pop')).toBeInTheDocument();
    expect(screen.getByText('Rock')).toBeInTheDocument();
    expect(screen.getByText('R&B Sensuel')).toBeInTheDocument();
    expect(screen.getByText('Jazz')).toBeInTheDocument();
    expect(screen.queryByText('Autre')).not.toBeInTheDocument();
  });

  it('clic sur une pastille non exclue appelle toggleGenreExclusion avec ce genre', () => {
    const toggleGenreExclusion = vi.fn();
    render(<ExclusionsView {...baseProps({ toggleGenreExclusion })} />);

    fireEvent.click(screen.getByText('Rock'));

    expect(toggleGenreExclusion).toHaveBeenCalledWith('Rock');
  });

  it('un genre déjà exclu est affiché sélectionné (même mécanisme visuel que SelectablePill ailleurs)', () => {
    const { container } = render(<ExclusionsView {...baseProps({ exclusions: { tracks: [], artists: [], genres: ['Rock'] } })} />);
    const rockButton = screen.getByText('Rock').closest('button');
    const popButton = screen.getByText('Pop').closest('button');
    // SelectablePill applique des classes différentes selon `selected` — on
    // vérifie juste qu'elles DIFFÈRENT entre le genre exclu et un genre non
    // exclu, sans dépendre du détail exact des classes Tailwind utilisées.
    expect(rockButton.className).not.toEqual(popButton.className);
  });
});
