// @vitest-environment jsdom
//
// Palier 4 (31/07, 3e) — ShareModal, tout juste restauré après l'incident
// documenté dans ShareModal.jsx (ce fichier était devenu une copie de
// SearchModal.jsx, cassant tout partage dans l'app).
//
// RATTRAPÉ (21/08, extraction ShareImageContext.jsx) — `summaryImageStatus`/
// `summaryImageFile`/`summaryImagePreviewUrl`/`includeSummaryImage`/
// `setIncludeSummaryImage` ne sont PLUS des props : `useShareImage()` mocké
// dynamiquement (vi.fn() + mockReturnValue), même pattern que
// MiniPlayerBar.test.jsx pour AudioPlayerContext — nécessaire pour piloter
// ces valeurs différemment à chaque test. Tout le reste (canaux de partage,
// ouverture/fermeture) reste des props classiques, inchangé.
//
// `navigator.share` n'existe pas nativement dans jsdom — stubbé
// explicitement dans les tests qui en ont besoin, absent par défaut dans
// les autres (ce qui reflète fidèlement un navigateur desktop sans Web
// Share API, un vrai cas réel, pas juste une limite de l'environnement de
// test).

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import ShareModal from '../../src/components/modals/ShareModal.jsx';
import { useShareImage } from '../../src/contexts/ShareImageContext.jsx';

vi.mock('../../src/contexts/ShareImageContext.jsx', () => ({
  useShareImage: vi.fn(),
}));

const mockTheme = {
  cardBg: 'mock-card-bg', cardBorder: 'mock-border', textHighlight: 'mock-highlight',
  textColorClass: 'mock-text-color', inputBg: 'mock-input-bg', inputBorder: 'mock-input-border',
  textMuted: 'mock-muted', bgAccentClass: 'mock-accent-bg',
};

const playlistShareData = { type: 'playlist', title: 'Ma Séance', text: 'Je viens de terminer une séance !', url: 'https://tempofit.example/?import=abc' };
const trophyShareData = { type: 'trophy', title: 'Ambassadeur', text: 'J\'ai débloqué le trophée Ambassadeur 🔥', url: 'https://tempofit.example' };

function baseProps(overrides = {}) {
  return {
    theme: mockTheme,
    isShareModalOpen: true,
    onClose: vi.fn(),
    shareData: playlistShareData,
    shareNative: vi.fn(),
    shareToWhatsApp: vi.fn(),
    shareToTwitter: vi.fn(),
    shareToFacebook: vi.fn(),
    copyToClipboard: vi.fn(),
    shareViaEmail: vi.fn(),
    shareImageFile: vi.fn(() => Promise.resolve('shared')),
    // Mock par défaut : délègue directement au repli reçu en 4e argument
    // (`shareImageFile`, voir ShareModal.jsx) — reproduit le comportement
    // réel de `shareToInstagramStories` (useShare.js) hors iOS, le cas
    // TOUJOURS vrai dans l'environnement de test jsdom (`navigator.userAgent`
    // n'y ressemble jamais à un iPhone).
    shareToInstagramStories: vi.fn((file, title, text, fallback) => fallback(file, title, text)),
    ...overrides,
  };
}

function mockShareImage(overrides = {}) {
  return {
    summaryImageStatus: 'idle',
    summaryImageFile: null,
    summaryImagePreviewUrl: null,
    includeSummaryImage: true,
    setIncludeSummaryImage: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  // Par défaut, pas de Web Share API (cas desktop réel le plus courant) —
  // les tests qui en ont besoin la posent explicitement.
  delete navigator.share;
  // Valeur par défaut neutre — les tests du bloc "bilan visuel de séance"
  // écrasent explicitement avec leur propre mockReturnValue avant de rendre.
  useShareImage.mockReturnValue(mockShareImage());
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  // BUG CORRIGÉ (01/08, suite — passage à isolate:false) — avant, seul le
  // `beforeEach` ci-dessus réinitialisait `navigator.share`, ce qui
  // suffisait tant que chaque fichier de test recevait un environnement
  // jsdom entièrement neuf (comportement par défaut de Vitest). Avec
  // isolate:false, l'environnement jsdom est désormais RÉUTILISÉ entre
  // fichiers d'un même worker : sans ce nettoyage ici, `navigator.share`
  // laissé à un `vi.fn()` par le DERNIER test de CE fichier (voir plus bas,
  // "avec navigator.share...") pouvait fuiter vers le fichier de test
  // suivant exécuté dans le même worker — aucun autre fichier ne dépend
  // aujourd'hui de l'absence de `navigator.share` par défaut, donc aucun
  // échec observé à ce jour, mais un vrai risque latent pour tout futur
  // test qui en dépendrait.
  delete navigator.share;
});

