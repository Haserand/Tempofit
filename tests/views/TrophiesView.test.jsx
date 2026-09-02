// @vitest-environment jsdom
//
// Premier fichier de test pour TrophiesView.jsx — trouvé sans AUCUNE
// couverture (check-up du 21/08, ni test direct ni référence indirecte
// dans tests/) malgré une vraie logique non triviale : masquage des
// trophées SECRET tant que non débloqués (le cœur de la fonctionnalité —
// une régression ici casserait silencieusement l'effet de surprise), 2
// pages distinctes (onglets), et un badge "vu" (`markTrophiesSeen`) appelé
// une seule fois au montage.
//
// TROPHIES_DATA/TROPHY_CATEGORIES utilisées TELLES QUELLES (appConfig.js,
// données pures, aucun effet de bord) plutôt que mockées — même convention
// que DiscoverView.test.jsx pour curatedSessions : les tests restent valides
// si le catalogue de trophées change (ajout/retrait), du moment que le
// jeu de données garde au moins 1 trophée secret et 1 non-secret par
// catégorie utilisée ci-dessous.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TrophiesView from '../../src/components/views/TrophiesView.jsx';
import { TROPHIES_DATA, TROPHY_CATEGORIES } from '../../src/appConfig.js';
import { useShareImage } from '../../src/contexts/ShareImageContext.jsx';
import { captureElementAsFile } from '../../src/utils/captureElementAsFile.js';

