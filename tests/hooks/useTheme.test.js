// Test dédié à useTheme.js — 0 test jusqu'ici (check-up du 13/08). Aucun
// `useState`/`useEffect` à l'intérieur (voir sa docstring : "aucun state
// interne, aucun effet de bord") — appelable comme une simple fonction,
// `renderHook` n'est pas nécessaire, `node` (l'environnement par défaut de
// ce projet) suffit.

import { describe, it, expect } from 'vitest';
import { useTheme } from '../../src/hooks/useTheme.js';

describe('useTheme', () => {
  it('renvoie toutes les clés attendues, dans les deux modes', () => {
    const expectedKeys = [
      'themeColor', 'bgMainApp', 'textMain', 'textColorClass', 'bgAccentClass', 'borderAccentClass',
      'cardBg', 'cardBorder', 'cardBorderStrong', 'inputBg', 'inputBorder', 'textMuted', 'textHighlight',
    ];
    expect(Object.keys(useTheme(false)).sort()).toEqual(expectedKeys.sort());
    expect(Object.keys(useTheme(true)).sort()).toEqual(expectedKeys.sort());
  });

  it('mode Sport (isNaughtyMode=false) : themeColor="red", fond app = bg-base (pas de dégradé)', () => {
    const theme = useTheme(false);
    expect(theme.themeColor).toBe('red');
    expect(theme.bgMainApp).toBe('bg-base');
  });

  it('Mode Intime (isNaughtyMode=true) : themeColor="rose", fond app = dégradé radial rose', () => {
    const theme = useTheme(true);
    expect(theme.themeColor).toBe('rose');
    expect(theme.bgMainApp).toContain('bg-radial-[at_top]');
    expect(theme.bgMainApp).toContain('rose');
  });

  it('textColorClass distingue bien les deux modes (rose vs red)', () => {
    expect(useTheme(false).textColorClass).toContain('red');
    expect(useTheme(true).textColorClass).toContain('rose');
  });

  it('les tokens sémantiques indépendants du mode (cardBg/cardBorder/textMuted/textHighlight...) sont identiques dans les deux modes', () => {
    // Ces tokens portent toute la logique clair/sombre/Intime via les
    // variables CSS (index.css), pas via un ternaire ici — voir la
    // docstring du hook.
    const sport = useTheme(false);
    const naughty = useTheme(true);
    expect(sport.cardBg).toBe(naughty.cardBg);
    expect(sport.cardBorder).toBe(naughty.cardBorder);
    expect(sport.cardBorderStrong).toBe(naughty.cardBorderStrong);
    expect(sport.textMuted).toBe(naughty.textMuted);
    expect(sport.textHighlight).toBe(naughty.textHighlight);
    expect(sport.bgAccentClass).toBe(naughty.bgAccentClass);
    expect(sport.borderAccentClass).toBe(naughty.borderAccentClass);
    expect(sport.inputBg).toBe(naughty.inputBg);
    expect(sport.inputBorder).toBe(naughty.inputBorder);
  });

  it('est un appel pur : deux appels avec le même argument renvoient un contenu strictement identique', () => {
    expect(useTheme(false)).toEqual(useTheme(false));
    expect(useTheme(true)).toEqual(useTheme(true));
  });
});
