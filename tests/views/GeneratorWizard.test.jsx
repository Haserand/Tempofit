// @vitest-environment jsdom
//
// Palier 3 (29/07, 11/11 — partie 2/2, DERNIER du palier) — GeneratorWizard.
// Le plus gros composant du projet (1053 lignes, wizard à 4 étapes). Vu
// l'ampleur, ce fichier vise une couverture REPRÉSENTATIVE des chemins
// principaux de chaque étape plutôt qu'une couverture exhaustive de chaque
// branche (Crescendo/Intervalle en particulier ont énormément de
// combinaisons) — un choix de scope assumé plutôt qu'un oubli.
//
// `GeneratorContext`/`ModalContext` mockés en intégralité (comme les autres
// composants de ce Palier). `appConfig.js` gardé RÉEL via `importOriginal`
// (WORKOUT_TYPES, NAUGHTY_WORKOUT_ORDER... sont des constantes de données,
// pas de la logique à isoler — les rejouer coûte moins cher que les
// reconstruire à la main), sauf `getZoneForValue` stubbé (dépend d'un
// profil athlétique, hors périmètre ici). `musicCatalog.js` mocké (fonctions
// pures déjà testées ailleurs). `DualRangeSlider` mocké par un stub léger
// (déjà testé dans tests/DualRangeSlider.test.jsx, Palier 2).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// jsdom n'implémente pas ResizeObserver (utilisé par l'étape 3 du wizard
// pour son indicateur "Fais défiler pour tout voir") — sans ce stub,
// TOUS les tests d'étape 3 planteraient avec une ReferenceError dès le
// montage, pas seulement les tests qui touchent explicitement ce
// mécanisme. jsdom rapporte aussi `scrollHeight`/`clientHeight` à 0 par
// défaut (pas de vrai moteur de mise en page) : le calcul réel de
// dépassement (`el.scrollHeight > el.clientHeight`) ne peut donc jamais
// être observé fidèlement ici — les tests qui en dépendent le signalent
// explicitement plutôt que de prétendre le vérifier.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub;

const mockUseGeneratorContext = vi.fn();
vi.mock('../../src/contexts/GeneratorContext.jsx', () => ({
  useGeneratorContext: () => mockUseGeneratorContext(),
}));

const mockOpenModal = vi.fn();
vi.mock('../../src/contexts/ModalContext.jsx', () => ({
  useModalContext: () => ({ openModal: mockOpenModal, activeModal: null, modalData: null, closeModal: vi.fn() }),
}));

vi.mock('../../src/appConfig.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getZoneForValue: vi.fn(() => null) };
});

vi.mock('../../src/musicCatalog.js', () => ({
  STANDARD_GENRES: ['Rock', 'Pop', 'Métal'],
  EXTRA_GENRES: ['Techno', 'Jazz'],
  getGenreLocalDepthWarning: vi.fn(() => null),
  genreDisplayLabel: vi.fn((g) => g),
  // 04/08 — GENRE_SEARCH_DEPTH_HINT extraite ici (constante partagée avec
  // FavoritesView.jsx, voir sa docstring dans musicCatalog.js pour le
  // pourquoi). Mock statique, pas un vi.fn() : c'est une simple chaîne dans
  // le vrai module, pas une fonction.
  GENRE_SEARCH_DEPTH_HINT: 'mock genre search depth hint',
}));

vi.mock('../../src/components/shared/DualRangeSlider.jsx', () => ({
  default: () => <div data-testid="dual-range-slider-mock" />,
}));

import GeneratorWizard from '../../src/components/views/GeneratorWizard.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textMuted: 'mock-muted', textColorClass: 'mock-text-color', bgAccentClass: 'mock-accent-bg',
  borderAccentClass: 'mock-border-accent', bgMainApp: 'mock-bg-main', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
};