describe('ShareModal — affichage de base', () => {
  it('ne rend rien quand isShareModalOpen=false', () => {
    const { container } = render(<ShareModal {...baseProps({ isShareModalOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('ne rend rien quand shareData est null, même si isShareModalOpen=true', () => {
    const { container } = render(<ShareModal {...baseProps({ shareData: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le texte de partage', () => {
    render(<ShareModal {...baseProps()} />);
    expect(screen.getByText('Je viens de terminer une séance !')).toBeInTheDocument();
  });

  it('le clic sur le fond ferme la modale, le clic à l\'intérieur non (stopPropagation), le X ferme aussi', () => {
    const onClose = vi.fn();
    const { container } = render(<ShareModal {...baseProps({ onClose })} />);

    fireEvent.click(screen.getByText('Je viens de terminer une séance !'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('svg.lucide-x').closest('button'));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('ShareModal — bilan visuel de séance', () => {
  it('summaryImageStatus="loading" (type playlist) : affiche le message de préparation', () => {
    useShareImage.mockReturnValue(mockShareImage({ summaryImageStatus: 'loading' }));
    render(<ShareModal {...baseProps()} />);
    expect(screen.getByText('Préparation du bilan visuel...')).toBeInTheDocument();
  });

  it('type "trophy" en "loading" : affiche le texte de préparation dédié aux trophées ("visuel", pas "bilan visuel" — propre à une playlist), depuis le chantier "visuel de trophée partageable" (01/09)', () => {
    useShareImage.mockReturnValue(mockShareImage({ summaryImageStatus: 'loading' }));
    render(<ShareModal {...baseProps({ shareData: trophyShareData })} />);
    expect(screen.getByText('Préparation du visuel...')).toBeInTheDocument();
    expect(screen.queryByText('Préparation du bilan visuel...')).not.toBeInTheDocument();
  });

  it('image prête et incluse : affiche l\'aperçu, la croix retire l\'image (setIncludeSummaryImage(false))', () => {
    const setIncludeSummaryImage = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'),
      summaryImagePreviewUrl: 'blob:preview', setIncludeSummaryImage,
    }));
    render(<ShareModal {...baseProps()} />);
    expect(screen.getByAltText('Bilan visuel de la séance')).toHaveAttribute('src', 'blob:preview');

    fireEvent.click(screen.getByTitle('Retirer le bilan visuel'));
    expect(setIncludeSummaryImage).toHaveBeenCalledWith(false);
  });

  it('image prête mais includeSummaryImage=false : pas d\'aperçu affiché', () => {
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'),
      summaryImagePreviewUrl: 'blob:preview', includeSummaryImage: false,
    }));
    render(<ShareModal {...baseProps()} />);
    expect(screen.queryByAltText('Bilan visuel de la séance')).not.toBeInTheDocument();
  });

  it('le lien de téléchargement du visuel n\'apparaît que si l\'image est prête et incluse', () => {
    const { rerender } = render(<ShareModal {...baseProps()} />);
    expect(screen.queryByText(/Télécharger le visuel/)).not.toBeInTheDocument();

    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'), summaryImagePreviewUrl: 'blob:preview',
    }));
    rerender(<ShareModal {...baseProps()} />);
    const downloadLink = screen.getByText(/Télécharger le visuel/).closest('a');
    expect(downloadLink).toHaveAttribute('href', 'blob:preview');
    expect(downloadLink).toHaveAttribute('download', 'tempofit-bilan-de-seance.png');
  });

  it('type "trophy" avec image prête : hasReadyImage fonctionne comme pour une playlist (fusion image+texte, nom de fichier dédié) — 01/09, chantier "visuel de trophée partageable"', () => {
    navigator.share = vi.fn();
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'tempofit-trophee.png'), summaryImagePreviewUrl: 'blob:trophee-preview',
    }));
    render(<ShareModal {...baseProps({ shareData: trophyShareData })} />);

    // Même encart fusionné image+texte que pour une playlist (voir le
    // chantier "texte à côté du visuel" du même jour) — PAS le texte
    // pleine largeur utilisé sinon.
    expect(screen.getByAltText('Bilan visuel de la séance')).toHaveAttribute('src', 'blob:trophee-preview');
    expect(screen.getByText('Story / IG')).toBeInTheDocument();

    // Nom de fichier de téléchargement DÉDIÉ (pas celui d'une playlist).
    const downloadLink = screen.getByText(/Télécharger le visuel/).closest('a');
    expect(downloadLink).toHaveAttribute('href', 'blob:trophee-preview');
    expect(downloadLink).toHaveAttribute('download', 'tempofit-trophee.png');
  });
});

describe('ShareModal — canaux de partage', () => {
  it('sans navigator.share : pas de bouton de partage natif', () => {
    render(<ShareModal {...baseProps()} />);
    expect(screen.queryByTitle('Autres options')).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Partager le visuel/)).not.toBeInTheDocument();
  });

  it('avec navigator.share, sans image prête : le bouton natif appelle shareNative (pas shareImageFile)', () => {
    navigator.share = vi.fn();
    const shareNative = vi.fn();
    const shareImageFile = vi.fn();
    render(<ShareModal {...baseProps({ shareNative, shareImageFile })} />);

    fireEvent.click(screen.getByTitle('Autres options'));

    expect(shareNative).toHaveBeenCalled();
    expect(shareImageFile).not.toHaveBeenCalled();
  });

  it('avec navigator.share ET image prête : le bouton natif appelle shareToInstagramStories (avec shareImageFile en repli) puis ferme la modale', async () => {
    navigator.share = vi.fn();
    const shareImageFile = vi.fn(() => Promise.resolve('shared'));
    const shareToInstagramStories = vi.fn((file, title, text, fallback) => fallback(file, title, text));
    const shareNative = vi.fn();
    const onClose = vi.fn();
    const file = new File(['x'], 'bilan.png');
    useShareImage.mockReturnValue(mockShareImage({
      summaryImageStatus: 'ready', summaryImageFile: file, summaryImagePreviewUrl: 'blob:preview',
    }));
    render(
      <ShareModal
        {...baseProps({ shareImageFile, shareToInstagramStories, shareNative, onClose })}
      />
    );

    fireEvent.click(screen.getByTitle('Partager le visuel (Story, Instagram, WhatsApp...)'));

    // `shareToInstagramStories` reçoit bien `shareImageFile` (PAS une
    // version fermée en dur dans useShare.js) en 4e argument — condition
    // pour que le trophée "hasSharedSomething" (voir
    // `shareImageFileWithTrophy`, App.jsx) se déclenche pareil quel que
    // soit le chemin de partage réellement emprunté (01/09, retour direct
    // "es-tu sûr que les boutons de partage ouvrent bien les réseaux
    // sociaux ?" — Instagram Stories n'a pas d'URL de partage web, voir
    // la docstring de `shareToInstagramStories`, useShare.js).
    await waitFor(() => expect(shareToInstagramStories).toHaveBeenCalledWith(file, 'Ma Séance', 'Je viens de terminer une séance !', shareImageFile));
    await waitFor(() => expect(shareImageFile).toHaveBeenCalledWith(file, 'Ma Séance', 'Je viens de terminer une séance !'));
    expect(shareNative).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('WhatsApp/X/Facebook appellent chacun leur callback', () => {
    const shareToWhatsApp = vi.fn();
    const shareToTwitter = vi.fn();
    const shareToFacebook = vi.fn();
    render(<ShareModal {...baseProps({ shareToWhatsApp, shareToTwitter, shareToFacebook })} />);

    fireEvent.click(screen.getByTitle('WhatsApp'));
    fireEvent.click(screen.getByTitle('X (Twitter)'));
    fireEvent.click(screen.getByTitle('Facebook'));

    expect(shareToWhatsApp).toHaveBeenCalled();
    expect(shareToTwitter).toHaveBeenCalled();
    expect(shareToFacebook).toHaveBeenCalled();
  });

  it('"Copier le lien" appelle copyToClipboard', () => {
    const copyToClipboard = vi.fn();
    render(<ShareModal {...baseProps({ copyToClipboard })} />);
    fireEvent.click(screen.getByText('Copier le lien'));
    expect(copyToClipboard).toHaveBeenCalled();
  });

  it('"Envoyer par e-mail" appelle shareViaEmail', () => {
    const shareViaEmail = vi.fn();
    render(<ShareModal {...baseProps({ shareViaEmail })} />);
    fireEvent.click(screen.getByText('Envoyer par e-mail'));
    expect(shareViaEmail).toHaveBeenCalled();
  });
});
