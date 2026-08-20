// Premier fichier de test pour viewHeaderLayout.js — lacune de couverture
// identifiée lors du check-up global du 19/08. Comme bottomBarLayout.js,
// la valeur réelle de ce fichier n'est pas la constante en elle-même mais
// le fait qu'elle reste RÉELLEMENT utilisée aux endroits que sa docstring
// décrit — sinon la centralisation qu'il prétend offrir n'est qu'un vœu pieux.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VIEW_HEADER_ICON_SIZE,
  VIEW_HEADER_TOP_PADDING,
  VIEW_CONTENT_WRAPPER,
} from '../../src/layout/viewHeaderLayout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');
const VIEWS_DIR = path.join(SRC_DIR, 'components/views');

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), 'utf-8');
}

function viewFiles() {
  // Seuls les vrais fichiers de VUE (une page entière) se terminent par
  // "View.jsx" — le dossier components/views/ contient aussi des
  // sous-composants (PlaylistCard.jsx, TemplateCard.jsx,
  // AthleticProfilePanel.jsx, GeneratorWizard.jsx, TargetModeInputs.jsx...)
  // qui n'ont AUCUNE raison d'utiliser VIEW_CONTENT_WRAPPER eux-mêmes —
  // c'est leur vue parente qui l'applique une seule fois.
  return fs.readdirSync(VIEWS_DIR).filter(f => f.endsWith('View.jsx'));
}

describe('viewHeaderLayout — valeurs actuelles', () => {
  it('exporte un nombre (taille icône) et 2 classes Tailwind complètes', () => {
    expect(typeof VIEW_HEADER_ICON_SIZE).toBe('number');
    expect(typeof VIEW_HEADER_TOP_PADDING).toBe('string');
    expect(typeof VIEW_CONTENT_WRAPPER).toBe('string');
    // `VIEW_CONTENT_WRAPPER` doit toujours contenir les 2 classes ENSEMBLE
    // (voir la docstring — jamais l'une sans l'autre).
    expect(VIEW_CONTENT_WRAPPER).toContain('mx-auto');
  });
});

describe('viewHeaderLayout — synchronisation réelle avec les fichiers qui la consomment', () => {
  it('VIEW_CONTENT_WRAPPER est bien interpolé (${VIEW_CONTENT_WRAPPER}) dans TOUS les fichiers components/views/*View.jsx', () => {
    const files = viewFiles();
    expect(files.length).toBeGreaterThanOrEqual(8); // au moins les 8 vues d'origine (README, 6e itération)
    const missing = files.filter(f => !readSrc(`components/views/${f}`).includes('${VIEW_CONTENT_WRAPPER}'));
    expect(missing).toEqual([]);
  });

  it('App.jsx applique VIEW_HEADER_TOP_PADDING sur <main> (référence FIXE, voir la docstring)', () => {
    const content = readSrc('App.jsx');
    expect(content).toMatch(/VIEW_HEADER_TOP_PADDING.*from ['"].*viewHeaderLayout['"]/);
    expect(content).toContain('${VIEW_HEADER_TOP_PADDING}');
  });

  it('Sidebar.jsx applique aussi VIEW_HEADER_TOP_PADDING sur le bloc logo (même référence, pas une copie recodée)', () => {
    const content = readSrc('components/shared/Sidebar.jsx');
    expect(content).toMatch(/VIEW_HEADER_TOP_PADDING.*from ['"].*viewHeaderLayout['"]/);
    expect(content).toContain('${VIEW_HEADER_TOP_PADDING}');
  });

  it('VIEW_HEADER_ICON_SIZE est utilisé comme size={...} dans au moins 8 fichiers de vue', () => {
    const files = viewFiles();
    const usingIt = files.filter(f => readSrc(`components/views/${f}`).includes('size={VIEW_HEADER_ICON_SIZE}'));
    expect(usingIt.length).toBeGreaterThanOrEqual(8);
  });
});