function makeContextValue(overrides = {}) {
  return {
    isNaughtyMode: false,
    wizardStep: 1, setWizardStep: vi.fn(),
    workoutType: 'Course à pied', setWorkoutType: vi.fn(), customActivity: '', handleOpenCustomActivityModal: vi.fn(),
    setBpm: vi.fn(), setBpmManual: vi.fn(), setTargetMode: vi.fn(), setDistanceVal: vi.fn(), setDistanceUnit: vi.fn(), setHours: vi.fn(), setMinutes: vi.fn(),
    targetMode: 'distance', isIntervalMode: false, isCrescendoMode: false, structureMode: 'constant', setStructureMode: vi.fn(),
    crescendoWarmupPct: 20, setCrescendoWarmupPct: vi.fn(), crescendoCooldownPct: 20, setCrescendoCooldownPct: vi.fn(), CRESCENDO_MIN_MAIN_PCT: 20,
    crescendoWarmupBpm: 120, setCrescendoWarmupBpm: vi.fn(), crescendoCooldownBpm: 120, setCrescendoCooldownBpm: vi.fn(),
    bpmSourceIsProfile: false,
    hours: 0, minutes: 45, distanceVal: 5, distanceUnit: 'km', paceMin: 5, setPaceMin: vi.fn(), paceSec: 30, setPaceSec: vi.fn(),
    bpm: 150,
    segments: [], setSegments: vi.fn(), expandedSegmentGenreId: null, setExpandedSegmentGenreId: vi.fn(),
    resetSegmentGenre: vi.fn(), toggleSegmentGenre: vi.fn(), showExtraGenres: false, setShowExtraGenres: vi.fn(),
    availableGenres: ['Rock', 'Pop'], selectedGenres: ['Rock'], toggleGenre: vi.fn(),
    genreWeights: {}, setGenreWeights: vi.fn(), setGenreWeight: vi.fn(), equalSplitWeights: vi.fn(() => ({ Rock: 100 })), setLockedGenreWeights: vi.fn(),
    bpmTolerance: 10, setBpmTolerance: vi.fn(), crossfade: 3, setCrossfade: vi.fn(), allowLongTracks: false, setAllowLongTracks: vi.fn(),
    getActiveWorkoutName: vi.fn(() => 'Course à pied'),
    athleticProfile: { activities: {}, custom: [] }, getProfileForWorkout: vi.fn(() => ({ isConfigured: false })), buildDefaultPreviewProfile: vi.fn(() => ({ isConfigured: false, targetBpm: 140 })),
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    setCurrentPlaylist: vi.fn(),
    setIsBpmSearchMode: vi.fn(),
    setSearchQuery: vi.fn(),
    setWorldSearchResults: vi.fn(),
    setResultsContextLabel: vi.fn(),
    setNoUsableResultsHint: vi.fn(),
    searchTracksByBpm: vi.fn(),
    executeGeneration: vi.fn(),
    isGenerating: false,
    toggleNaughtyMode: vi.fn(),
    changeView: vi.fn(),
    ...overrides,
  };
}

describe('GeneratorWizard — étape 1 (activité)', () => {
  it('affiche "Étape 1 / 4"', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1 }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('Étape 1 / 4')).toBeInTheDocument();
  });

  it('choisir une activité standard remplit BPM/objectif par défaut puis avance à l\'étape 2', async () => {
    vi.useFakeTimers();
    const setWorkoutType = vi.fn();
    const setBpm = vi.fn();
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, setWorkoutType, setBpm, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Cyclisme'));
    expect(setWorkoutType).toHaveBeenCalledWith('Cyclisme');
    expect(setBpm).toHaveBeenCalledWith(140); // WORKOUT_DEFAULT_BPM.standard.Cyclisme

    vi.advanceTimersByTime(200);
    expect(setWizardStep).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });

  it('choisir "Autre" ouvre la modale d\'activité personnalisée, sans changer workoutType', () => {
    const handleOpenCustomActivityModal = vi.fn();
    const setWorkoutType = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, handleOpenCustomActivityModal, setWorkoutType }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Autre'));

    expect(handleOpenCustomActivityModal).toHaveBeenCalled();
    expect(setWorkoutType).not.toHaveBeenCalled();
  });

  it('cliquer l\'icône flamme sur "Autre" bascule le Mode Intime sans ouvrir la modale d\'activité (stopPropagation)', () => {
    const toggleNaughtyMode = vi.fn();
    const handleOpenCustomActivityModal = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, handleOpenCustomActivityModal }));
    const { container } = render(<GeneratorWizard {...baseProps({ toggleNaughtyMode })} />);

    // Icône flamme : seul bouton absolu top-2/right-2 dans la carte "Autre"
    const flameButton = container.querySelector('.absolute.top-2.right-2');
    fireEvent.click(flameButton);

    expect(toggleNaughtyMode).toHaveBeenCalled();
    expect(handleOpenCustomActivityModal).not.toHaveBeenCalled();
  });

  it('badge "Profil configuré" affiché uniquement en mode normal pour une activité déjà configurée', () => {
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 1, athleticProfile: { activities: { 'Course à pied': { isConfigured: true } }, custom: [] } })
    );
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('Profil configuré')).toBeInTheDocument();
  });
});

