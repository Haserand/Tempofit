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

  it('applique les classes du thème fourni (textHighlight sur le label, pas juste le texte)', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance' })} />);
    // `textHighlight` est posée sur le <label> englobant, pas sur le <span>
    // qui porte le texte visible — `.closest('label')` cible le bon élément
    // (même piège que documenté ailleurs dans ce projet : le nom accessible
    // d'un texte ne dit rien de QUEL élément DOM porte réellement la classe).
    expect(screen.getByText('Objectif & Allure').closest('label')).toHaveClass('mock-highlight');
  });
});

// 04/08, retour direct (capture d'écran EditRoutineModal.jsx) : "je ne
// trouve pas ça normal de pouvoir générer une routine avec une valeur de
// 0 km" — voir targetValidation.js pour le raisonnement complet.
describe('TargetModeInputs — indice de validation (BUG CORRIGÉ, cible à 0)', () => {
  it('affiche un avertissement quand distanceVal vaut 0', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance', distanceVal: 0 })} />);
    expect(screen.getByText('Renseigne une distance supérieure à 0.')).toBeInTheDocument();
  });

  it('n\'affiche rien quand distanceVal est positif', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'distance', distanceVal: 5 })} />);
    expect(screen.queryByText('Renseigne une distance supérieure à 0.')).toBeNull();
  });

  it('affiche un avertissement quand heures ET minutes valent 0', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'time', hours: 0, minutes: 0 })} />);
    expect(screen.getByText('Renseigne une durée supérieure à 0.')).toBeInTheDocument();
  });

  it('n\'affiche rien dès que minutes > 0, même avec heures à 0', () => {
    render(<TargetModeInputs {...baseProps({ targetMode: 'time', hours: 0, minutes: 45 })} />);
    expect(screen.queryByText('Renseigne une durée supérieure à 0.')).toBeNull();
  });
});

// 04/08, 3e retour direct sur ce même chantier (capture annotée) : "je
// pensais qu'on avait dit qu'on ne pouvait pas sélectionner moins que
// 0,1 ?" — voir snapDistanceOnBlur (targetValidation.js) pour le
// raisonnement complet (pourquoi `onBlur`, pas `onChange`).
describe('TargetModeInputs — correction automatique au blur (BUG CORRIGÉ)', () => {
  it('quitter le champ distance à 0 le remonte à 0.1', () => {
    const setDistanceVal = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'distance', distanceVal: 0, setDistanceVal })} />);

    const distanceInput = container.querySelector('input[step="0.1"]');
    fireEvent.blur(distanceInput, { target: { value: '0' } });

    expect(setDistanceVal).toHaveBeenCalledWith('0.1');
  });

  it('quitter le champ distance avec une valeur déjà valide ne le modifie pas', () => {
    const setDistanceVal = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'distance', distanceVal: 5, setDistanceVal })} />);

    const distanceInput = container.querySelector('input[step="0.1"]');
    fireEvent.blur(distanceInput, { target: { value: '5' } });

    expect(setDistanceVal).toHaveBeenCalledWith('5');
  });

  it('la frappe elle-même (onChange) n\'est jamais corrigée, seul le blur l\'est', () => {
    const setDistanceVal = vi.fn();
    const { container } = render(<TargetModeInputs {...baseProps({ targetMode: 'distance', distanceVal: 5, setDistanceVal })} />);

    const distanceInput = container.querySelector('input[step="0.1"]');
    fireEvent.change(distanceInput, { target: { value: '0' } });

    // onChange doit transmettre "0" tel quel, sans correction — la
    // correction n'intervient QUE dans le handler onBlur, testé séparément
    // ci-dessus.
    expect(setDistanceVal).toHaveBeenCalledWith('0');
  });
});
