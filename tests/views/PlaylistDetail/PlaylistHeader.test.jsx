// @vitest-environment jsdom
//
// Palier 3 (29/07, 8/11) — PlaylistHeader. `usePlaylistDetail()` mocké.
// `appConfig.js`/`musicCatalog.js`/`coverArt.js` mockés (fonctions pures
// déjà couvertes par leurs propres tests). `TopCompletionDate`/
// `CompletionsList` mockés par des stubs légers : déjà testés dans
// tests/TopCompletionDate.test.jsx et tests/CompletionsList.test.jsx
// (Palier 2) — pas la peine de re-tester leur logique interne ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUsePlaylistDetail = vi.fn();
vi.mock('../../../src/contexts/PlaylistDetailContext.jsx', () => ({
  usePlaylistDetail: () => mockUsePlaylistDetail(),
}));

vi.mock('../../../src/appConfig.js', () => ({
  getActivityEmoji: vi.fn(() => '🏃'),
  getZoneForValue: vi.fn(() => null),
  getBpmBucketColor: vi.fn(() => '#123456'),
  getBpmBucketStart: vi.fn((bpm) => Math.floor(bpm / 20) * 20),
  // 04/08 — 280 → 150 (voir la docstring de MAX_DESCRIPTION_LENGTH,
  // appConfig.js, pour le raisonnement complet : line-clamp-1 généralisé
  // (resserré depuis line-clamp-2 le 05/08) sans échappatoire "Voir plus"
  // nulle part, seuil resserré en conséquence).
  MAX_DESCRIPTION_LENGTH: 150,
}));

vi.mock('../../../src/musicCatalog.js', () => ({
  getGenresForDisplay: vi.fn((genre) => [genre]),
  genreDisplayLabel: vi.fn((genre) => genre),
}));

vi.mock('../../../src/utils/coverArt.js', () => ({
  buildCoverUrl: vi.fn((name) => `generated-cover://${name}`),
}));

vi.mock('../../../src/components/shared/TopCompletionDate.jsx', () => ({
  // Rendu inline (span, pas div) : le vrai PlaylistHeader.jsx insère ce
  // composant À L'INTÉRIEUR d'un <p> — un <div> y serait du HTML invalide
  // (avertissement React "cannot be a descendant of <p>", repéré au 1er
  // déploiement de ce fichier).
  default: () => <span data-testid="top-completion-date-mock">TopCompletionDate (mock)</span>,
}));

vi.mock('../../../src/components/shared/CompletionsList.jsx', () => ({
  default: () => <div data-testid="completions-list-mock">CompletionsList (mock)</div>,
}));

import PlaylistHeader from '../../../src/components/views/PlaylistDetail/PlaylistHeader.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = { bgAccentClass: 'mock-accent-bg' };

const track1 = { id: 't1', bpm: 140, genre: 'Rock', duration: 200 };
const track2 = { id: 't2', bpm: 160, genre: 'Métal', duration: 210 };

function makePlaylist(overrides = {}) {
  return {
    id: 'pl1', name: 'Ma Séance', workoutType: 'Course à pied', totalDuration: 410,
    tracks: [track1, track2], completions: [], config: {}, plannedDate: null, coverUrl: null,
    ...overrides,
  };
}

function makeContextValue(overrides = {}) {
  return {
    currentPlaylist: makePlaylist(),
    isSaved: true,
    getProfileForWorkout: vi.fn(() => ({ isConfigured: false })),
    isEditingPlaylistName: false,
    setIsEditingPlaylistName: vi.fn(),
    editedPlaylistName: '',
    setEditedPlaylistName: vi.fn(),
    handleRenamePlaylist: vi.fn(),
    isEditingPlaylistDescription: false,
    setIsEditingPlaylistDescription: vi.fn(),
    editedPlaylistDescription: '',
    setEditedPlaylistDescription: vi.fn(),
    handleEditPlaylistDescription: vi.fn(),
    handleSavePlaylist: vi.fn(),
    handleUnsavePlaylist: vi.fn(),
    handleTogglePlaylistPublic: vi.fn(),
    handleClonePlaylist: vi.fn(),
    isReadOnly: false,
    username: null,
    ...overrides,
  };
}

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isLocked: false,
    savedPlaylists: [],
    resolveAndTogglePreview: vi.fn(),
    getNextTrackForAutoAdvance: vi.fn(),
    setPlaylistPlannedDate: vi.fn(),
    bpmChartActivityName: 'Course à pied',
    editingCompletion: null,
    setEditingCompletion: vi.fn(),
    editCompletionDate: vi.fn(),
    removeCompletionDate: vi.fn(),
    getRankStyle: vi.fn(() => null),
    triggerCSVUpload: vi.fn(),
    onShare: vi.fn(),
    ...overrides,
  };
}