describe('GeneratorWizard — étape 2 (objectif & structure)', () => {
  it('mode normal, activité course : le sélecteur Temps/Distance est visible, cliquer "Par Distance" appelle setTargetMode', () => {
    const setTargetMode = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, workoutType: 'Course à pied', setTargetMode }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Par Distance (Km/Mi)'));

    expect(setTargetMode).toHaveBeenCalledWith('distance');
  });

  it('activité Musculation : le sélecteur Temps/Distance est masqué', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, workoutType: 'Musculation' }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.queryByText('Sur quoi on se base ?')).not.toBeInTheDocument();
  });

  it('Mode Intime : le sélecteur Temps/Distance est masqué, remplacé par le toggle simple "Montée en Intensité"', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, isNaughtyMode: true }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.queryByText('Sur quoi on se base ?')).not.toBeInTheDocument();
    expect(screen.getByText('Montée en Intensité')).toBeInTheDocument();
  });

  it('mode normal : cliquer "Crescendo" appelle setStructureMode("crescendo", ...)', () => {
    const setStructureMode = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, setStructureMode }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Crescendo'));

    expect(setStructureMode).toHaveBeenCalledWith('crescendo', expect.anything());
  });
});

describe('GeneratorWizard — étape 3 (rythme)', () => {
  it('affiche le BPM courant et le badge "Calculé depuis ton Profil Athlétique" si bpmSourceIsProfile', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 3, bpm: 155, bpmSourceIsProfile: true }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);
    // Le BPM affiché est scindé en 2 éléments ("155" + "BPM" dans un span
    // imbriqué) — on vérifie la valeur du slider plutôt qu'un texte ambigu.
    expect(container.querySelector('input[type="range"]')).toHaveValue('155');
    expect(screen.getByText('Calculé depuis ton Profil Athlétique')).toBeInTheDocument();
  });

  it('déplacer le curseur BPM appelle setBpmManual avec un nombre', () => {
    const setBpmManual = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 3, setBpmManual }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const slider = container.querySelector('input[type="range"]');
    fireEvent.change(slider, { target: { value: '170' } });

    expect(setBpmManual).toHaveBeenCalledWith(170);
  });

  it('mode Crescendo : affiche la répartition de l\'effort (DualRangeSlider)', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 3, isCrescendoMode: true }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText("Répartition de l'effort")).toBeInTheDocument();
    expect(screen.getByTestId('dual-range-slider-mock')).toBeInTheDocument();
  });
});

