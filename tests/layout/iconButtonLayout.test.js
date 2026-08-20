// Premier fichier de test pour iconButtonLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. Constante pure unique : le
// test vérifie sa valeur ET qu'elle reste réellement importée à plusieurs
// endroits distincts (Sidebar/modales/App.jsx) — sans ça, un futur retrait
// accidentel de l'export ne serait détecté qu'au build Vercel.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ICON_BUTTON_ROUNDING } from '../../src/layout/iconButtonLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');

function walk(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(walk(full));
    else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

describe('iconButtonLayout — valeur actuelle et usage réel', () => {
  it('exporte une classe Tailwind complète', () => {
    expect(ICON_BUTTON_ROUNDING).toBe('rounded-full');
  });

  it('reste importé dans plusieurs fichiers distincts (pas du code mort)', () => {
    const files = walk(SRC_DIR).filter(f => !f.endsWith('iconButtonLayout.js'));
    const consumers = files.filter(f => fs.readFileSync(f, 'utf-8').includes('ICON_BUTTON_ROUNDING'));
    expect(consumers.length).toBeGreaterThanOrEqual(5);
  });
});