describe('PlaylistHeader', () => {
  it('affiche le nom, le type de séance, la durée et le nombre de titres', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText(/Ma Séance/)).toBeInTheDocument();
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    expect(screen.getByText('2 titres')).toBeInTheDocument();
  });

  it('utilise coverUrl si présent, sinon buildCoverUrl(name)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ coverUrl: 'https://real-cover.jpg' }) }));
    const { container, rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('https://real-cover.jpg');

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ coverUrl: null, name: 'Ma Séance' }) }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(container.querySelector('img').getAttribute('src')).toBe('generated-cover://Ma Séance');
  });

  it('le clic sur la pochette lance la lecture du 1er titre', () => {
    const resolveAndTogglePreview = vi.fn();
    const getNextTrackForAutoAdvance = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps({ resolveAndTogglePreview, getNextTrackForAutoAdvance })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).toHaveBeenCalledWith(track1, getNextTrackForAutoAdvance);
  });

  it('sans aucun titre, le clic sur la pochette n\'appelle pas resolveAndTogglePreview', () => {
    const resolveAndTogglePreview = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistHeader {...baseProps({ resolveAndTogglePreview })} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(resolveAndTogglePreview).not.toHaveBeenCalled();
  });

  // ⚠️ CORRIGÉ (05/08, retour direct — "le cadenas me semble suffisant...
  // surtout si tu mets une infobulle au survol") : le libellé texte
  // "Lecture seule" retiré du DOM visible, remplacé par un `title` natif
  // sur le badge — `getByText` ne matche plus, retargeté sur `getByTitle`/
  // `queryByTitle`.
  it('badge "Lecture seule" (icône + title) affiché si isSaved=false, absent si isSaved=true', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    const { rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTitle(/Lecture seule/)).toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByTitle(/Lecture seule/)).not.toBeInTheDocument();
  });

  it('médaille de rang affichée seulement si getRankStyle renvoie un style', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ id: 'pl1', completions: ['2026-01-01'] }) })
    );
    const savedPlaylists = [makePlaylist({ id: 'pl1', completions: ['2026-01-01'] })];
    const getRankStyle = vi.fn(() => ({ emoji: '🥇' }));
    render(<PlaylistHeader {...baseProps({ savedPlaylists, getRankStyle })} />);
    expect(screen.getByText('🥇')).toBeInTheDocument();
  });

  it('renommer : le bouton crayon n\'apparaît que si isSaved=true, cliquer préremplit et ouvre l\'édition', () => {
    const setEditedPlaylistName = vi.fn();
    const setIsEditingPlaylistName = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, setEditedPlaylistName, setIsEditingPlaylistName }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByTitle('Renommer la playlist'));

    expect(setEditedPlaylistName).toHaveBeenCalledWith('Ma Séance');
    expect(setIsEditingPlaylistName).toHaveBeenCalledWith(true);
  });

  it('pas de bouton renommer quand isSaved=false', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByTitle('Renommer la playlist')).not.toBeInTheDocument();
  });

  it('en édition : Entrée valide (handleRenamePlaylist), Échap annule (setIsEditingPlaylistName(false))', () => {
    const handleRenamePlaylist = vi.fn();
    const setIsEditingPlaylistName = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ isEditingPlaylistName: true, editedPlaylistName: 'Nouveau nom', handleRenamePlaylist, setIsEditingPlaylistName })
    );
    render(<PlaylistHeader {...baseProps()} />);

    const input = screen.getByDisplayValue('Nouveau nom');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleRenamePlaylist).toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(setIsEditingPlaylistName).toHaveBeenCalledWith(false);
  });

  // Vague 2, Chantier 3 — "description texte libre sur une playlist/routine
  // publique" (02/08). Même schéma exact que les tests "renommer" juste
  // au-dessus, transposé à la description.
  it('description : invite "+ Ajouter une description" affichée quand isSaved=true et aucune description', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ description: undefined }) }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('+ Ajouter une description')).toBeInTheDocument();
  });

  it('description : pas d\'invite "Ajouter" quand isSaved=false (playlist étrangère non sauvegardée)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, currentPlaylist: makePlaylist({ description: undefined }) }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText('+ Ajouter une description')).not.toBeInTheDocument();
  });

  it('description : affichée en lecture seule pour un VISITEUR (isReadOnly), sans bouton de modification', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ isSaved: false, isReadOnly: true, currentPlaylist: makePlaylist({ description: 'Une belle séance pour bien commencer la semaine' }) })
    );
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Une belle séance pour bien commencer la semaine')).toBeInTheDocument();
    expect(screen.queryByTitle('Modifier la description')).not.toBeInTheDocument();
  });

  it('description : cliquer le crayon préremplit le brouillon et ouvre l\'édition', () => {
    const setEditedPlaylistDescription = vi.fn();
    const setIsEditingPlaylistDescription = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ description: 'Description existante' }), setEditedPlaylistDescription, setIsEditingPlaylistDescription })
    );
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByTitle('Modifier la description'));

    expect(setEditedPlaylistDescription).toHaveBeenCalledWith('Description existante');
    expect(setIsEditingPlaylistDescription).toHaveBeenCalledWith(true);
  });

  it('description : en édition, "Enregistrer" appelle handleEditPlaylistDescription, "Annuler" ferme sans l\'appeler', () => {
    const handleEditPlaylistDescription = vi.fn();
    const setIsEditingPlaylistDescription = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ isEditingPlaylistDescription: true, editedPlaylistDescription: 'Brouillon', handleEditPlaylistDescription, setIsEditingPlaylistDescription })
    );
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByText('Annuler'));
    expect(setIsEditingPlaylistDescription).toHaveBeenCalledWith(false);
    expect(handleEditPlaylistDescription).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Enregistrer'));
    expect(handleEditPlaylistDescription).toHaveBeenCalled();
  });

  it('genres : affiche cfg.selectedGenres (via genreDisplayLabel) en priorité sur les genres réels des titres', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ config: { selectedGenres: ['Rock', 'Pop'] } }) })
    );
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Rock, Pop')).toBeInTheDocument();
  });

  it('genres : sans cfg.selectedGenres, replie sur les genres réels des titres', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ config: {}, tracks: [{ ...track1, genre: 'Techno' }] }) })
    );
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Techno')).toBeInTheDocument();
  });

  it('isLocked + au moins 1 complétion : affiche TopCompletionDate, et CompletionsList seulement si >1 complétion', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })
    );
    const { rerender } = render(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('top-completion-date-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('completions-list-mock')).not.toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01', '2026-01-08'] }) })
    );
    rerender(<PlaylistHeader {...baseProps({ isLocked: true })} />);
    expect(screen.getByTestId('completions-list-mock')).toBeInTheDocument();
  });

  it('import CSV : libellé et action dépendent de hasImportedDataForMostRecent', () => {
    const triggerCSVUpload = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({
        currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: {} }),
      })
    );
    render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload })} />);
    expect(screen.getByText('Importe tes données')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Importe tes données'));
    expect(triggerCSVUpload).toHaveBeenCalled();
  });

  it('import CSV : "Données importées" quand actualDataByDate contient déjà la date la plus récente', () => {
    mockUsePlaylistDetail.mockReturnValue(
      makeContextValue({
        currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: { '2026-01-01': [{}] } }),
      })
    );
    render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload: vi.fn() })} />);
    expect(screen.getByText('Données importées')).toBeInTheDocument();
  });

  // NOUVEAU (05/08, retour direct : "je dois pouvoir retirer des données
  // importées si je me trompe de fichier") — bouton "x" à côté de "Données
  // importées", visible UNIQUEMENT si `removeImportedData` est fourni ET
  // des données existent déjà pour la date la plus récente.
  describe('retirer les données importées (NOUVEAU, 05/08)', () => {
    const playlistWithData = makePlaylist({ completions: ['2026-01-01'], actualDataByDate: { '2026-01-01': [{}] } });

    it('absent si removeImportedData n\'est pas fourni (prop optionnelle)', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: playlistWithData }));
      render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload: vi.fn() })} />);
      expect(screen.queryByTitle('Retirer les données importées')).not.toBeInTheDocument();
    });

    it('absent si aucune donnée importée pour la date la plus récente, même avec removeImportedData fourni', () => {
      mockUsePlaylistDetail.mockReturnValue(
        makeContextValue({ currentPlaylist: makePlaylist({ completions: ['2026-01-01'], actualDataByDate: {} }) })
      );
      render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload: vi.fn(), removeImportedData: vi.fn() })} />);
      expect(screen.queryByTitle('Retirer les données importées')).not.toBeInTheDocument();
    });

    it('présent si des données existent, le clic appelle removeImportedData avec la playlist et la date', () => {
      const removeImportedData = vi.fn();
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: playlistWithData }));
      render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload: vi.fn(), removeImportedData })} />);

      fireEvent.click(screen.getByTitle('Retirer les données importées'));

      expect(removeImportedData).toHaveBeenCalledWith(playlistWithData, '2026-01-01');
    });
  });

  // ⚠️ CORRIGÉ (05/08, retour direct — bouton devenu icône seule + title,
  // même emplacement que le badge "Lecture seule") : `getByText` ne
  // matche plus, retargeté sur `getByTitle`.
  it('sauvegarde : isSaved=true propose le bouton "Retirer" (icône, handleUnsavePlaylist)', () => {
    const handleUnsavePlaylist = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, handleUnsavePlaylist }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByTitle("Retirer cette séance de 'Mes Séances'"));
    expect(handleUnsavePlaylist).toHaveBeenCalled();
  });

  it('sauvegarde : isSaved=false propose "Ajouter à Mes Séances" (handleSavePlaylist)', () => {
    const handleSavePlaylist = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false, handleSavePlaylist }));
    render(<PlaylistHeader {...baseProps()} />);

    fireEvent.click(screen.getByText('Ajouter à Mes Séances'));
    expect(handleSavePlaylist).toHaveBeenCalled();
  });

  it('"Planifier" n\'apparaît que si isSaved=true, affiche la date déjà planifiée sinon "Planifier"', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
    const { rerender } = render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText('Planifier')).not.toBeInTheDocument();

    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ plannedDate: null }) }));
    rerender(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Planifier')).toBeInTheDocument();
  });

  it('changer la date planifiée appelle setPlaylistPlannedDate avec l\'id de la playlist', () => {
    const setPlaylistPlannedDate = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ id: 'pl1' }) }));
    const { container } = render(<PlaylistHeader {...baseProps({ setPlaylistPlannedDate })} />);

    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-02-14' } });

    expect(setPlaylistPlannedDate).toHaveBeenCalledWith('pl1', '2026-02-14');
  });

  it('le clic sur "Partager" appelle onShare', () => {
    const onShare = vi.fn();
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps({ onShare })} />);

    fireEvent.click(screen.getByText('Partager'));

    expect(onShare).toHaveBeenCalled();
  });

  it('badge BPM : affiche le BPM moyen, avec le libellé de zone si un profil réel est configuré', async () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    const appConfig = await import('../../../src/appConfig.js');
    appConfig.getZoneForValue.mockReturnValueOnce({ shortLabel: 'Seuil', color: '#f59e0b' });

    render(<PlaylistHeader {...baseProps()} />);

    // avgBpm = (140+160)/2 = 150
    expect(screen.getByText('150 BPM • Seuil')).toBeInTheDocument();
  });

  it('badge BPM : sans profil configuré, affiche juste le BPM (pas de suffixe de zone)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue());
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('150 BPM')).toBeInTheDocument();
  });

  it('sans aucun titre, le badge BPM n\'est pas affiché du tout', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({ currentPlaylist: makePlaylist({ tracks: [] }) }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByText(/BPM/)).not.toBeInTheDocument();
  });

  // Feature Sociale — Refonte Structurale Round 2/2 (01/08) : bascule
  // publique/privée individuelle.
  // ⚠️ CORRIGÉ (05/08, retour direct — bouton devenu icône seule + title,
  // même traitement que "Retirer") : `getByText('Rendre publique'/'Publique')`
  // ne matche plus, retargeté sur `getByTitle`.
  describe('toggle publique/privée', () => {
    it('absent quand isSaved=false — rien à rendre public tant que la playlist n\'existe pas dans "Mes Séances"', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: false }));
      render(<PlaylistHeader {...baseProps()} />);
      expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
      expect(screen.queryByTitle("Visible sur ton profil public — clique pour la rendre privée")).not.toBeInTheDocument();
    });

    it('title "Rendre cette playlist visible..." quand currentPlaylist.isPublic=false, "Visible sur ton profil public..." quand true', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ isPublic: false }) }));
      const { rerender } = render(<PlaylistHeader {...baseProps()} />);
      expect(screen.getByTitle('Rendre cette playlist visible sur ton profil public')).toBeInTheDocument();

      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, currentPlaylist: makePlaylist({ isPublic: true }) }));
      rerender(<PlaylistHeader {...baseProps()} />);
      expect(screen.getByTitle("Visible sur ton profil public — clique pour la rendre privée")).toBeInTheDocument();
      expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
    });

    it('le clic appelle handleTogglePlaylistPublic', () => {
      const handleTogglePlaylistPublic = vi.fn();
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isSaved: true, handleTogglePlaylistPublic }));
      render(<PlaylistHeader {...baseProps()} />);

      fireEvent.click(screen.getByTitle('Rendre cette playlist visible sur ton profil public'));

      expect(handleTogglePlaylistPublic).toHaveBeenCalled();
    });
  });

  // Feature Sociale — Consultation/Clonage (01/08) : mode lecture seule
  // sur une playlist étrangère consultée depuis le profil public de
  // quelqu'un d'autre.
  describe('isReadOnly', () => {
    it('affiche "Sauvegarder dans mes séances" (pas "Ajouter"/bouton Retirer), le clic appelle handleClonePlaylist', () => {
      const handleClonePlaylist = vi.fn();
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isReadOnly: true, isSaved: false, handleClonePlaylist }));
      render(<PlaylistHeader {...baseProps()} />);

      expect(screen.getByText('Sauvegarder dans mes séances')).toBeInTheDocument();
      expect(screen.queryByText('Ajouter à Mes Séances')).not.toBeInTheDocument();
      expect(screen.queryByTitle("Retirer cette séance de 'Mes Séances'")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Sauvegarder dans mes séances'));
      expect(handleClonePlaylist).toHaveBeenCalled();
    });

    it('isReadOnly=true PRIME sur isSaved=true (cas normalement impossible, mais l\'ordre de vérification du code doit rester isReadOnly EN PREMIER)', () => {
      // Vérifie l'ORDRE de la chaîne ternaire elle-même (isReadOnly ?
      // ... : isSaved ? ... : ...) plutôt que de supposer qu'isSaved vaut
      // toujours false quand isReadOnly est vrai — un futur changement qui
      // inverserait l'ordre des deux conditions casserait silencieusement
      // le comportement pour un visiteur, ce test l'attraperait.
      // Couvre aussi le bouton corbeille en coin (`top-4 right-4`, 05/08) :
      // sorti de cette même ternaire, il vérifie désormais `isSaved &&
      // !isReadOnly` explicitement pour garder la même garantie — ce test
      // l'attraperait aussi s'il régressait vers `isSaved` seul.
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isReadOnly: true, isSaved: true }));
      render(<PlaylistHeader {...baseProps()} />);
      expect(screen.getByText('Sauvegarder dans mes séances')).toBeInTheDocument();
      expect(screen.queryByTitle("Retirer cette séance de 'Mes Séances'")).not.toBeInTheDocument();
    });

    it('masque le bouton d\'import CSV même si isLocked=true', () => {
      const triggerCSVUpload = vi.fn();
      mockUsePlaylistDetail.mockReturnValue(
        makeContextValue({ isReadOnly: true, currentPlaylist: makePlaylist({ completions: ['2026-01-01'] }) })
      );
      render(<PlaylistHeader {...baseProps({ isLocked: true, triggerCSVUpload })} />);

      expect(screen.queryByText('Importe tes données')).not.toBeInTheDocument();
      expect(screen.queryByText('Données importées')).not.toBeInTheDocument();
    });

    it('reste absent même si isSaved=true (défense en profondeur, !isReadOnly ajouté au garde)', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isReadOnly: true, isSaved: true, currentPlaylist: makePlaylist({ isPublic: true }) }));
      render(<PlaylistHeader {...baseProps()} />);
      expect(screen.queryByTitle("Visible sur ton profil public — clique pour la rendre privée")).not.toBeInTheDocument();
      expect(screen.queryByTitle('Rendre cette playlist visible sur ton profil public')).not.toBeInTheDocument();
    });

    // Relecture globale (02/08) — même incohérence trouvée sur 2 AUTRES
    // boutons (renommer, planifier), tous les 3 corrigés ensemble.
    it('masque aussi le bouton renommer (crayon) même si isSaved=true', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isReadOnly: true, isSaved: true }));
      render(<PlaylistHeader {...baseProps()} />);
      expect(screen.queryByTitle('Renommer la playlist')).not.toBeInTheDocument();
    });

    it('masque aussi le bouton "Planifier" même si isSaved=true', () => {
      mockUsePlaylistDetail.mockReturnValue(makeContextValue({ isReadOnly: true, isSaved: true }));
      render(<PlaylistHeader {...baseProps()} />);
      expect(screen.queryByText('Planifier')).not.toBeInTheDocument();
    });
  });
});