describe('GeneratorWizard — étape 4 (genres & génération)', () => {
  it('cliquer un genre disponible appelle toggleGenre', () => {
    const toggleGenre = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, availableGenres: ['Rock', 'Pop'], toggleGenre }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Pop'));

    expect(toggleGenre).toHaveBeenCalledWith('Pop');
  });

  it('"+ Plus de genres" affiche EXTRA_GENRES en mode normal, masqué en Mode Intime', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, isNaughtyMode: false }));
    const { rerender } = render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('+ Plus de genres')).toBeInTheDocument();

    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, isNaughtyMode: true }));
    rerender(<GeneratorWizard {...baseProps()} />);
    expect(screen.queryByText('+ Plus de genres')).not.toBeInTheDocument();
  });

  it('avec 2+ genres sélectionnés : affiche la répartition, "Répartition égale" réinitialise les poids', () => {
    const setGenreWeights = vi.fn();
    const setLockedGenreWeights = vi.fn();
    const equalSplitWeights = vi.fn(() => ({ Rock: 50, Pop: 50 }));
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 4, selectedGenres: ['Rock', 'Pop'], setGenreWeights, setLockedGenreWeights, equalSplitWeights })
    );
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Répartition égale'));

    expect(equalSplitWeights).toHaveBeenCalledWith(['Rock', 'Pop']);
    expect(setGenreWeights).toHaveBeenCalledWith({ Rock: 50, Pop: 50 });
    expect(setLockedGenreWeights).toHaveBeenCalledWith(new Set());
  });

  it('déplacer la marge d\'erreur (tolérance BPM) appelle setBpmTolerance', () => {
    const setBpmTolerance = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, setBpmTolerance }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[0], { target: { value: '15' } });

    expect(setBpmTolerance).toHaveBeenCalledWith(15);
  });

  it('"Explorer les titres à X BPM" enchaîne tous les setters puis la recherche', () => {
    const setCurrentPlaylist = vi.fn();
    const setIsBpmSearchMode = vi.fn();
    const searchTracksByBpm = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, bpm: 150, bpmTolerance: 10, selectedGenres: ['Rock'] }));
    render(<GeneratorWizard {...baseProps({ setCurrentPlaylist, setIsBpmSearchMode, searchTracksByBpm })} />);

    fireEvent.click(screen.getByText('Explorer les titres à 150 BPM'));

    expect(setCurrentPlaylist).toHaveBeenCalledWith(null);
    expect(setIsBpmSearchMode).toHaveBeenCalledWith(true);
    expect(mockOpenModal).toHaveBeenCalledWith('SEARCH');
    expect(searchTracksByBpm).toHaveBeenCalledWith(150, 10, ['Rock']);
  });

  it('"Générer ma Playlist" appelle executeGeneration avec les réglages courants', () => {
    const executeGeneration = vi.fn();
    const getActiveWorkoutName = vi.fn(() => 'Course à pied');
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, bpm: 150, bpmTolerance: 10, getActiveWorkoutName }));
    render(<GeneratorWizard {...baseProps({ executeGeneration })} />);

    fireEvent.click(screen.getByText('Générer ma Playlist'));

    expect(executeGeneration).toHaveBeenCalledWith(expect.objectContaining({ bpm: 150, bpmTolerance: 10, workoutName: 'Course à pied' }));
  });

  it('le bouton de génération est désactivé pendant isGenerating', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4 }));
    const { container } = render(<GeneratorWizard {...baseProps({ isGenerating: true })} />);
    // Le bouton n'a plus de texte "Générer ma Playlist" pendant le
    // chargement (affiche un loader à la place) — on le cible via sa
    // classe stable plutôt qu'un texte absent dans cet état précis.
    const generateButton = container.querySelector('.flex-1.text-xl.font-black');
    expect(generateButton).toBeDisabled();
  });

  it('"Créer routine" ouvre la modale SAVING_ROUTINE', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4 }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Créer routine'));
    expect(mockOpenModal).toHaveBeenCalledWith('SAVING_ROUTINE');
  });

  it('"Retour aux réglages" (étape 4) appelle setWizardStep(3)', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Retour aux réglages'));
    expect(setWizardStep).toHaveBeenCalledWith(3);
  });
});

describe('GeneratorWizard — navigation Précédent/Suivant (étapes 1 à 3)', () => {
  it('"Précédent" (étape 2) appelle setWizardStep(1)', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Précédent'));
    expect(setWizardStep).toHaveBeenCalledWith(1);
  });

  it('"Suivant" (étape 2) appelle setWizardStep(3)', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).toHaveBeenCalledWith(3);
  });

  // 04/08, retour direct (capture d'écran EditRoutineModal.jsx) : "je ne
  // trouve pas ça normal de pouvoir générer une routine avec une valeur de
  // 0 km" — voir targetValidation.js pour le raisonnement complet.
  it('BUG CORRIGÉ : "Suivant" (étape 2, mode distance) est désactivé quand distanceVal vaut 0', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, targetMode: 'distance', distanceVal: 0, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).not.toHaveBeenCalled();
    expect(screen.getByText('Suivant').closest('button')).toBeDisabled();
  });

  it('"Suivant" (étape 2, mode temps) est désactivé quand heures ET minutes valent 0', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, targetMode: 'time', hours: 0, minutes: 0, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).not.toHaveBeenCalled();
  });

  it('"Suivant" (étape 3, mode Constant) est aussi désactivé si la cible redevient invalide', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 3, targetMode: 'distance', distanceVal: 0, setWizardStep }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).not.toHaveBeenCalled();
  });

  // 04/08, 3e retour direct sur ce même chantier : "ce comportement minimal
  // est-il celui généralisé dans toute l'app ? il le faudrait" — le mode
  // Fractionné n'est plus hors scope : ce sont désormais les SEGMENTS
  // eux-mêmes qui gouvernent "Suivant" à cette étape (isSegmentValid/
  // areSegmentsValid, targetValidation.js), pas la cible globale
  // (distanceVal/hours/minutes), qui ne s'affiche plus à l'écran dans ce
  // mode de toute façon.
  it('BUG CORRIGÉ (généralisation) : "Suivant" (étape 3, Fractionné) est désactivé si un segment a bpm=0', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({
      wizardStep: 3, targetMode: 'distance', isIntervalMode: true, isCrescendoMode: false, setWizardStep,
      segments: [{ id: 's1', bpm: 0, durationValue: 5 }],
    }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).not.toHaveBeenCalled();
  });

  it('"Suivant" (étape 3, Fractionné) est désactivé quand la liste de segments est vide', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({
      wizardStep: 3, targetMode: 'distance', isIntervalMode: true, isCrescendoMode: false, setWizardStep,
      segments: [],
    }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).not.toHaveBeenCalled();
  });

  it('"Suivant" (étape 3, Fractionné) reste actif quand tous les segments sont valides', () => {
    const setWizardStep = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({
      wizardStep: 3, targetMode: 'distance', isIntervalMode: true, isCrescendoMode: false, setWizardStep,
      segments: [{ id: 's1', bpm: 150, durationValue: 5 }, { id: 's2', bpm: 160, durationValue: 3 }],
    }));
    render(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Suivant'));
    expect(setWizardStep).toHaveBeenCalledWith(4);
  });

  it('étape 1, mode normal : le lien "Configurer mes zones BPM" appelle changeView("settings")', () => {
    const changeView = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, isNaughtyMode: false }));
    render(<GeneratorWizard {...baseProps({ changeView })} />);
    fireEvent.click(screen.getByText(/Configurer mes zones BPM/));
    expect(changeView).toHaveBeenCalledWith('settings');
  });

  it('étape 1, Mode Intime : pas de lien profil (aucun bouton "Précédent" ni lien à sa place)', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, isNaughtyMode: true }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.queryByText(/Configurer mes zones BPM/)).not.toBeInTheDocument();
  });
});

