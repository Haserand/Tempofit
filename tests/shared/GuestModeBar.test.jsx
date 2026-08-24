// @vitest-environment jsdom
//
// 2e test de composant (29/07, suite du chantier "premier test de
// composant React"). GuestModeBar est un bon candidat suivant : props
// simples (`theme`, `isVisible`, `openModal`), un vrai rendu conditionnel
// (`if (!isVisible) return null`), et un bouton interactif réel — premier
// test de ce projet à simuler un CLIC (via `fireEvent`, déjà fourni par
// `@testing-library/react`, aucune dépendance supplémentaire nécessaire).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GuestModeBar from '../../src/components/shared/GuestModeBar.jsx';

afterEach(() => {
  cleanup();
});

// Mêmes valeurs de mock arbitraires que ViewHeader.test.jsx (voir ce
// fichier pour le raisonnement) — confirme que le composant PASSE bien ces
// classes à travers, sans dépendre de la vraie palette du projet.
const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorderStrong: 'mock-border-strong',
  textMuted: 'mock-muted',
  textColorClass: 'mock-accent',
};

describe('GuestModeBar', () => {
  it('ne rend RIEN quand isVisible=false (retourne null)', () => {
    const { container } = render(
      <GuestModeBar theme={mockTheme} isVisible={false} openModal={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche le message et le bouton "Se connecter" quand isVisible=true', () => {
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    expect(
      screen.getByText('Données sauvegardées uniquement sur cet appareil.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
  });

  it('appelle openModal(\'AUTH\') exactement 1 fois au clic sur "Se connecter"', () => {
    // `vi.fn()` — première utilisation d'un mock de fonction dans ce
    // projet (aucun des 163 tests existants n'en avait besoin, voir
    // vite.config.js) : permet d'observer un appel SANS déclencher le
    // vrai comportement d'ouverture de modale (hors de portée de ce test,
    // qui ne vérifie que "GuestModeBar appelle-t-il bien la bonne
    // fonction avec le bon argument", pas ce que fait `openModal` ensuite.
    const openModal = vi.fn();
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={openModal} />);

    fireEvent.click(screen.getByRole('button', { name: /Se connecter/ }));

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(openModal).toHaveBeenCalledWith('AUTH');
  });

  it('applique les classes du thème fourni (textMuted sur le message, textColorClass sur le bouton)', () => {
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    expect(
      screen.getByText('Données sauvegardées uniquement sur cet appareil.')
    ).toHaveClass('mock-muted');
    expect(screen.getByRole('button', { name: /Se connecter/ })).toHaveClass('mock-accent');
  });

  // ⚠️ Espaceur invisible ajouté (22/08, retour direct, capture d'écran :
  // "pourquoi les 2 ne sont pas parfaitement centrés ?") — sans lui,
  // `justify-center` centre le groupe entier (bouton "Se connecter" +
  // croix), pas le texte "Se connecter" lui-même : la croix, plus étroite,
  // ne compensait pas la largeur du bouton, donc "Se connecter" dérivait
  // visuellement vers la gauche du centre réel de la barre. Vérifie que
  // cet espaceur existe, qu'il ne casse pas le rendu du reste (bouton
  // "Se connecter"/croix toujours présents et cliquables — déjà couvert
  // par les autres tests de ce fichier, non dupliqué ici) et qu'il est
  // bien exclu de l'arborescence d'accessibilité (aria-hidden — purement
  // visuel, rien à annoncer aux lecteurs d'écran).
  it('espaceur invisible présent (équilibre visuel avec la croix), exclu de l\'accessibilité', () => {
    const { container } = render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    const spacer = container.querySelector('span[aria-hidden="true"]');
    expect(spacer).toBeInTheDocument();
    expect(spacer.querySelector('svg')).toHaveClass('invisible');
  });

  // ⚠️ NOUVEAU (22/08, MÊME JOUR, encore un retour direct — "je n'ai pas
  // l'impression que le lecteur audio soit centré sur la guest barre") :
  // vérifie que le contenu centre désormais sur le MÊME repère
  // (`max-w-5xl mx-auto`) que MiniPlayerBar.jsx, pas sur la pleine largeur
  // de la barre — sans ce conteneur partagé, les deux barres centrent sur
  // 2 largeurs différentes dès que l'écran dépasse 1024px (5xl), un
  // désalignement invisible en dessous de ce seuil donc facile à
  // manquer sans test dédié.
  it('le contenu centre sur max-w-5xl mx-auto, même repère que MiniPlayerBar.jsx', () => {
    const { container } = render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    const centeringWrapper = container.querySelector('.max-w-5xl.mx-auto');
    expect(centeringWrapper).toBeInTheDocument();
    // Le bouton "Se connecter" doit être un DESCENDANT de ce conteneur,
    // pas un frère à côté — sinon la contrainte de largeur ne s'applique
    // à rien de visible.
    const connectButton = screen.getByRole('button', { name: /Se connecter/ });
    expect(centeringWrapper.contains(connectButton)).toBe(true);
  });
});

// Fermeture SESSION-ONLY (03/08, retour direct : "option pour supprimer/
// fermer la guest mode bar" — voir la docstring complète du composant
// source pour le raisonnement produit derrière ce choix).
// ⚠️ REMONTÉ (04/08) : la décision finale "masqué ou non" (`isVisible`)
// vient maintenant du PARENT (App.jsx, `isGuestBarDismissed`) — ce composant
// ne fait plus que l'appeler via `onDismiss()`. Donc ici on ne peut plus
// observer "la barre disparaît toute seule après clic" (ce serait tester le
// comportement du parent, absent de ce fichier) : on observe que
// `onDismiss` est bien appelé, puis on SIMULE la réaction du parent via
// `rerender(... isVisible={false})` — exactement ce qu'App.jsx ferait en
// vrai. Seul `confirmingDismiss` (l'affichage intermédiaire) reste un état
// interne à ce composant, testable sans mock.
describe('GuestModeBar — fermeture session-only avec confirmation', () => {
  it('affiche un bouton pour masquer le rappel, à côté de "Se connecter"', () => {
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);
    expect(screen.getByTitle('Masquer ce rappel pour cette visite')).toBeInTheDocument();
  });

  it('cliquer le bouton de fermeture affiche une confirmation AVANT d\'appeler onDismiss', () => {
    const onDismiss = vi.fn();
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByTitle('Masquer ce rappel pour cette visite'));

    // Le message d'origine et "Se connecter" disparaissent, remplacés par
    // la confirmation — toujours dans LA MÊME barre (pas une modale).
    expect(screen.queryByText('Données sauvegardées uniquement sur cet appareil.')).toBeNull();
    expect(screen.getByText(/resteront sauvegardées uniquement sur cet appareil/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masquer quand même' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    // Le simple affichage de la confirmation n'appelle PAS encore onDismiss.
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('"Annuler" revient à l\'affichage normal, la barre reste visible, onDismiss jamais appelé', () => {
    const onDismiss = vi.fn();
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle('Masquer ce rappel pour cette visite'));

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByText('Données sauvegardées uniquement sur cet appareil.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('"Masquer quand même" appelle onDismiss() exactement 1 fois (la décision remonte au parent)', () => {
    const onDismiss = vi.fn();
    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTitle('Masquer ce rappel pour cette visite'));

    fireEvent.click(screen.getByRole('button', { name: 'Masquer quand même' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('quand le parent réagit à onDismiss en passant isVisible=false, la barre disparaît (composant rend null)', () => {
    const { container, rerender } = render(
      <GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />
    );
    fireEvent.click(screen.getByTitle('Masquer ce rappel pour cette visite'));
    fireEvent.click(screen.getByRole('button', { name: 'Masquer quand même' }));

    // Simule App.jsx : setIsGuestBarDismissed(true) → isGuestBarVisible passe
    // à false → la nouvelle valeur de `isVisible` redescend en prop ici.
    rerender(<GuestModeBar theme={mockTheme} isVisible={false} openModal={() => {}} />);

    expect(container).toBeEmptyDOMElement();
  });

  // Le coeur du choix "session-only" (docstring source, `isGuestBarDismissed`
  // dans App.jsx) : un nouveau montage avec isVisible=true à nouveau (=
  // l'équivalent d'un vrai rechargement de page, où App.jsx repart avec
  // `isGuestBarDismissed` réinitialisé à `false`) ne doit JAMAIS se
  // souvenir d'une fermeture précédente.
  it('un nouveau montage avec isVisible=true réaffiche la barre normalement (rien ne persiste dans le composant)', () => {
    const { container, unmount } = render(
      <GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />
    );
    fireEvent.click(screen.getByTitle('Masquer ce rappel pour cette visite'));
    fireEvent.click(screen.getByRole('button', { name: 'Masquer quand même' }));
    unmount();

    render(<GuestModeBar theme={mockTheme} isVisible={true} openModal={() => {}} />);

    expect(screen.getByText('Données sauvegardées uniquement sur cet appareil.')).toBeInTheDocument();
  });
});
