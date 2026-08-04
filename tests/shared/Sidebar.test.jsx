// @vitest-environment jsdom
//
// 3e test de composant (29/07, suite du chantier "premier test de composant
// React") — Sidebar.jsx, sensiblement plus gros que les 2 précédents
// (ViewHeader/GuestModeBar) mais toujours purement présentationnel côté
// props (aucun contexte React, aucun appel Supabase direct ici). Priorité
// donnée à un sous-ensemble de comportements à VRAIE valeur de
// non-régression plutôt qu'à une couverture exhaustive de chaque lien :
// - navigation (clic logo → accueil),
// - affichage conditionnel du bouton Trophées (`user &&`),
// - bascule Mode Intime (texte du logo, bouton "Quitter le Mode Intime"),
// - GARDE-FOU sur la compaction du menu en Mode Intime (`linkPadding`/
//   `sectionTitleMargin`, voir sidebarLayout.js) — exactement la logique
//   dont le budget a été calculé À LA MAIN plus tôt dans ce projet ; un
//   test ici évite qu'un futur changement de ces constantes casse
//   silencieusement l'alignement sans qu'on le remarque avant un
//   déploiement.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Sidebar from '../../src/components/shared/Sidebar.jsx';

afterEach(() => {
  cleanup();
});

// Props minimales communes à tous les tests — chaque test surcharge
// seulement ce qui lui importe (`user`, `isNaughtyMode`...), via l'objet
// spread ci-dessous, plutôt que de tout redéclarer à chaque fois.
const baseProps = {
  cardBorder: 'mock-border',
  cardBorderStrong: 'mock-border-strong',
  bgAccentClass: 'mock-accent-bg',
  isNaughtyMode: false,
  textHighlight: 'mock-highlight',
  textColorClass: 'mock-text-color',
  textMuted: 'mock-muted',
  isMobileMenuOpen: false,
  setIsMobileMenuOpen: () => {},
  changeView: () => {},
  onOpenSettings: () => {},
  view: 'generator',
  favorites: { useFavorites: false, artists: [] },
  user: null,
  userStats: { unlockedTrophies: [] },
  guestBarVisible: false,
  playerBarVisible: false,
  toggleNaughtyMode: () => {},
  theme: 'dark', // chaîne simple ('dark'/'light'), PAS l'objet de tokens — juste pour le bouton Sun/Moon
  toggleTheme: () => {},
};