describe('GeneratorWizard — étape 1 (couverture complète)', () => {
  it('affiche les 4 activités standard, dans l\'ordre de WORKOUT_TYPES', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, isNaughtyMode: false }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);
    const labels = Array.from(container.querySelectorAll('.grid.grid-cols-2 > div span.font-bold')).map(el => el.textContent);
    expect(labels).toEqual(['Course à pied', 'Cyclisme', 'Musculation', 'Autre']);
  });

  it('Mode Intime : réordonne (NAUGHTY_WORKOUT_ORDER) et relabellise (NAUGHTY_WORKOUT_LABELS) les activités', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, isNaughtyMode: true, workoutType: 'Cyclisme' }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);
    // NAUGHTY_WORKOUT_ORDER = ['Cyclisme', 'Course à pied', 'Musculation', 'Autre']
    // NAUGHTY_WORKOUT_LABELS = { Cyclisme: 'Douceur', 'Course à pied': 'Passion', Musculation: 'Intensité', Autre: 'Autre' }
    const labels = Array.from(container.querySelectorAll('.grid.grid-cols-2 > div span.font-bold')).map(el => el.textContent);
    expect(labels).toEqual(['Douceur', 'Passion', 'Intensité', 'Autre']);
  });

  it('Mode Intime : choisir une activité applique aussi les valeurs par défaut du jeu "naughty"', () => {
    vi.useFakeTimers();
    const setBpm = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 1, isNaughtyMode: true, setBpm }));
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Passion')); // = 'Course à pied' en Mode Intime

    expect(setBpm).toHaveBeenCalledWith(95); // WORKOUT_DEFAULT_BPM.naughty['Course à pied']
    vi.useRealTimers();
  });
});

