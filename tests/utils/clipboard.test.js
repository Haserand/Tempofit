// @vitest-environment jsdom
//
// Premier fichier de test pour clipboard.js (nouveau, 08/08 — voir sa
// docstring pour le raisonnement complet : centralise la version ROBUSTE
// déjà éprouvée dans useShare.js, trouvée en implémentant le bouton
// "Copier le lien" du profil public, SettingsView.jsx). `document.execCommand`
// n'existe pas nativement dans jsdom — mocké explicitement à chaque test qui
// en a besoin, jamais laissé "undefined" silencieusement (sans ça, le repli
// lèverait une TypeError plutôt que de tester le vrai comportement voulu).

import { describe, it, expect, afterEach, vi } from 'vitest';
import { copyTextToClipboard } from '../../src/utils/clipboard.js';

afterEach(() => {
  vi.restoreAllMocks();
  delete navigator.clipboard;
});

describe('copyTextToClipboard', () => {
  it('utilise navigator.clipboard.writeText en priorité quand disponible, renvoie true en cas de succès', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    document.execCommand = vi.fn();

    const result = await copyTextToClipboard('texte à copier');

    expect(writeText).toHaveBeenCalledWith('texte à copier');
    expect(result).toBe(true);
    // execCommand ne doit JAMAIS être appelé si clipboard.writeText a
    // réussi — le repli n'a de sens que si la voie principale échoue.
    expect(document.execCommand).not.toHaveBeenCalled();
  });

  it('navigator.clipboard absent (contexte non sécurisé / navigateur ancien) : repli sur execCommand, renvoie true si succès', async () => {
    delete navigator.clipboard;
    document.execCommand = vi.fn(() => true);

    const result = await copyTextToClipboard('texte à copier');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  it('navigator.clipboard.writeText lève une exception (ex. permission refusée) : repli sur execCommand', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) } });
    document.execCommand = vi.fn(() => true);

    const result = await copyTextToClipboard('texte à copier');

    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(result).toBe(true);
  });

  // BUG CORRIGÉ AILLEURS (31/07, useShare.js) reproduit ici comme cas de
  // test explicite : `execCommand('copy')` peut renvoyer `false` SANS
  // lever d'exception dans la plupart des navigateurs — la valeur de
  // retour doit être vérifiée, jamais supposée vraie parce qu'aucune
  // exception n'a été levée.
  it('execCommand échoue silencieusement (renvoie false, ne lève rien) : la fonction renvoie bien false, pas true par erreur', async () => {
    delete navigator.clipboard;
    document.execCommand = vi.fn(() => false);

    const result = await copyTextToClipboard('texte à copier');

    expect(result).toBe(false);
  });

  it('nettoie bien le <textarea> temporaire créé pour le repli execCommand, qu\'il réussisse ou échoue', async () => {
    delete navigator.clipboard;
    document.execCommand = vi.fn(() => true);

    await copyTextToClipboard('texte à copier');

    expect(document.querySelectorAll('textarea').length).toBe(0);
  });
});
