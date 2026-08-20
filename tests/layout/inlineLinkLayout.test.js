// Premier fichier de test pour inlineLinkLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INLINE_NAV_LINK_CLASS } from '../../src/layout/inlineLinkLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf-8');
}

describe('inlineLinkLayout — valeur actuelle', () => {
  it('exporte "font-bold underline" — soulignement PERMANENT, jamais hover:underline (voir README)', () => {
    expect(INLINE_NAV_LINK_CLASS).toBe('font-bold underline');
    expect(INLINE_NAV_LINK_CLASS).not.toContain('hover:');
  });
});

describe('inlineLinkLayout — usage réel dans les fichiers documentés', () => {
  it.each([
    'components/views/StatsView.jsx',
    'components/views/GeneratorWizard.jsx',
    'components/views/FavoritesView.jsx',
  ])('%s importe et utilise bien INLINE_NAV_LINK_CLASS', (relPath) => {
    const content = readSrc(relPath);
    expect(content).toMatch(/INLINE_NAV_LINK_CLASS.*from ['"].*inlineLinkLayout['"]/);
    expect(content).toContain('${INLINE_NAV_LINK_CLASS}');
  });
});
