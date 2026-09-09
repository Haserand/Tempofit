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

// Fichier "assez gros" pour dépasser MIN_VALID_TROPHY_IMAGE_BYTES
// (TrophiesView.jsx, 150 Ko) — sans ça, tout fichier mocké minuscule
// (`new File(['x'], ...)`, quelques octets) déclencherait à tort la
// logique de nouvelle tentative sur CHAQUE test, ralentissant inutilement
// toute la suite et masquant l'intention réelle de chaque test (voir la
// docstring du bloc "nouvelle tentative" plus bas pour LE test qui, lui,
// vérifie spécifiquement ce mécanisme avec un petit fichier délibéré).
function bigFile(name = 'tempofit-trophee.png') {
  return new File([new Uint8Array(200000)], name, { type: 'image/png' });
}

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
  captureElementAsFile.mockResolvedValue(bigFile());
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

  it('double-clic rapide sur 2 trophées différents : seul le résultat du DERNIER trophée cliqué est appliqué, jamais un résultat périmé (bug réel corrigé, capture d\'écran envoyée par l\'utilisateur — 2e trophée capturé quasi vierge)', async () => {
    // 2 trophées VISIBLES (pas secrets) marqués débloqués, pour avoir 2
    // boutons "Partager mon exploit" cliquables sans changer d'onglet.
    const trophyA = visibleTrophies[0];
    const trophyB = visibleTrophies[2];
    const setSummaryImageStatus = vi.fn();
    const setSummaryImageFile = vi.fn();
    const setSummaryImagePreviewUrl = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({ setSummaryImageStatus, setSummaryImageFile, setSummaryImagePreviewUrl }));
    const fileB = bigFile('b.png');
    captureElementAsFile.mockResolvedValue(fileB);
    render(<TrophiesView {...baseProps({
      userStats: { unlockedTrophies: [trophyA.id, trophyB.id], totalCompleted: 1, dataImports: 1 },
    })} />);
    const shareButtons = screen.getAllByText('Partager mon exploit');
    expect(shareButtons.length).toBe(2);

    // Les 2 clics partent AVANT que le double `requestAnimationFrame` du
    // 1er n'ait eu la moindre chance de se résoudre (il ne se résout QUE
    // sur une frame future, jamais dans le même tick synchrone) — au
    // moment où le 1er clic vérifie enfin "suis-je toujours le trophée
    // demandé ?", la réf a déjà été réécrite par le 2e clic.
    fireEvent.click(shareButtons[0]);
    fireEvent.click(shareButtons[1]);

    // Le résultat appliqué est celui du DERNIER trophée cliqué (B) — et
    // surtout, la capture du 1er trophée (périmée dès le clic sur le 2e)
    // n'a jamais été lancée ni appliquée : un seul appel de capture au
    // total, jamais 2 résultats qui se marchent dessus.
    await waitFor(() => expect(setSummaryImageFile).toHaveBeenCalledWith(fileB));
    await waitFor(() => expect(setSummaryImagePreviewUrl).toHaveBeenCalledWith('blob:mock-trophee'));
    expect(captureElementAsFile).toHaveBeenCalledTimes(1);
  });

  it('capture "vierge" (fichier trop petit, < 150 Ko) : retente automatiquement jusqu\'à obtenir un visuel valide, plutôt que d\'accepter le 1er résultat raté (2e bug réel corrigé, voir la docstring de shareTrophy)', async () => {
    const smallFile1 = new File([new Uint8Array(1000)], 'petit1.png', { type: 'image/png' });
    const smallFile2 = new File([new Uint8Array(2000)], 'petit2.png', { type: 'image/png' });
    const goodFile = bigFile('bon.png');
    captureElementAsFile
      .mockResolvedValueOnce(smallFile1)
      .mockResolvedValueOnce(smallFile2)
      .mockResolvedValueOnce(goodFile);
    const setSummaryImageFile = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({ setSummaryImageFile }));
    render(<TrophiesView {...baseProps()} />);

    fireEvent.click(screen.getByText('Partager mon exploit'));

    // Comparer des `File` par égalité profonde (`toHaveBeenCalledWith`) n'est
    // pas fiable ici (2 instances `File` distinctes n'exposent rien de
    // structurellement distinguable par une comparaison superficielle) —
    // on vérifie plutôt le NOM du fichier réellement appliqué, un par un.
    await waitFor(() => {
      const lastCall = setSummaryImageFile.mock.calls.at(-1);
      expect(lastCall?.[0]?.name).toBe('bon.png');
    }, { timeout: 2000 });
    expect(captureElementAsFile).toHaveBeenCalledTimes(3);
    expect(setSummaryImageFile.mock.calls.some(call => call[0]?.name === 'petit1.png')).toBe(false);
    expect(setSummaryImageFile.mock.calls.some(call => call[0]?.name === 'petit2.png')).toBe(false);
  });

  it('capture "vierge" à CHAQUE tentative (MAX_CAPTURE_ATTEMPTS atteint) : applique quand même le dernier résultat obtenu plutôt que de bloquer indéfiniment sans aucun visuel', async () => {
    const smallFile = new File([new Uint8Array(500)], 'toujours-petit.png', { type: 'image/png' });
    captureElementAsFile.mockResolvedValue(smallFile);
    const setSummaryImageFile = vi.fn();
    const setSummaryImageStatus = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({ setSummaryImageFile, setSummaryImageStatus }));
    render(<TrophiesView {...baseProps()} />);

    fireEvent.click(screen.getByText('Partager mon exploit'));

    await waitFor(() => expect(setSummaryImageStatus).toHaveBeenCalledWith('ready'), { timeout: 2000 });
    expect(captureElementAsFile).toHaveBeenCalledTimes(3); // MAX_CAPTURE_ATTEMPTS
    const lastCall = setSummaryImageFile.mock.calls.at(-1);
    expect(lastCall?.[0]?.name).toBe('toujours-petit.png');
  });
});