// Mockés (01/09, chantier "visuel de trophée partageable") — même
// convention que ShareModal.test.jsx/StatsView.test.jsx : la génération
// réelle de l'image (html2canvas-pro, contexte partagé) est hors scope
// d'un test de composant, chaque test pose son propre comportement.
vi.mock('../../src/contexts/ShareImageContext.jsx', () => ({
  useShareImage: vi.fn(),
}));
vi.mock('../../src/utils/captureElementAsFile.js', () => ({
  captureElementAsFile: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function mockShareImage(overrides = {}) {
  return {
    summaryImageStatus: 'idle',
    summaryImageContextKey: null,
    setSummaryImageStatus: vi.fn(),
    setSummaryImageFile: vi.fn(),
    setSummaryImagePreviewUrl: vi.fn(),
    setIncludeSummaryImage: vi.fn(),
    setSummaryImageContextKey: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  useShareImage.mockReturnValue(mockShareImage());
  captureElementAsFile.mockResolvedValue(new File(['x'], 'tempofit-trophee.png', { type: 'image/png' }));
  // `URL.createObjectURL`/`revokeObjectURL` — pas implémentées nativement
  // par jsdom (même piège déjà rencontré dans useShare.test.js) ;
  // `shareTrophy` (TrophiesView.jsx) les appelle directement, contrairement
  // à `exportGlobalStatsImage` (StatsView.jsx) qui délègue cette partie à
  // `shareImageFile`, mocké de bout en bout dans ce fichier-là.
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-trophee');
  global.URL.revokeObjectURL = vi.fn();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

// Dérivés des vraies données plutôt que codés en dur.
const visibleTrophies = TROPHIES_DATA.filter(t => !t.secret);
const secretTrophies = TROPHIES_DATA.filter(t => t.secret);
const unlockedVisible = visibleTrophies[0]; // catégorisé, jamais secret
const lockedVisible = visibleTrophies[1];
const unlockedSecret = secretTrophies[0];
const lockedSecret = secretTrophies[1];

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    userStats: {
      unlockedTrophies: [unlockedVisible.id, unlockedSecret.id],
      totalCompleted: 12,
      dataImports: 3,
    },
    handleShare: vi.fn(),
    isNaughtyMode: false,
    markTrophiesSeen: vi.fn(),
    ...overrides,
  };
}

describe('TrophiesView', () => {
  it('appelle markTrophiesSeen UNE SEULE FOIS au montage, pas à chaque re-render', () => {
    const markTrophiesSeen = vi.fn();
    const { rerender } = render(<TrophiesView {...baseProps({ markTrophiesSeen })} />);
    expect(markTrophiesSeen).toHaveBeenCalledTimes(1);

    rerender(<TrophiesView {...baseProps({ markTrophiesSeen, isNaughtyMode: true })} />);
    expect(markTrophiesSeen).toHaveBeenCalledTimes(1);
  });

  it('affiche l\'onglet "Trophées" par défaut, avec les catégories visibles groupées', () => {
    render(<TrophiesView {...baseProps()} />);
    TROPHY_CATEGORIES.forEach(cat => {
      const hasAny = visibleTrophies.some(t => t.category === cat.key);
      if (hasAny) {
        expect(screen.getByText(cat.label)).toBeInTheDocument();
      }
    });
  });

  it('affiche le VRAI nom/description d\'un trophée VISIBLE, verrouillé ou pas', () => {
    render(<TrophiesView {...baseProps()} />);
    expect(screen.getByText(lockedVisible.name)).toBeInTheDocument();
    expect(screen.getByText(lockedVisible.desc)).toBeInTheDocument();
    expect(screen.getByText(unlockedVisible.name)).toBeInTheDocument();
  });

  it('masque un trophée SECRET encore verrouillé — jamais le vrai nom/description dans le DOM', () => {
    render(<TrophiesView {...baseProps()} />);
    fireEvent.click(screen.getByText(/Secrets/));

    // lockedSecret n'est PAS dans unlockedTrophies (baseProps) → masqué.
    expect(screen.queryByText(lockedSecret.name)).not.toBeInTheDocument();
    expect(screen.queryByText(lockedSecret.desc)).not.toBeInTheDocument();
    expect(screen.getAllByText('Trophée secret').length).toBeGreaterThan(0);
  });

  it('révèle le VRAI nom/description d\'un trophée SECRET une fois débloqué', () => {
    render(<TrophiesView {...baseProps()} />);
    fireEvent.click(screen.getByText(/Secrets/));

    // unlockedSecret EST dans unlockedTrophies (baseProps) → révélé en entier.
    expect(screen.getByText(unlockedSecret.name)).toBeInTheDocument();
    expect(screen.getByText(unlockedSecret.desc)).toBeInTheDocument();
  });

  it('l\'onglet Secrets n\'a AUCUN en-tête de catégorie (pas de sous-catégorisation, pour ne pas indicer le thème)', () => {
    render(<TrophiesView {...baseProps()} />);
    fireEvent.click(screen.getByText(/Secrets/));
    TROPHY_CATEGORIES.forEach(cat => {
      expect(screen.queryByText(cat.label)).not.toBeInTheDocument();
    });
  });

  it('le bouton "Partager mon exploit" n\'apparaît que sur un trophée DÉBLOQUÉ, jamais un verrouillé', () => {
    render(<TrophiesView {...baseProps()} />);
    // unlockedVisible débloqué : bouton présent quelque part dans le DOM.
    const shareButtons = screen.getAllByText('Partager mon exploit');
    expect(shareButtons.length).toBeGreaterThan(0);
    // Nombre de boutons "Partager" doit correspondre au nombre de trophées
    // débloqués actuellement affichés dans l'onglet visible (1 seul ici :
    // unlockedVisible — unlockedSecret est dans l'autre onglet).
    expect(shareButtons.length).toBe(1);
  });

  it('le clic sur "Partager mon exploit" appelle handleShare(\'trophy\', trophy) avec le bon trophée', () => {
    const handleShare = vi.fn();
    render(<TrophiesView {...baseProps({ handleShare })} />);
    fireEvent.click(screen.getByText('Partager mon exploit'));
    expect(handleShare).toHaveBeenCalledWith('trophy', unlockedVisible);
  });

  it('les compteurs des onglets reflètent le nombre de trophées débloqués / total', () => {
    render(<TrophiesView {...baseProps()} />);
    expect(screen.getByText(`Trophées (1/${visibleTrophies.length})`)).toBeInTheDocument();
    expect(screen.getByText(`Secrets (1/${secretTrophies.length})`)).toBeInTheDocument();
  });

  it('affiche les stats globales (sessions totales, fichiers analysés) en pied de page', () => {
    render(<TrophiesView {...baseProps({ userStats: {
      unlockedTrophies: [],
      totalCompleted: 42,
      dataImports: 7,
    } })} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});

// 01/09, chantier "vrai partage Instagram Stories" — "et pour les
// trophées ?" puis "oui, crée un visuel pour les trophées" : le clic sur
// "Partager mon exploit" génère désormais un visuel (TrophyShareCard.jsx,
// capturé via captureElementAsFile), en plus d'ouvrir la modale de texte
// comme avant.
describe('TrophiesView — génération du visuel partageable (shareTrophy)', () => {
  it('pose loading puis ready, avec la clé de contexte "trophy:{id}" (voir ShareImageContext.jsx pour le raisonnement complet)', async () => {
    const setSummaryImageStatus = vi.fn();
    const setSummaryImageContextKey = vi.fn();
    const setSummaryImageFile = vi.fn();
    const setSummaryImagePreviewUrl = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({
      setSummaryImageStatus, setSummaryImageContextKey, setSummaryImageFile, setSummaryImagePreviewUrl,
    }));
    render(<TrophiesView {...baseProps()} />);

    await act(async () => { fireEvent.click(screen.getByText('Partager mon exploit')); });

    expect(setSummaryImageStatus).toHaveBeenCalledWith('loading');
    expect(setSummaryImageContextKey).toHaveBeenCalledWith(`trophy:${unlockedVisible.id}`);
    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('ready'));
    expect(captureElementAsFile).toHaveBeenCalledWith(expect.anything(), 'tempofit-trophee.png', { scale: 2.7 });
    expect(setSummaryImageFile).toHaveBeenCalled();
    expect(setSummaryImagePreviewUrl).toHaveBeenCalledWith('blob:mock-trophee');
  });

  it('appelle bien handleShare(\'trophy\', trophy) — le texte reste utilisable immédiatement, sans attendre la génération de l\'image', () => {
    const handleShare = vi.fn();
    render(<TrophiesView {...baseProps({ handleShare })} />);
    fireEvent.click(screen.getByText('Partager mon exploit'));
    // Appelé de façon SYNCHRONE, avant même que la promesse de capture ne
    // se résolve — contrairement à setSummaryImageStatus('ready') (voir le
    // test précédent, qui doit lui attendre un `waitFor`).
    expect(handleShare).toHaveBeenCalledWith('trophy', unlockedVisible);
  });

  it('un trophée déjà "ready" avec la MÊME clé de contexte ne régénère pas (évite un travail redondant, ex. double-clic)', async () => {
    const setSummaryImageStatus = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready',
      summaryImageContextKey: `trophy:${unlockedVisible.id}`,
      setSummaryImageStatus,
    }));
    const handleShare = vi.fn();
    render(<TrophiesView {...baseProps({ handleShare })} />);

    fireEvent.click(screen.getByText('Partager mon exploit'));

    expect(handleShare).toHaveBeenCalledWith('trophy', unlockedVisible);
    expect(setSummaryImageStatus).not.toHaveBeenCalled();
    expect(captureElementAsFile).not.toHaveBeenCalled();
  });

  it('un "ready" appartenant à un AUTRE sujet (ex. une playlist) régénère bien — ne réutilise jamais l\'image d\'un autre partage par erreur', async () => {
    const setSummaryImageStatus = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready',
      summaryImageContextKey: 'playlist:abc123', // "ready", mais pour un AUTRE sujet
      setSummaryImageStatus,
    }));
    render(<TrophiesView {...baseProps()} />);

    await act(async () => { fireEvent.click(screen.getByText('Partager mon exploit')); });

    expect(setSummaryImageStatus).toHaveBeenCalledWith('loading');
    await waitFor(() => expect(captureElementAsFile).toHaveBeenCalled());
  });

  it('échec de la capture : bascule sur \'error\', silencieusement (pas de crash, le partage texte/lien reste utilisable)', async () => {
    captureElementAsFile.mockRejectedValue(new Error('html2canvas bloqué'));
    const setSummaryImageStatus = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({ setSummaryImageStatus }));
    render(<TrophiesView {...baseProps()} />);

    await act(async () => { fireEvent.click(screen.getByText('Partager mon exploit')); });

    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('error'));
  });
});