describe('Sidebar', () => {
  it('le clic sur le logo appelle changeView(\'generator\')', () => {
    // `getByTitle`, pas `getByRole('button', {name: ...})` : le NOM
    // ACCESSIBLE d'un bouton se calcule d'abord à partir de son texte
    // visible ("TempoFit"), pas de son attribut `title` — celui-ci n'est
    // qu'un repli quand il n'y a AUCUN texte visible, ce qui n'est pas le
    // cas ici. `getByTitle` cible directement l'attribut HTML, sans
    // ambiguïté.
    const changeView = vi.fn();
    render(<Sidebar {...baseProps} changeView={changeView} />);

    fireEvent.click(screen.getByTitle("Retour à l'accueil"));

    expect(changeView).toHaveBeenCalledWith('generator');
  });

  // `onOpenSettings` (03/08, PAS `changeView('settings')` direct) — voir sa
  // docstring, App.jsx : le bouton Réglages appelle un handler dédié qui
  // réinitialise l'onglet de départ de SettingsView AVANT de naviguer,
  // pour ne jamais hériter d'un onglet "Mon Compte" resté posé par une
  // visite précédente via le menu déroulant avatar.
  it('le clic sur "Réglages" appelle onOpenSettings (pas changeView directement)', () => {
    const onOpenSettings = vi.fn();
    const changeView = vi.fn();
    render(<Sidebar {...baseProps} onOpenSettings={onOpenSettings} changeView={changeView} />);

    fireEvent.click(screen.getByText('Réglages'));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(changeView).not.toHaveBeenCalled();
  });

  it('masque le bouton Trophées quand aucun utilisateur n\'est connecté (user=null)', () => {
    render(<Sidebar {...baseProps} user={null} />);
    expect(screen.queryByTitle('Trophées')).toBeNull();
  });

  it('affiche le bouton Trophées quand un utilisateur est connecté', () => {
    render(<Sidebar {...baseProps} user={{ id: 'abc' }} userStats={{ unlockedTrophies: [] }} />);
    expect(screen.getByTitle('Trophées')).toBeInTheDocument();
  });

  it('affiche le badge du nombre de trophées débloqués quand il y en a', () => {
    // `getByTitle`, pas `getByRole('button', {name: 'Trophées'})` : dès
    // qu'un badge numérique apparaît ("3"), ce texte VISIBLE devient le nom
    // accessible calculé du bouton (priorité sur `title`) — `getByTitle`
    // cible l'attribut HTML directement, insensible à ce détail.
    render(
      <Sidebar
        {...baseProps}
        user={{ id: 'abc' }}
        userStats={{ unlockedTrophies: ['premiere-seance', 'dix-seances', 'un-mois'] }}
      />
    );
    expect(screen.getByTitle('Trophées')).toHaveTextContent('3');
  });

  it('affiche "TempoFit" en mode normal, "TempoIntime" + bouton de sortie en Mode Intime', () => {
    const { rerender } = render(<Sidebar {...baseProps} isNaughtyMode={false} />);
    expect(screen.getByText('Fit')).toBeInTheDocument();
    expect(screen.queryByText('Intime')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Quitter le Mode Intime' })).toBeNull();

    rerender(<Sidebar {...baseProps} isNaughtyMode={true} />);
    expect(screen.getByText('Intime')).toBeInTheDocument();
    expect(screen.queryByText('Fit')).toBeNull();
    expect(screen.getByRole('button', { name: 'Quitter le Mode Intime' })).toBeInTheDocument();
  });

  it('le clic sur "Quitter le Mode Intime" appelle toggleNaughtyMode', () => {
    const toggleNaughtyMode = vi.fn();
    render(<Sidebar {...baseProps} isNaughtyMode={true} toggleNaughtyMode={toggleNaughtyMode} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quitter le Mode Intime' }));

    expect(toggleNaughtyMode).toHaveBeenCalledTimes(1);
  });

  it('GARDE-FOU compaction Mode Intime — le titre "Création" utilise la marge COMPACTE en Mode Intime, NORMALE sinon', () => {
    // Vérifie le VRAI mécanisme dont le budget a été calculé à la main
    // (sidebarLayout.js, SIDEBAR_SECTION_TITLE_MARGIN vs _COMPACT) — pas
    // juste la valeur elle-même (qui peut légitimement changer un jour),
    // mais que la bascule normal/compact fonctionne toujours selon
    // isNaughtyMode.
    const { rerender } = render(<Sidebar {...baseProps} isNaughtyMode={false} />);
    expect(screen.getByText('Création')).toHaveClass('mb-4');
    expect(screen.getByText('Création')).not.toHaveClass('mb-2.5');

    rerender(<Sidebar {...baseProps} isNaughtyMode={true} />);
    expect(screen.getByText('Création')).toHaveClass('mb-2.5');
    expect(screen.getByText('Création')).not.toHaveClass('mb-4');
  });

  it('affiche "• Invité" à côté de "Mon Espace" quand aucun utilisateur n\'est connecté', () => {
    render(<Sidebar {...baseProps} user={null} />);
    expect(screen.getByText(/Mon Espace/)).toHaveTextContent('Mon Espace • Invité');
  });

  it('n\'affiche PAS "• Invité" quand un utilisateur est connecté', () => {
    render(<Sidebar {...baseProps} user={{ id: 'abc' }} />);
    expect(screen.getByText('Mon Espace')).toHaveTextContent('Mon Espace');
    expect(screen.queryByText(/Invité/)).toBeNull();
  });
});