describe('GeneratorWizard — étape 2 (couverture complète)', () => {
  it('Mode Intime : le toggle "Montée en Intensité" bascule interval ↔ constant', () => {
    const setStructureMode = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, isNaughtyMode: true, isIntervalMode: false, setStructureMode }));
    const { rerender } = render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Montée en Intensité'));
    expect(setStructureMode).toHaveBeenCalledWith('interval');

    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, isNaughtyMode: true, isIntervalMode: true, setStructureMode }));
    rerender(<GeneratorWizard {...baseProps()} />);
    fireEvent.click(screen.getByText('Montée en Intensité'));
    expect(setStructureMode).toHaveBeenCalledWith('constant');
  });

  it('activité Musculation : le vocabulaire de structure devient "Effort Constant"/"Par Blocs / Circuit"', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, workoutType: 'Musculation' }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('Effort Constant')).toBeInTheDocument();
    expect(screen.getByText('Par Blocs / Circuit')).toBeInTheDocument();
    expect(screen.queryByText('Allure Constante')).not.toBeInTheDocument();
  });

  it('activité non-Musculation : le vocabulaire redevient "Allure Constante"/"Fractionné / HIIT"', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, workoutType: 'Course à pied' }));
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('Allure Constante')).toBeInTheDocument();
    expect(screen.getByText('Fractionné / HIIT')).toBeInTheDocument();
  });

  it('mode distance : éditer la distance/l\'allure appelle les bons setters', () => {
    const setDistanceVal = vi.fn();
    const setPaceMin = vi.fn();
    const setPaceSec = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, targetMode: 'distance', setDistanceVal, setPaceMin, setPaceSec }));
    render(<GeneratorWizard {...baseProps()} />);

    // Distance : le seul input dans le même bloc que le sélecteur d'unité (Km/Miles).
    const distanceInput = screen.getByText('Km').closest('div').querySelector('input[type="number"]');
    fireEvent.change(distanceInput, { target: { value: '10' } });
    expect(setDistanceVal).toHaveBeenCalledWith('10');

    // Allure : les 2 inputs dans le bloc situé juste après le texte "Allure:".
    // ⚠️ paceMin vaut déjà 5 par défaut dans les données de ce test — lui
    // donner la MÊME valeur ('5') ne déclenche jamais le handler : React
    // (via son "value tracker" interne) ignore silencieusement un
    // fireEvent.change qui ne change rien à la valeur déjà affichée. D'où
    // '8' ici (différent du défaut), au lieu de '5' comme dans le 1er jet.
    const paceInputs = screen.getByText('Allure:').parentElement.querySelectorAll('input[type="number"]');
    fireEvent.change(paceInputs[0], { target: { value: '8' } });
    expect(setPaceMin).toHaveBeenCalledWith('8');

    fireEvent.change(paceInputs[1], { target: { value: '45' } });
    expect(setPaceSec).toHaveBeenCalledWith('45');
  });

  it('mode temps : la flèche "haut" des minutes boucle 59→0', () => {
    const setMinutes = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 2, targetMode: 'time', minutes: 59, setMinutes }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const buttons = container.querySelectorAll('.flex.flex-col > button');
    fireEvent.click(buttons[0]);
    const incrementer = setMinutes.mock.calls[0][0];
    expect(incrementer(59)).toBe(0);
  });
});

describe('GeneratorWizard — étape 3, Crescendo (détail)', () => {
  it('curseurs BPM Échauffement/Retour au calme appellent leurs setters respectifs', () => {
    const setCrescendoWarmupBpm = vi.fn();
    const setCrescendoCooldownBpm = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isCrescendoMode: true, setCrescendoWarmupBpm, setCrescendoCooldownBpm })
    );
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const sliders = container.querySelectorAll('input[type="range"]');
    // sliders[0] = BPM cœur de séance, [1] = Échauffement, [2] = Retour au calme
    fireEvent.change(sliders[1], { target: { value: '100' } });
    fireEvent.change(sliders[2], { target: { value: '90' } });

    expect(setCrescendoWarmupBpm).toHaveBeenCalledWith(100);
    expect(setCrescendoCooldownBpm).toHaveBeenCalledWith(90);
  });

  it('à 0%, le curseur BPM correspondant est désactivé et signale "sans effet"', () => {
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isCrescendoMode: true, crescendoWarmupPct: 0 })
    );
    const { container } = render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText(/BPM Échauffement/).textContent).toContain('0% — sans effet');
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders[1]).toBeDisabled();
  });

  it('affiche l\'aperçu des segments Crescendo (libellé, durée, BPM)', () => {
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({
        wizardStep: 3, isCrescendoMode: true, targetMode: 'time',
        segments: [{ id: 's1', _crescendoLabel: 'Échauffement', durationValue: 5, bpm: 110 }],
      })
    );
    render(<GeneratorWizard {...baseProps()} />);
    expect(screen.getByText('Échauffement')).toBeInTheDocument();
    expect(screen.getByText(/5m 00s · 110 BPM/)).toBeInTheDocument();
  });
});

