// @vitest-environment jsdom
//
// Vague 2, Chantier 1 — UI publique des routines (02/08). Même convention
// de test qu'ImportSharedPlaylistModal.test.jsx (schéma quasi identique :
// aperçu + un seul bouton d'action).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PublicRoutinePreviewModal from '../../src/components/modals/PublicRoutinePreviewModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textColorClass: 'mock-accent-text',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

// `routine` est la LIGNE brute de la table `routines` (voir
// supabase-schema.sql) — `content` porte la config complète, comme reçue
// par ProfileView.jsx.
const mockRoutine = {
  id: 'routine-42',
  user_id: 'user-abc',
  is_public: true,
  content: {
    name: 'Mon 10km Rapide',
    coverIcon: '🏃‍♀️',
    workoutType: 'Course à pied',
    customActivity: '',
    targetMode: 'distance',
    distanceVal: 10,
    distanceUnit: 'km',
    bpm: 170,
    isIntervalMode: false,
    isCrescendoMode: false,
    selectedGenres: ['Métal', 'Rock'],
  },
};

describe('PublicRoutinePreviewModal', () => {
  it('ne rend rien quand isOpen=false', () => {
    const { container } = render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={false} onClose={() => {}} routine={mockRoutine} onClone={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('ne rend rien quand routine est null (même si isOpen=true)', () => {
    const { container } = render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={null} onClone={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le nom, le type de séance, la distance cible et le BPM', () => {
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={mockRoutine} onClone={() => {}} />
    );
    expect(screen.getByText('Mon 10km Rapide')).toBeInTheDocument();
    expect(screen.getAllByText('Course à pied').length).toBeGreaterThan(0);
    expect(screen.getByText('10 km')).toBeInTheDocument();
    expect(screen.getByText('170 BPM')).toBeInTheDocument();
  });

  it('affiche "Fractionné"/"Crescendo" au lieu d\'un BPM unique pour une routine en mode intervalles', () => {
    const intervalRoutine = {
      ...mockRoutine,
      content: { ...mockRoutine.content, isIntervalMode: true, isCrescendoMode: false, segments: [{}, {}, {}] },
    };
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={intervalRoutine} onClone={() => {}} />
    );
    expect(screen.getByText('3 phases')).toBeInTheDocument();
    expect(screen.queryByText('170 BPM')).toBeNull();
  });

  it('le clic sur "Cloner dans mes Routines" appelle onClone avec la routine complète', () => {
    const onClone = vi.fn();
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={mockRoutine} onClone={onClone} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Cloner dans mes Routines/ }));
    expect(onClone).toHaveBeenCalledTimes(1);
    expect(onClone).toHaveBeenCalledWith(mockRoutine);
  });

  it('le clic sur "Fermer" appelle onClose', () => {
    const onClose = vi.fn();
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={onClose} routine={mockRoutine} onClone={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Vague 2, Chantier 3 — "description texte libre sur une playlist/routine
  // publique" (02/08).
  it('affiche la description complète quand elle existe', () => {
    const routineWithDescription = { ...mockRoutine, content: { ...mockRoutine.content, description: 'Idéale le dimanche matin, avant le café.' } };
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={routineWithDescription} onClone={() => {}} />
    );
    expect(screen.getByText('Idéale le dimanche matin, avant le café.')).toBeInTheDocument();
  });

  it('n\'affiche rien de particulier quand il n\'y a pas de description', () => {
    render(
      <PublicRoutinePreviewModal theme={mockTheme} isOpen={true} onClose={() => {}} routine={mockRoutine} onClone={() => {}} />
    );
    expect(screen.getByText('Mon 10km Rapide')).toBeInTheDocument();
  });
});
