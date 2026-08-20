// Premier fichier de test pour sidebarLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. 9 constantes issues d'un
// réglage fin en plusieurs passes (voir la docstring du fichier) — ce test
// fige les valeurs ACTUELLES pour qu'un futur ajustement accidentel (plutôt
// que délibéré) se voie immédiatement, et vérifie qu'elles restent bien
// importées par Sidebar.jsx plutôt que recopiées en dur.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SIDEBAR_LINK_PADDING,
  SIDEBAR_LINK_GAP,
  SIDEBAR_SECTION_TITLE_MARGIN,
  SIDEBAR_LINK_PADDING_COMPACT,
  SIDEBAR_LINK_GAP_COMPACT,
  SIDEBAR_SECTION_TITLE_MARGIN_COMPACT,
  SIDEBAR_SEPARATOR_MARGIN,
  SIDEBAR_SCROLL_PADDING,
  SIDEBAR_SCROLL_PADDING_COMPACT,
  SIDEBAR_FOOTER_LINK_PADDING,
} from '../../src/layout/sidebarLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIDEBAR_JSX = fs.readFileSync(
  path.resolve(__dirname, '../../src/components/shared/Sidebar.jsx'),
  'utf-8',
);

describe('sidebarLayout — valeurs stabilisées actuelles (état final après 9 passes de réglage, voir la docstring)', () => {
  it('variantes normales', () => {
    expect(SIDEBAR_LINK_PADDING).toBe('px-3 py-2.5');
    expect(SIDEBAR_LINK_GAP).toBe('space-y-2');
    expect(SIDEBAR_SECTION_TITLE_MARGIN).toBe('mb-4');
  });

  it('variantes COMPACTES (Mode Intime uniquement)', () => {
    expect(SIDEBAR_LINK_PADDING_COMPACT).toBe('px-3 py-2');
    expect(SIDEBAR_LINK_GAP_COMPACT).toBe('space-y-1.5');
    expect(SIDEBAR_SECTION_TITLE_MARGIN_COMPACT).toBe('mb-2.5');
  });

  it('les variantes compactes restent bien MOINS espacées que les variantes normales (pas juste différentes)', () => {
    // Comparaison structurelle plutôt qu'une simple différence de chaînes —
    // vérifie que le sens du resserrement (compact < normal) reste
    // respecté, ce que 2 simples égalités de chaînes ne garantiraient pas.
    const pyNormal = parseFloat(SIDEBAR_LINK_PADDING.match(/py-([\d.]+)/)[1]);
    const pyCompact = parseFloat(SIDEBAR_LINK_PADDING_COMPACT.match(/py-([\d.]+)/)[1]);
    expect(pyCompact).toBeLessThan(pyNormal);
  });

  it('séparateur et paddings de conteneur', () => {
    expect(SIDEBAR_SEPARATOR_MARGIN).toBe('my-5');
    expect(SIDEBAR_SCROLL_PADDING).toBe('py-4 px-4');
    expect(SIDEBAR_SCROLL_PADDING_COMPACT).toBe('py-3 px-4');
    expect(SIDEBAR_FOOTER_LINK_PADDING).toBe('px-3 py-1.5');
  });
});

describe('sidebarLayout — importé par Sidebar.jsx (pas recopié en dur)', () => {
  it('les 9 constantes sont bien importées depuis ce module', () => {
    expect(SIDEBAR_JSX).toMatch(/from ['"].*sidebarLayout['"]/);
    for (const name of [
      'SIDEBAR_LINK_PADDING', 'SIDEBAR_LINK_GAP', 'SIDEBAR_SECTION_TITLE_MARGIN',
      'SIDEBAR_LINK_PADDING_COMPACT', 'SIDEBAR_LINK_GAP_COMPACT', 'SIDEBAR_SECTION_TITLE_MARGIN_COMPACT',
      'SIDEBAR_SEPARATOR_MARGIN', 'SIDEBAR_SCROLL_PADDING', 'SIDEBAR_SCROLL_PADDING_COMPACT',
      'SIDEBAR_FOOTER_LINK_PADDING',
    ]) {
      expect(SIDEBAR_JSX).toContain(name);
    }
  });
});