describe('GeneratorWizard — étape 3, Fractionné/segments (détail)', () => {
  const segment1 = { id: 'seg1', bpm: 160, durationValue: 10, selectedGenres: [] };
  const segment2 = { id: 'seg2', bpm: 120, durationValue: 5, selectedGenres: ['Jazz'] };

  it('éditer le BPM d\'une portion appelle setSegments avec la valeur mise à jour', () => {
    const setSegments = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time', segments: [segment1], setSegments })
    );
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const bpmInput = container.querySelector('input[type="number"]');
    fireEvent.change(bpmInput, { target: { value: '175' } });

    expect(setSegments).toHaveBeenCalledWith([{ ...segment1, bpm: 175 }]);
  });

  it('éditer la durée d\'une portion appelle setSegments avec la valeur mise à jour', () => {
    const setSegments = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time', segments: [segment1], setSegments })
    );
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.change(numberInputs[1], { target: { value: '12' } }); // durée

    expect(setSegments).toHaveBeenCalledWith([{ ...segment1, durationValue: 12 }]);
  });

  it('sans override de genre, propose de définir un style ; avec override, propose "Revenir au genre global"', () => {
    const resetSegmentGenre = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, segments: [segment2], expandedSegmentGenreId: 'seg2', resetSegmentGenre })
    );
    render(<GeneratorWizard {...baseProps()} />);

    expect(screen.getByText('Style personnalisé pour cette portion')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Revenir au genre global'));
    expect(resetSegmentGenre).toHaveBeenCalledWith('seg2');
  });

  it('cliquer un genre dans le panneau déplié appelle toggleSegmentGenre(segmentId, genre)', () => {
    const toggleSegmentGenre = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, segments: [segment1], expandedSegmentGenreId: 'seg1', toggleSegmentGenre })
    );
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Métal'));

    expect(toggleSegmentGenre).toHaveBeenCalledWith('seg1', 'Métal');
  });

  it('supprimer une portion appelle setSegments filtré ; désactivé s\'il ne reste qu\'une portion', () => {
    const setSegments = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, segments: [segment1, segment2], setSegments })
    );
    const { container, rerender } = render(<GeneratorWizard {...baseProps()} />);

    const deleteButtons = container.querySelectorAll('button svg.lucide-trash2');
    fireEvent.click(deleteButtons[0].closest('button'));
    expect(setSegments).toHaveBeenCalledWith([segment2]);

    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, segments: [segment1], setSegments })
    );
    rerender(<GeneratorWizard {...baseProps()} />);
    const singleDeleteButton = container.querySelectorAll('button svg.lucide-trash2')[0].closest('button');
    expect(singleDeleteButton).toBeDisabled();
  });

  it('"Ajouter une portion" duplique le BPM du dernier segment par défaut (hors zones VMA/Endurance)', () => {
    const setSegments = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({
        wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time',
        segments: [segment1],
        getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
        buildDefaultPreviewProfile: vi.fn(() => ({ isConfigured: false, zone2: 999, zone4: 999 })),
        setSegments,
      })
    );
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Ajouter une portion'));

    expect(setSegments).toHaveBeenCalledWith([
      segment1,
      expect.objectContaining({ bpm: 160, durationValue: 10 }),
    ]);
  });

  it('"Ajouter une portion" alterne VMA ↔ Endurance quand le dernier segment correspond exactement à l\'une des 2 zones du profil', () => {
    const setSegments = vi.fn();
    mockUseGeneratorContext.mockReturnValue(
      makeContextValue({
        wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time',
        segments: [{ id: 'seg1', bpm: 100, durationValue: 10 }, { id: 'seg2', bpm: 180, durationValue: 3 }],
        getProfileForWorkout: vi.fn(() => ({ isConfigured: true, zone2: 100, zone4: 180 })),
        setSegments,
      })
    );
    render(<GeneratorWizard {...baseProps()} />);

    fireEvent.click(screen.getByText('Ajouter une portion'));

    const addedSegments = setSegments.mock.calls[0][0];
    expect(addedSegments[2].bpm).toBe(100); // dernier segment était à zone4 (180) → alterne vers zone2 (100)
  });

  // 04/08, 3e retour direct sur ce même chantier : "ce comportement minimal
  // est-il celui généralisé dans toute l'app ? il le faudrait" — voir
  // snapSegmentBpmOnBlur/snapSegmentDurationOnBlur (targetValidation.js).
  describe('correction automatique au blur + indice visuel (BUG CORRIGÉ, généralisation)', () => {
    it('quitter le champ BPM d\'un segment à 0 le remonte à 1', () => {
      const setSegments = vi.fn();
      mockUseGeneratorContext.mockReturnValue(
        makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time', segments: [{ ...segment1, bpm: 0 }], setSegments })
      );
      const { container } = render(<GeneratorWizard {...baseProps()} />);

      const bpmInput = container.querySelector('input[type="number"]');
      fireEvent.blur(bpmInput, { target: { value: '0' } });

      const updater = setSegments.mock.calls[0][0];
      expect(updater([{ ...segment1, bpm: 0 }])[0].bpm).toBe(1);
    });

    it('quitter le champ durée d\'un segment à 0 le remonte au plancher (0.1 en distance, 1 en temps)', () => {
      const setSegments = vi.fn();
      mockUseGeneratorContext.mockReturnValue(
        makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'distance', segments: [{ ...segment1, durationValue: 0 }], setSegments })
      );
      const { container } = render(<GeneratorWizard {...baseProps()} />);

      const numberInputs = container.querySelectorAll('input[type="number"]');
      fireEvent.blur(numberInputs[1], { target: { value: '0' } }); // durée

      const updater = setSegments.mock.calls[0][0];
      expect(updater([{ ...segment1, durationValue: 0 }])[0].durationValue).toBe(0.1);
    });

    it('affiche un avertissement sur la portion concernée quand elle est invalide', () => {
      mockUseGeneratorContext.mockReturnValue(
        makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time', segments: [{ ...segment1, bpm: 0 }] })
      );
      render(<GeneratorWizard {...baseProps()} />);
      expect(screen.getByText(/Portion 1 :/)).toBeInTheDocument();
    });

    it('n\'affiche aucun avertissement quand la portion est valide', () => {
      mockUseGeneratorContext.mockReturnValue(
        makeContextValue({ wizardStep: 3, isIntervalMode: true, isCrescendoMode: false, targetMode: 'time', segments: [segment1] })
      );
      render(<GeneratorWizard {...baseProps()} />);
      expect(screen.queryByText(/Portion 1 :/)).toBeNull();
    });
  });
});

