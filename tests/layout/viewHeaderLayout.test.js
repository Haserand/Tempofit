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
  // Seuls les vrais fichiers de VUE (une page entière, avec son propre
  // <ViewHeader/>) se terminent par "View.jsx" — le dossier
  // components/views/ contient aussi des sous-composants (PlaylistCard.jsx,
  // TemplateCard.jsx, AthleticProfilePanel.jsx, GeneratorWizard.jsx,
  // TargetModeInputs.jsx...) qui n'ont AUCUNE raison d'utiliser
  // VIEW_CONTENT_WRAPPER eux-mêmes — c'est leur vue parente qui l'applique
  // une seule fois.
  //
  // ⚠️ EXCLUSION AJOUTÉE (20/08, rattrapée par le build Vercel réel — ce
  // test a fait exactement son travail) — `RoutinesView.jsx` A GARDÉ son
  // nom en "*View.jsx" (continuité historique : extrait de App.jsx le
  // 25/07, `view === 'routines'`) mais n'est PLUS une vraie vue de premier
  // niveau depuis la fusion "Mes Routines" en onglet de "Mes Playlists" (voir
  // PlaylistsView.jsx) : elle ne rend plus qu'un CORPS (grille), sans
  // `<ViewHeader/>` ni `VIEW_CONTENT_WRAPPER` propres — ce sont
  // `PlaylistsView.jsx` qui les possède désormais pour les 2 onglets. La
  // filtrer ici plutôt que la renommer (`RoutinesBody.jsx` aurait été plus
  // exact, mais un renommage de fichier est un changement plus large,
  // pas fait dans ce chantier).
  return fs.readdirSync(VIEWS_DIR).filter(f => f.endsWith('View.jsx') && f !== 'RoutinesView.jsx');
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
    // 9 (pas 8) depuis le 20/08 — `PlaylistsView.jsx` compte maintenant
    // pour "Mes Playlists" ET "Mes Routines" (fusion en onglet), et
    // `RoutinesView.jsx` est exclue par `viewFiles()` (voir sa docstring).
    expect(files.length).toBeGreaterThanOrEqual(9);
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

  it('VIEW_HEADER_ICON_SIZE est utilisé comme size={...} dans au moins 7 fichiers de vue', () => {
    // 7 (pas 8) depuis le 20/08 — voir la docstring de viewFiles() plus
    // haut. `ProfileView.jsx`/`PlaylistDetailView.jsx` n'ont jamais utilisé
    // ce pattern (en-tête sur mesure, déjà le cas avant ce chantier) —
    // seule la perte de `RoutinesView.jsx` change le compte ici (8 → 7).
    const files = viewFiles();
    const usingIt = files.filter(f => readSrc(`components/views/${f}`).includes('size={VIEW_HEADER_ICON_SIZE}'));
    expect(usingIt.length).toBeGreaterThanOrEqual(7);
  });
});
