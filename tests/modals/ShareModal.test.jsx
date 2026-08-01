// @vitest-environment jsdom
//
// Palier 4 (31/07, 3e) — ShareModal, tout juste restauré après l'incident
// documenté dans ShareModal.jsx (ce fichier était devenu une copie de
// SearchModal.jsx, cassant tout partage dans l'app). Aucun Context, tout
// passe par des props. `navigator.share` n'existe pas nativement dans
// jsdom — stubbé explicitement dans les tests qui en ont besoin, absent
// par défaut dans les autres (ce qui reflète fidèlement un navigateur
// desktop sans Web Share API, un vrai cas réel, pas juste une limite de
// l'environnement de test).

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import ShareModal from '../../src/components/modals/ShareModal.jsx';

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
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    render(<ShareModal {...baseProps({ summaryImageStatus: 'loading' })} />);
    expect(screen.getByText('Préparation du bilan visuel...')).toBeInTheDocument();
  });

  it('type "trophy" : jamais de section image, même en "loading"', () => {
    render(<ShareModal {...baseProps({ shareData: trophyShareData, summaryImageStatus: 'loading' })} />);
    expect(screen.queryByText('Préparation du bilan visuel...')).not.toBeInTheDocument();
  });

  it('image prête et incluse : affiche l\'aperçu, la croix retire l\'image (setIncludeSummaryImage(false))', () => {
    const setIncludeSummaryImage = vi.fn();
    render(
      <ShareModal
        {...baseProps({
          summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'),
          summaryImagePreviewUrl: 'blob:preview', setIncludeSummaryImage,
        })}
      />
    );
    expect(screen.getByAltText('Bilan visuel de la séance')).toHaveAttribute('src', 'blob:preview');

    fireEvent.click(screen.getByTitle('Retirer le bilan visuel'));
    expect(setIncludeSummaryImage).toHaveBeenCalledWith(false);
  });

  it('image prête mais includeSummaryImage=false : pas d\'aperçu affiché', () => {
    render(
      <ShareModal
        {...baseProps({
          summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'),
          summaryImagePreviewUrl: 'blob:preview', includeSummaryImage: false,
        })}
      />
    );
    expect(screen.queryByAltText('Bilan visuel de la séance')).not.toBeInTheDocument();
  });

  it('le lien de téléchargement du visuel n\'apparaît que si l\'image est prête et incluse', () => {
    const { rerender } = render(<ShareModal {...baseProps()} />);
    expect(screen.queryByText(/Télécharger le visuel/)).not.toBeInTheDocument();

    rerender(
      <ShareModal
        {...baseProps({ summaryImageStatus: 'ready', summaryImageFile: new File(['x'], 'bilan.png'), summaryImagePreviewUrl: 'blob:preview' })}
      />
    );
    const downloadLink = screen.getByText(/Télécharger le visuel/).closest('a');
    expect(downloadLink).toHaveAttribute('href', 'blob:preview');
    expect(downloadLink).toHaveAttribute('download', 'tempofit-bilan-de-seance.png');
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

  it('avec navigator.share ET image prête : le bouton natif appelle shareImageFile puis ferme la modale', async () => {
    navigator.share = vi.fn();
    const shareImageFile = vi.fn(() => Promise.resolve('shared'));
    const shareNative = vi.fn();
    const onClose = vi.fn();
    const file = new File(['x'], 'bilan.png');
    render(
      <ShareModal
        {...baseProps({
          shareImageFile, shareNative, onClose,
          summaryImageStatus: 'ready', summaryImageFile: file, summaryImagePreviewUrl: 'blob:preview',
        })}
      />
    );

    fireEvent.click(screen.getByTitle('Partager le visuel (Story, Instagram, WhatsApp...)'));

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