describe('GeneratorWizard — étape 4 (compléments)', () => {
  it('un genre avec un avertissement affiche le ⚠️ et le title correspondant', async () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, availableGenres: ['Rock'] }));
    const musicCatalog = await import('../../src/musicCatalog.js');
    musicCatalog.getGenreLocalDepthWarning.mockReturnValueOnce('Catalogue local limité pour ce genre.');

    render(<GeneratorWizard {...baseProps()} />);

    const rockButton = screen.getByText('Rock', { exact: false }).closest('button');
    expect(rockButton).toHaveAttribute('title', 'Catalogue local limité pour ce genre.');
    expect(rockButton.textContent).toContain('⚠️');
  });

  it('le curseur "Fondu enchaîné" appelle setCrossfade', () => {
    const setCrossfade = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, setCrossfade }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const sliders = container.querySelectorAll('input[type="range"]');
    fireEvent.change(sliders[1], { target: { value: '6' } }); // sliders[0] = tolérance BPM

    expect(setCrossfade).toHaveBeenCalledWith(6);
  });

  it('le toggle "Titres de plus de 6 min" appelle setAllowLongTracks(!allowLongTracks)', () => {
    const setAllowLongTracks = vi.fn();
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 4, allowLongTracks: false, setAllowLongTracks }));
    const { container } = render(<GeneratorWizard {...baseProps()} />);

    const toggleLabel = screen.getByText('Titres de plus de 6 min');
    const toggleButton = toggleLabel.closest('div.flex.items-center.justify-between').querySelector('button');
    fireEvent.click(toggleButton);

    expect(setAllowLongTracks).toHaveBeenCalledWith(true);
  });
});

describe('GeneratorWizard — indicateur de scroll (étape 3)', () => {
  it('le montage à l\'étape 3 ne plante pas (ResizeObserver correctement stubbé)', () => {
    mockUseGeneratorContext.mockReturnValue(makeContextValue({ wizardStep: 3 }));
    expect(() => render(<GeneratorWizard {...baseProps()} />)).not.toThrow();
    // Note : jsdom ne calcule pas de vraie mise en page (scrollHeight/
    // clientHeight valent toujours 0), donc l'affichage RÉEL du pill "Fais
    // défiler pour tout voir" ne peut pas être vérifié fidèlement ici —
    // seule l'absence de crash au montage est une garantie qu'on peut
    // honnêtement donner dans cet environnement.
  });
});
