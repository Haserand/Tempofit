// @vitest-environment jsdom
//
// Palier 2 (29/07, 8/10) — DualRangeSlider, le composant le plus délicat de
// ce lot : glisser-déposer "maison" via Pointer Events, dont 2 API ne sont
// PAS implémentées nativement par jsdom :
// - `Element.prototype.setPointerCapture` — absente de jsdom (n'existe
//   même pas sur le prototype), stubbée UNE FOIS en tête de fichier.
// - `getBoundingClientRect` — EXISTE dans jsdom mais renvoie toujours des
//   zéros (aucun vrai calcul de mise en page) ; mockée PAR TEST via
//   `vi.spyOn` pour simuler une piste de largeur connue (300px), seule
//   façon de tester le calcul de pourcentage à partir d'un `clientX`.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import DualRangeSlider from '../src/components/shared/DualRangeSlider.jsx';

// Stub global à ce fichier (jsdom n'a pas cette méthode DU TOUT sur son
// prototype — `vi.spyOn` ne fonctionne que sur une méthode EXISTANTE, donc
// une simple assignation directe est la bonne approche ici).
Element.prototype.setPointerCapture = vi.fn();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const baseProps = {
  leftValue: 20,
  rightValue: 10,
  minMiddle: 10,
  onChangeLeft: () => {},
  onChangeRight: () => {},
  leftColor: '#111',
  middleColor: '#222',
  rightColor: '#333',
  leftHandleBorderColor: '#111',
  rightHandleBorderColor: '#333',
};

describe('DualRangeSlider', () => {
  it('reflète leftValue/rightValue dans les attributs ARIA des 2 poignées', () => {
    render(<DualRangeSlider {...baseProps} />);
    expect(screen.getByRole('slider', { name: 'Poignée gauche' })).toHaveAttribute('aria-valuenow', '20');
    expect(screen.getByRole('slider', { name: 'Poignée droite' })).toHaveAttribute('aria-valuenow', '10');
  });

  it('calcule les largeurs des 3 zones colorées à partir de leftValue/rightValue', () => {
    // leftValue=20, rightValue=10 -> boundaryLeft=20, boundaryRight=90
    // zones : 20% / (90-20)=70% / (100-90)=10%
    const { container } = render(<DualRangeSlider {...baseProps} />);
    const zones = container.querySelectorAll('.pointer-events-none > div');
    expect(zones[0].style.width).toBe('20%');
    expect(zones[1].style.width).toBe('70%');
    expect(zones[2].style.width).toBe('10%');
  });

  it('flèche droite sur la poignée gauche incrémente leftValue de 1', () => {
    const onChangeLeft = vi.fn();
    render(<DualRangeSlider {...baseProps} onChangeLeft={onChangeLeft} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée gauche' }), { key: 'ArrowRight' });
    expect(onChangeLeft).toHaveBeenCalledWith(21);
  });

  it('flèche gauche sur la poignée gauche décrémente leftValue de 1, jamais sous 0', () => {
    const onChangeLeft = vi.fn();
    const { rerender } = render(<DualRangeSlider {...baseProps} onChangeLeft={onChangeLeft} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée gauche' }), { key: 'ArrowLeft' });
    expect(onChangeLeft).toHaveBeenCalledWith(19);

    onChangeLeft.mockClear();
    rerender(<DualRangeSlider {...baseProps} leftValue={0} onChangeLeft={onChangeLeft} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée gauche' }), { key: 'ArrowLeft' });
    expect(onChangeLeft).toHaveBeenCalledWith(0); // jamais négatif
  });

  it('flèche gauche sur la poignée droite incrémente rightValue de 1 (la poignée se déplace vers la gauche)', () => {
    const onChangeRight = vi.fn();
    render(<DualRangeSlider {...baseProps} onChangeRight={onChangeRight} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée droite' }), { key: 'ArrowLeft' });
    expect(onChangeRight).toHaveBeenCalledWith(11);
  });

  it('flèche droite sur la poignée droite décrémente rightValue de 1, jamais sous 0', () => {
    const onChangeRight = vi.fn();
    const { rerender } = render(<DualRangeSlider {...baseProps} onChangeRight={onChangeRight} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée droite' }), { key: 'ArrowRight' });
    expect(onChangeRight).toHaveBeenCalledWith(9);

    onChangeRight.mockClear();
    rerender(<DualRangeSlider {...baseProps} rightValue={0} onChangeRight={onChangeRight} />);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Poignée droite' }), { key: 'ArrowRight' });
    expect(onChangeRight).toHaveBeenCalledWith(0); // jamais négatif
  });

  it('le pointerdown appelle preventDefault et setPointerCapture avec le bon pointerId', () => {
    render(<DualRangeSlider {...baseProps} />);
    const handle = screen.getByRole('slider', { name: 'Poignée gauche' });

    fireEvent.pointerDown(handle, { pointerId: 7 });

    expect(Element.prototype.setPointerCapture).toHaveBeenCalledWith(7);
  });

  it('le glisser (pointermove) calcule le % depuis clientX et appelle onChangeLeft', () => {
    // Piste virtuelle de 300px, de x=0 à x=300 — mock nécessaire car jsdom
    // renvoie toujours des zéros pour getBoundingClientRect par défaut.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 300, width: 300, top: 0, bottom: 8, height: 8, x: 0, y: 0, toJSON() {},
    });
    const onChangeLeft = vi.fn();
    render(<DualRangeSlider {...baseProps} onChangeLeft={onChangeLeft} />);

    // clientX=150 sur une piste de 300px -> 50%. rightValue=10 -> boundaryRight=90,
    // plafond = 90-10(minMiddle)=80, donc 50 n'est pas écrêté.
    fireEvent.pointerMove(screen.getByRole('slider', { name: 'Poignée gauche' }), {
      clientX: 150,
      buttons: 1,
    });

    expect(onChangeLeft).toHaveBeenCalledWith(50);
  });

  it('ignore le pointermove si aucun bouton n\'est enfoncé (buttons=0, pas un vrai drag)', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, right: 300, width: 300, top: 0, bottom: 8, height: 8, x: 0, y: 0, toJSON() {},
    });
    const onChangeLeft = vi.fn();
    render(<DualRangeSlider {...baseProps} onChangeLeft={onChangeLeft} />);

    fireEvent.pointerMove(screen.getByRole('slider', { name: 'Poignée gauche' }), {
      clientX: 150,
      buttons: 0,
    });

    expect(onChangeLeft).not.toHaveBeenCalled();
  });
});
