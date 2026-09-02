// @vitest-environment jsdom
//
// Premier fichier de test pour TrophyShareCard.jsx (01/09, chantier "vrai
// partage Instagram Stories" — "et pour les trophées ?" puis "oui, crée un
// visuel pour les trophées"). Même modèle que GlobalStatsShareCard.test.jsx :
// composant purement présentationnel, une seule prop réellement variable
// (`trophy`), pas de thème/contexte à mocker.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TrophyShareCard from '../../src/components/shared/TrophyShareCard.jsx';

afterEach(() => {
  cleanup();
});

const sampleTrophy = { id: 't_first', name: 'Premier Pas', desc: "Complète ta toute 1ère session d'entraînement.", icon: '🥉' };

describe('TrophyShareCard', () => {
  it('sans trophy fourni : ne rend rien (garde `if (!trophy) return null`, cas "aucun partage encore lancé cette session")', () => {
    const { container } = render(<TrophyShareCard trophy={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le nom, la description et l\'icône du trophée fourni', () => {
    render(<TrophyShareCard trophy={sampleTrophy} />);
    expect(screen.getByText('Premier Pas')).toBeInTheDocument();
    expect(screen.getByText("Complète ta toute 1ère session d'entraînement.")).toBeInTheDocument();
    expect(screen.getByText('🥉')).toBeInTheDocument();
    expect(screen.getByText('Trophée débloqué')).toBeInTheDocument();
  });

  it('mode standard : marque "TempoFit" et un dégradé doré/ambre (pas rose)', () => {
    const { container } = render(<TrophyShareCard trophy={sampleTrophy} isNaughtyMode={false} />);
    expect(screen.getByText('TempoFit')).toBeInTheDocument();
    expect(screen.getByText('🏆')).toBeInTheDocument();
    const gradientLayer = container.querySelector('.absolute.inset-0');
    expect(gradientLayer.style.background).toContain('rgb(180, 83, 9)'); // #b45309, doré/ambre
  });

  it('Mode Intime : "TempoIntime", icône 🔥, dégradé rose sombre (pas le doré/ambre habituel) — même principe que GlobalStatsShareCard.jsx/SessionSummaryCard.jsx', () => {
    const { container } = render(<TrophyShareCard trophy={sampleTrophy} isNaughtyMode={true} />);
    expect(screen.getByText('TempoIntime')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.queryByText('TempoFit', { exact: true })).toBeNull();
    const gradientLayer = container.querySelector('.absolute.inset-0');
    expect(gradientLayer.style.background).toContain('rgb(159, 18, 57)'); // #9f1239, rose sombre
    expect(gradientLayer.style.background).not.toContain('rgb(180, 83, 9)');
  });

  it('change bien de trophée affiché quand la prop change (re-render, pas un état figé au montage)', () => {
    const { rerender } = render(<TrophyShareCard trophy={sampleTrophy} />);
    expect(screen.getByText('Premier Pas')).toBeInTheDocument();

    const otherTrophy = { id: 't_bolt', name: 'La Foudre', desc: 'Génère une session extrême.', icon: '⚡' };
    rerender(<TrophyShareCard trophy={otherTrophy} />);
    expect(screen.queryByText('Premier Pas')).toBeNull();
    expect(screen.getByText('La Foudre')).toBeInTheDocument();
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });
});