// NOUVEAU (05/08, retour direct : "ajouter le nom du compte créateur...
// quand je suis dans sa playlist en vitrine, et mon nom une fois que je
// suis dans ma playlist sauvegardée") — voir le calcul d'`ownerLabel` dans
// PlaylistHeader.jsx pour le raisonnement complet des 4 branches testées
// ici.
describe('PlaylistHeader — étiquette "propriétaire actuel" (NOUVEAU, 05/08)', () => {
  // ⚠️ CORRIGÉ (05/08, retour direct, capture annotée — 2e passe) : pas
  // d'arobase ("on perd un caractère"), "TempoFit Officiel" avec majuscules
  // (cohérence avec `author: 'TempoFit Officiel'`, déjà utilisé partout
  // ailleurs) plutôt que le pseudo technique tout en minuscules.
  it('isSaved=true : affiche TON pseudo (username), peu importe l\'origine de la playlist', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: true, username: 'mon_pseudo',
      currentPlaylist: makePlaylist({ sourceTemplateId: 'tpl-cardio' }), // même déjà cloné d'un template : c'est TOI le propriétaire une fois sauvegardé
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('mon_pseudo')).toBeInTheDocument();
  });

  // BUG CORRIGÉ (05/08, retour direct — capture montrant l'espace vide
  // sous la pochette : "je suis en mode invité, par défaut mets 'Guest
  // Mode' plutôt que rien") : `username` vaut `null` en mode invité,
  // `ownerLabel` retombait sur `null` aussi, étiquette invisible.
  it('isSaved=true SANS username (mode invité) : affiche "Invité" plutôt que rien', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: true, username: null,
      currentPlaylist: makePlaylist(),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('Invité')).toBeInTheDocument();
  });

  it('isSaved=false + sourceTemplateId (template du catalogue, vitrine ou Découvrir direct) : affiche "TempoFit Officiel" (majuscules, pas le pseudo technique)', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: false, username: null,
      currentPlaylist: makePlaylist({ sourceTemplateId: 'tpl-cardio' }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('TempoFit Officiel')).toBeInTheDocument();
  });

  it('isSaved=false + ownerUsername (vraie playlist d\'un autre utilisateur) : affiche SON pseudo', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: false, username: null,
      currentPlaylist: makePlaylist({ ownerUsername: 'un_autre_coureur' }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByText('un_autre_coureur')).toBeInTheDocument();
  });

  it('isSaved=false, ni sourceTemplateId ni ownerUsername (génération fraîche pas encore sauvegardée) : aucune étiquette', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isSaved: false, username: null,
      currentPlaylist: makePlaylist(),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    // ⚠️ CORRIGÉ (05/08, 2e passe) : `/^@/` ne matchait plus rien
    // (l'arobase a été retirée) — testait donc toujours "vrai" par
    // construction, plus un vrai test. Vérifie explicitement l'absence des
    // 3 textes possibles à la place.
    expect(screen.queryByText('TempoFit Officiel')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Créée par/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('Cette playlist est dans ta bibliothèque')).not.toBeInTheDocument();
  });
});

// NOUVEAU (05/08, retour direct : "je ne vois pas le nombre de clones dans
// une playlist... c'est la demande de base") — voir la docstring du badge
// dans PlaylistHeader.jsx pour le raisonnement complet (gaté sur
// `isReadOnly`, toujours affiché même à 0).
describe('PlaylistHeader — compteur de clonages près du titre (NOUVEAU, 05/08)', () => {
  it('isReadOnly=true : affiche le compteur, même à 0', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isReadOnly: true, currentPlaylist: makePlaylist({ cloneCount: 0 }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('0');
  });

  it('isReadOnly=true avec un vrai compteur : affiche la vraie valeur', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isReadOnly: true, currentPlaylist: makePlaylist({ cloneCount: 42 }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('42');
  });

  it('isReadOnly=false (playlist déjà sauvegardée ou génération fraîche) : aucun compteur affiché', () => {
    mockUsePlaylistDetail.mockReturnValue(makeContextValue({
      isReadOnly: false, currentPlaylist: makePlaylist({ cloneCount: 42 }),
    }));
    render(<PlaylistHeader {...baseProps()} />);
    expect(screen.queryByTitle('Nombre de fois où cette playlist a été clonée')).not.toBeInTheDocument();
  });
});
