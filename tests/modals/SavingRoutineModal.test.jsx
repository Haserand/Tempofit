// @vitest-environment jsdom
//
// Palier 2 (29/07, 2/10) — SavingRoutineModal, création d'une routine à
// partir des réglages actuels du wizard.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SavingRoutineModal from '../../src/components/modals/SavingRoutineModal.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

const baseProps = {
  theme: mockTheme,
  isNaughtyMode: false,
  isSavingRoutineModalOpen: true,
  onClose: () => {},
  newRoutineName: '',
  setNewRoutineName: () => {},
  newRoutineIcon: '🏃‍♂️',
  setNewRoutineIcon: () => {},
  newRoutineFreq: 'Manuel',
  setNewRoutineFreq: () => {},
  handleSaveRoutine: () => {},
};

describe('SavingRoutineModal', () => {
  it('ne rend rien quand isSavingRoutineModalOpen=false', () => {
    const { container } = render(
      <SavingRoutineModal {...baseProps} isSavingRoutineModalOpen={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le champ nom, le sélecteur de fréquence et le bouton d\'enregistrement quand ouverte', () => {
    render(<SavingRoutineModal {...baseProps} />);
    expect(screen.getByPlaceholderText('Nom (Ex: 5km Rapide)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer la routine' })).toBeInTheDocument();
  });

  it('taper dans le champ nom appelle setNewRoutineName avec la nouvelle valeur', () => {
    const setNewRoutineName = vi.fn();
    render(<SavingRoutineModal {...baseProps} setNewRoutineName={setNewRoutineName} />);

    fireEvent.change(screen.getByPlaceholderText('Nom (Ex: 5km Rapide)'), {
      target: { value: '5km Rapide' },
    });

    expect(setNewRoutineName).toHaveBeenCalledWith('5km Rapide');
  });

  it('appuyer sur Entrée dans le champ nom appelle handleSaveRoutine', () => {
    const handleSaveRoutine = vi.fn();
    render(<SavingRoutineModal {...baseProps} handleSaveRoutine={handleSaveRoutine} />);

    fireEvent.keyDown(screen.getByPlaceholderText('Nom (Ex: 5km Rapide)'), { key: 'Enter' });

    expect(handleSaveRoutine).toHaveBeenCalledTimes(1);
  });

  it('cliquer sur une icône appelle setNewRoutineIcon avec cette icône', () => {
    const setNewRoutineIcon = vi.fn();
    render(<SavingRoutineModal {...baseProps} setNewRoutineIcon={setNewRoutineIcon} />);

    fireEvent.click(screen.getByText('🔥'));

    expect(setNewRoutineIcon).toHaveBeenCalledWith('🔥');
  });

  it('le clic sur le bouton de fermeture (X) appelle onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<SavingRoutineModal {...baseProps} onClose={onClose} />);
    // Le bouton X n'a ni texte ni title — ciblé via son unique <button> hors
    // de la liste d'icônes et du bouton "Enregistrer".
    const closeButton = container.querySelector('button.rounded-full');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('le clic sur "Enregistrer la routine" appelle handleSaveRoutine', () => {
    const handleSaveRoutine = vi.fn();
    render(<SavingRoutineModal {...baseProps} handleSaveRoutine={handleSaveRoutine} />);

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la routine' }));

    expect(handleSaveRoutine).toHaveBeenCalledTimes(1);
  });

  it('affiche 8 icônes en mode normal, 14 en Mode Intime (AVAILABLE_ICONS.slice)', () => {
    // ⚠️ BUG DE TEST CORRIGÉ (déploiement du 29/07) : `.justify-between` est
    // AMBIGU dans ce composant — 3 éléments différents portent cette classe
    // (l'en-tête titre/fermer, CETTE grille d'icônes, et le label de
    // fréquence) — `querySelector` renvoyait le 1er (l'en-tête, 1 seul
    // bouton), pas la grille. `.bg-gray-50` est unique à la grille d'icônes
    // dans ce fichier (vérifié), sélecteur sans ambiguïté.
    const { container, rerender } = render(<SavingRoutineModal {...baseProps} isNaughtyMode={false} />);
    const iconGrid = container.querySelector('.bg-gray-50');
    expect(iconGrid.querySelectorAll('button')).toHaveLength(8);

    rerender(<SavingRoutineModal {...baseProps} isNaughtyMode={true} />);
    const iconGridNaughty = container.querySelector('.bg-gray-50');
    expect(iconGridNaughty.querySelectorAll('button')).toHaveLength(14);
  });
});
