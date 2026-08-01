// @vitest-environment jsdom
//
// Premier test de COMPOSANT React de ce projet (29/07) — jusqu'ici, les 163
// tests existants (voir tests/*.test.js) ne visaient que des fonctions
// pures, jamais un composant monté pour de vrai. Ce fichier ouvre un 2e
// registre, sur `ViewHeader.jsx` : le candidat idéal pour un premier essai
// — purement présentationnel (aucun contexte, aucun hook, aucun appel
// réseau/Supabase), tout dépend uniquement de ses props.
//
// Pourquoi CE composant précisément, maintenant : un retour direct portait
// sur une infobulle "Retour à l'accueil" apparaissant près du titre de page
// à l'écran — l'enquête a montré que le VRAI coupable vivait ailleurs
// (App.jsx, un en-tête flottant séparé), PAS dans ce composant, qui n'a
// jamais eu de `onClick` sur son titre. Le test "REGRESSION" ci-dessous
// grave cette garantie dans le marbre : si quelqu'un (moi y compris, dans
// une session future) réintroduit par erreur un `onClick`/`<button>`/`<a>`
// autour du titre ici, ce test échoue immédiatement au lieu d'attendre
// qu'une capture d'écran remonte le problème des semaines plus tard.
//
// `@vitest-environment jsdom` en pragma de TÊTE DE FICHIER (1re ligne,
// AVANT même les imports) : override Vitest PAR FICHIER, sans toucher à
// `environment: 'node'` du reste de la suite (voir vite.config.js) — les
// 163 tests existants restent inchangés, rapides, sans dépendance à jsdom.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ViewHeader from '../../src/components/shared/ViewHeader.jsx';

// `cleanup()` après CHAQUE test : démonte le DOM jsdom monté par le test
// précédent — sans ça, 2 tests qui cherchent le même texte ("Titre",
// "Sous-titre"...) se marcheraient dessus, `getByText` échouerait avec
// "trouvé plusieurs fois" au lieu de tester ce qu'on veut vraiment.
afterEach(() => {
  cleanup();
});

// Thème minimal, volontairement de simples chaînes de classes Tailwind
// arbitraires (pas les vraies valeurs de useTheme.js) — ce composant ne
// FAIT rien de spécial avec ces valeurs à part les interpoler telles
// quelles dans un `className`, donc les tester avec de fausses valeurs
// bien distinctes ("mock-border" plutôt que "border-divider") confirme
// sans ambiguïté qu'elles sont bien PASSÉES À TRAVERS, sans dépendre de la
// vraie palette du projet (qui, elle, a son propre chantier de tests à
// part entière si un jour souhaité).
const mockTheme = {
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
};

describe('ViewHeader', () => {
  it('affiche le titre et le sous-titre fournis en props', () => {
    render(
      <ViewHeader
        theme={mockTheme}
        icon={<span>⚡</span>}
        title="Sculpte ta séance"
        subtitle="Laisse l'algorithme générer la bande-son ultime pour tes objectifs."
      />
    );
    expect(screen.getByText('Sculpte ta séance')).toBeInTheDocument();
    expect(
      screen.getByText("Laisse l'algorithme générer la bande-son ultime pour tes objectifs.")
    ).toBeInTheDocument();
  });

  it("affiche l'icône construite par l'appelant (voir docstring : élément déjà construit, pas juste un composant)", () => {
    render(
      <ViewHeader
        theme={mockTheme}
        icon={<span data-testid="icone-appelant">⚡</span>}
        title="Titre"
        subtitle="Sous-titre"
      />
    );
    expect(screen.getByTestId('icone-appelant')).toBeInTheDocument();
  });

  it('REGRESSION (29/07) — le titre H1 ne doit JAMAIS être un élément cliquable', () => {
    render(
      <ViewHeader
        theme={mockTheme}
        icon={<span>⚡</span>}
        title="Sculpte ta séance"
        subtitle="Sous-titre"
      />
    );
    const heading = screen.getByRole('heading', { level: 1 });
    // Ni bouton, ni lien ancêtre — le titre doit rester un <h1> nu.
    expect(heading.closest('button')).toBeNull();
    expect(heading.closest('a')).toBeNull();
    expect(heading).not.toHaveAttribute('onclick');
    // Aucun bouton nulle part dans tout l'en-tête tant que `right` est absent
    // (voir test dédié plus bas pour le cas où `right` EST fourni).
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('rend le contenu de la prop "right" quand elle est fournie', () => {
    render(
      <ViewHeader
        theme={mockTheme}
        icon={<span>⚡</span>}
        title="Titre"
        subtitle="Sous-titre"
        right={<button>Partager mon bilan</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Partager mon bilan' })).toBeInTheDocument();
  });

  it('n\'affiche aucun bouton superflu quand "right" est absent (valeur par défaut null)', () => {
    render(<ViewHeader theme={mockTheme} icon={<span>⚡</span>} title="Titre" subtitle="Sous-titre" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('applique `dark:text-white` au sous-titre UNIQUEMENT en Mode Intime (isNaughtyMode=true)', () => {
    const { rerender } = render(
      <ViewHeader
        theme={mockTheme}
        icon={<span>⚡</span>}
        title="Titre"
        subtitle="Mon sous-titre"
        isNaughtyMode={true}
      />
    );
    expect(screen.getByText('Mon sous-titre')).toHaveClass('dark:text-white');

    rerender(
      <ViewHeader
        theme={mockTheme}
        icon={<span>⚡</span>}
        title="Titre"
        subtitle="Mon sous-titre"
        isNaughtyMode={false}
      />
    );
    expect(screen.getByText('Mon sous-titre')).not.toHaveClass('dark:text-white');
  });

  it('applique les classes du thème fourni (textHighlight sur le titre, textMuted sur le sous-titre)', () => {
    render(<ViewHeader theme={mockTheme} icon={<span>⚡</span>} title="Titre" subtitle="Sous-titre" />);
    expect(screen.getByText('Titre').closest('h1')).toHaveClass('mock-highlight');
    expect(screen.getByText('Sous-titre')).toHaveClass('mock-muted');
  });
});
