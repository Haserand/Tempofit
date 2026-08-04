// @vitest-environment jsdom
//
// TargetModeInputs — extrait de GeneratorWizard.jsx (03/08, check-up dette
// technique) où ce bloc était dupliqué mot pour mot entre l'étape 2 et
// l'étape 3. Ce fichier teste le composant isolément, une fois pour toutes
// — les tests existants de GeneratorWizard.test.jsx continuent de
// l'exercer indirectement à travers les 2 étapes (même markup, aucun
// changement de comportement), pas besoin de les dupliquer ici.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TargetModeInputs from '../../src/components/views/TargetModeInputs.jsx';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  textHighlight: 'mock-highlight',
  textColorClass: 'mock-accent',
  textMuted: 'mock-muted',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
};

function baseProps(overrides = {}) {
  return {
    targetMode: 'time',
    theme: mockTheme,
    distanceVal: 5, setDistanceVal: vi.fn(),
    distanceUnit: 'km', setDistanceUnit: vi.fn(),
    paceMin: 5, setPaceMin: vi.fn(),
    paceSec: 30, setPaceSec: vi.fn(),
    hours: 0, setHours: vi.fn(),
    minutes: 45, setMinutes: vi.fn(),
    ...overrides,
  };
}

describe('TargetModeInputs — mode "time"', () => {
  it('affiche "Durée de la session" avec les champs Heures/Minutes, pas le bloc distance', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'time' })} />);
    expect(screen.getByText('Durée de la session')).toBeInTheDocument();
    expect(screen.queryByText('Objectif & Allure')).toBeNull();
  });

  it('modifier les heures appelle setHours avec la valeur bornée (syncClampedInput, min 0 / max 12)', () => {
    const setHours = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'time', setHours })} />);

    const hoursInput = container.querySelector('input[max="12"]');
    fireEvent.change(hoursInput, { target: { value: '20' } });

    // syncClampedInput doit avoir borné 20 à 12 (max déclaré) — et renvoie
    // une CHAÎNE, pas un nombre (voir sa docstring, numberInput.js : les
    // zéros de tête doivent pouvoir être effacés sans reformatage forcé).
    expect(setHours).toHaveBeenCalledWith('12');
  });

  it('le bouton flèche haut des minutes incrémente et boucle après 59', () => {
    const setMinutes = vi.fn();
    render(<TargetModeInputs {...baseProps({ targetMode: 'time', minutes: 59, setMinutes })} />);

    // 2 boutons fléchés (haut/bas) pour les minutes — le 1er est "haut".
    const upButton = screen.getAllByRole('button')[0];
    fireEvent.click(upButton);

    // Appelle un updater fonctionnel — on l'exécute avec l'état simulé (59)
    // pour vérifier le bouclage à 0, comme le fait GeneratorWizard.test.jsx
    // pour ce même mécanisme ailleurs dans le wizard.
    const updater = setMinutes.mock.calls[0][0];
    expect(updater(59)).toBe(0);
  });
});

describe('TargetModeInputs — mode "distance"', () => {
  it('affiche "Objectif & Allure" avec les champs distance/allure, pas le bloc durée', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance' })} />);
    expect(screen.getByText('Objectif & Allure')).toBeInTheDocument();
    expect(screen.queryByText('Durée de la session')).toBeNull();
  });

  it('modifier la distance appelle setDistanceVal avec la valeur brute (pas de bornage sur ce champ)', () => {
    const setDistanceVal = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'distance', setDistanceVal })} />);

    const distanceInput = container.querySelector('input[step="0.1"]');
    fireEvent.change(distanceInput, { target: { value: '10.5' } });

    expect(setDistanceVal).toHaveBeenCalledWith('10.5');
  });

  it('changer l\'unité (Km/Miles) appelle setDistanceUnit', () => {
    const setDistanceUnit = vi.fn();
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance', setDistanceUnit })} />);

    fireEvent.change(screen.getByDisplayValue('Km'), { target: { value: 'mi' } });

    expect(setDistanceUnit).toHaveBeenCalledWith('mi');
  });

  it('modifier l\'allure (minutes) appelle setPaceMin avec la valeur bornée (min 1 / max 15)', () => {
    const setPaceMin = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'distance', setPaceMin })} />);

    const paceMinInput = container.querySelector('input[max="15"]');
    fireEvent.change(paceMinInput, { target: { value: '0' } });

    // Borné au minimum déclaré (1), pas 0 — chaîne, pas nombre (voir le
    // test précédent pour le même point sur setHours).
    expect(setPaceMin).toHaveBeenCalledWith('1');
  });

  it('applique les classes du thème fourni (textHighlight sur le titre)', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance' })} />);
    expect(screen.getByText('Objectif & Allure')).toHaveClass('mock-highlight');
  });
});
