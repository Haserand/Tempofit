// @vitest-environment jsdom
//
// Premier fichier de test pour useCustomActivity.js (08/08, chantier
// "CustomActivityModal.jsx re-rend à chaque réglage du wizard"). Ciblé sur
// le comportement AJOUTÉ ce jour-là (mémoïsation du retour) — pas une
// couverture exhaustive de la logique métier (déjà couverte indirectement
// via CustomActivityModal.test.jsx/GeneratorWizard.test.jsx, qui mockent
// ce hook plutôt que de le faire tourner pour de vrai).

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomActivity } from '../../src/hooks/useCustomActivity.js';

describe('useCustomActivity — comportement métier', () => {
  it('handleOpenCustomActivityModal appelle setWorkoutType("Autre"), pré-remplit tempCustomActivity avec customActivity, et ouvre la modale', () => {
    const setWorkoutType = vi.fn();
    const { result } = renderHook(() => useCustomActivity(setWorkoutType));

    act(() => { result.current.setCustomActivity('Escalade'); });
    act(() => { result.current.handleOpenCustomActivityModal(); });

    expect(setWorkoutType).toHaveBeenCalledWith('Autre');
    expect(result.current.tempCustomActivity).toBe('Escalade');
    expect(result.current.isCustomActivityModalOpen).toBe(true);
  });
});

// NOUVEAU (08/08) — la vraie raison d'être de ce fichier : vérifier que le
// retour de ce hook reste RÉFÉRENTIELLEMENT STABLE d'un rendu à l'autre
// tant qu'aucun de ses propres champs n'a changé — condition nécessaire
// pour que CustomActivityContext.jsx (qui réexpose ce retour tel quel)
// puisse à son tour être mémoïsé utilement. Voir la docstring du hook pour
// le raisonnement complet.
describe('useCustomActivity — stabilité référentielle du retour (NOUVEAU, 08/08)', () => {
  it('renvoie le MÊME objet si le composant appelant re-rend sans que rien ici n\'ait changé', () => {
    const setWorkoutType = vi.fn();
    const { result, rerender } = renderHook(() => useCustomActivity(setWorkoutType));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).toBe(first);
  });

  it('handleOpenCustomActivityModal garde la MÊME référence tant que customActivity/setWorkoutType ne changent pas', () => {
    const setWorkoutType = vi.fn();
    const { result, rerender } = renderHook(() => useCustomActivity(setWorkoutType));

    const firstHandler = result.current.handleOpenCustomActivityModal;
    rerender();
    const secondHandler = result.current.handleOpenCustomActivityModal;

    expect(secondHandler).toBe(firstHandler);
  });

  it('renvoie un NOUVEL objet quand un champ change réellement (ex. customActivity)', () => {
    const setWorkoutType = vi.fn();
    const { result } = renderHook(() => useCustomActivity(setWorkoutType));

    const before = result.current;
    act(() => { result.current.setCustomActivity('Natation'); });
    const after = result.current;

    expect(after).not.toBe(before);
    expect(after.customActivity).toBe('Natation');
  });

  it('handleOpenCustomActivityModal change de référence quand customActivity change (dépendance réelle de son useCallback)', () => {
    const setWorkoutType = vi.fn();
    const { result } = renderHook(() => useCustomActivity(setWorkoutType));

    const before = result.current.handleOpenCustomActivityModal;
    act(() => { result.current.setCustomActivity('Natation'); });
    const after = result.current.handleOpenCustomActivityModal;

    expect(after).not.toBe(before);
  });
});
