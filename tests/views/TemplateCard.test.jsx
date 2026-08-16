// @vitest-environment jsdom
//
// Palier 2 (29/07, 10/10, dernier de ce lot) — TemplateCard, carte d'une
// playlist ensemencée (DiscoverView.jsx) : pochette générée, BPM/durée
// calculés depuis les titres réels (jamais stockés en dur).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TemplateCard from '../../src/components/views/TemplateCard.jsx';
import { CATEGORY_DESCRIPTIONS, curatedSessions, naughtyCuratedSessions } from '../../src/data/curatedSessions.js';

afterEach(() => {
  cleanup();
});

const mockTheme = {
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  bgAccentClass: 'mock-accent-bg',
};

const mockTemplate = {
  id: 'tpl-cardio-blast-mock',
  title: 'Cardio Blast',
  author: 'TempoFit',
  workoutType: 'Course à pied',
  category: 'Cardio Express',
  isOfficial: true,
  tracks: [
    { duration: 180, bpm: 150 },
    { duration: 200, bpm: 160 },
  ],
};

describe('TemplateCard', () => {
  it('affiche le titre, le type de séance et la durée calculée depuis les titres', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText('Cardio Blast')).toBeInTheDocument();
    // (180+200)/60 = 6.33 -> arrondi à 6 min
    expect(screen.getByText(/Course à pied • 6 min/)).toBeInTheDocument();
  });

  // ⚠️ CORRIGÉ (07/08, retour direct : "mettre les pseudos avant le nom de
  // la playlist, et le compteur de clones, sur la même ligne") — le BPM
  // moyen n'est plus "à côté de l'auteur" (l'ancienne ligne "chapeau" —
  // depuis le 14/08, celle-ci ne contient même plus l'auteur du tout, voir
  // plus bas) mais sur la ligne de métadonnées (workoutType/durée), même
  // distinction "composition de la séance" vs "accueil social" appliquée
  // dans PlaylistHeader.jsx.
  it('affiche le BPM moyen sur la ligne de métadonnées, avec l\'activité et la durée', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    // (150+160)/2 = 155
    expect(screen.getByText('Course à pied • 6 min • 155 BPM')).toBeInTheDocument();
  });

  // ⚠️ Simplifié (14/08, retour direct : "TEMPOFIT sur la pochette ET
  // TempoFit Officiel en dessous, le 2e est redondant" — auteur retiré de
  // la ligne "chapeau", voir TemplateCard.jsx) — l'ancien contournement
  // "TempoFit apparaît à 2 endroits" (nécessaire tant que l'auteur ET le
  // badge portaient tous deux ce texte) n'a plus lieu d'être : il n'y a
  // plus qu'un seul "TempoFit" sur la carte (le badge), donc plus besoin
  // de cibler un `<p>` précis pour vérifier l'absence de BPM.
  it('n\'affiche AUCUN BPM quand le modèle n\'a aucun titre (tracks vide)', () => {
    const templateSansTracks = { ...mockTemplate, tracks: [] };
    render(<TemplateCard theme={mockTheme} template={templateSansTracks} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.queryByText(/BPM/)).toBeNull();
  });

  it('affiche le badge "TempoFit" UNIQUEMENT quand template.isOfficial est vrai', () => {
    const { rerender } = render(
      <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />
    );
    expect(screen.getByText('TempoFit', { selector: 'span' })).toBeInTheDocument();

    rerender(
      <TemplateCard
        theme={mockTheme}
        template={{ ...mockTemplate, isOfficial: false }}
        onPlayTemplate={() => {}}
        isNaughtyMode={false}
      />
    );
    expect(screen.queryByText('TempoFit', { selector: 'span' })).toBeNull();
  });

  // ⚠️ CORRIGÉ (05/08, retour direct — "je ne vois pas le nombre de
  // clones... c'est la demande de base") : `onPlayTemplate` reçoit
  // désormais `cloneCount` en 2e argument (voir sa docstring dans
  // TemplateCard.jsx) — `cloneCount` non fourni ici, retombe sur son
  // défaut `0` (signature du composant).
  it('le clic sur la carte appelle onPlayTemplate(template, { cloneCount })', () => {
    const onPlayTemplate = vi.fn();
    const { container } = render(
      <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={onPlayTemplate} isNaughtyMode={false} />
    );
    fireEvent.click(container.firstChild);
    expect(onPlayTemplate).toHaveBeenCalledWith(mockTemplate, { cloneCount: 0 });
  });

  it('le clic sur le bouton play appelle onPlayTemplate UNE SEULE fois (stopPropagation évite le doublon avec le clic de carte)', () => {
    const onPlayTemplate = vi.fn();
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={onPlayTemplate} isNaughtyMode={false} />);

    fireEvent.click(screen.getByTitle('Écouter cette playlist'));

    expect(onPlayTemplate).toHaveBeenCalledTimes(1);
    expect(onPlayTemplate).toHaveBeenCalledWith(mockTemplate, { cloneCount: 0 });
  });

  it('transmet le VRAI cloneCount reçu en prop, pas juste le défaut', () => {
    const onPlayTemplate = vi.fn();
    const { container } = render(
      <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={onPlayTemplate} isNaughtyMode={false} cloneCount={7} />
    );
    fireEvent.click(container.firstChild);
    expect(onPlayTemplate).toHaveBeenCalledWith(mockTemplate, { cloneCount: 7 });
  });

  // ⚠️ RECONÇU (14/08, retour direct : "on a déjà TEMPOFIT sur la pochette
  // ET TempoFit Officiel en dessous, le 2e est redondant — est-ce qu'on
  // peut pas juste rendre le badge cliquable ?") — le clic vers le profil
  // (Feature Sociale "Cold Start", 02/08) vit désormais sur le BADGE
  // lui-même, plus sur un texte auteur séparé (retiré, voir
  // TemplateCard.jsx). Section renommée et tests réécrits en conséquence
  // — le comportement testé (garde `isOfficial && onViewOfficialProfile`,
  // `stopPropagation`) reste le même, juste porté par un élément différent.
  describe('badge "TempoFit" cliquable (profil vitrine)', () => {
    it('sans onViewOfficialProfile fourni : le badge reste un simple span, pas de bouton', () => {
      render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
      expect(screen.queryByRole('button', { name: 'TempoFit' })).toBeNull();
      expect(screen.getByText('TempoFit', { selector: 'span' })).toBeInTheDocument();
    });

    it('template.isOfficial=false : aucun badge du tout, ni span ni bouton, même avec onViewOfficialProfile fourni', () => {
      render(
        <TemplateCard
          theme={mockTheme} template={{ ...mockTemplate, isOfficial: false }}
          onPlayTemplate={() => {}} isNaughtyMode={false} onViewOfficialProfile={() => {}}
        />
      );
      expect(screen.queryByRole('button', { name: 'TempoFit' })).toBeNull();
      expect(screen.queryByText('TempoFit', { selector: 'span' })).toBeNull();
    });

    it('isOfficial=true ET onViewOfficialProfile fourni : le badge devient un bouton cliquable', () => {
      render(
        <TemplateCard
          theme={mockTheme} template={mockTemplate}
          onPlayTemplate={() => {}} isNaughtyMode={false} onViewOfficialProfile={() => {}}
        />
      );
      expect(screen.getByRole('button', { name: 'TempoFit' })).toBeInTheDocument();
    });

    // ⚠️ LIMITE CONNUE de ce test (14/08, découverte via un vrai bug raté
    // ICI MÊME au premier passage) — `fireEvent.click(élément)` déclenche
    // le clic DIRECTEMENT sur l'élément ciblé, sans le moindre test de
    // recouvrement visuel réel (jsdom ne fait AUCUNE mise en page/rendu
    // CSS) : ce test passait DÉJÀ avant le correctif `z-10` (voir
    // TemplateCard.jsx), alors que dans un vrai navigateur, cliquer au
    // même endroit à l'écran atteignait l'overlay du bouton play
    // au-dessus (ordre DOM, sans z-index) plutôt que ce badge. Ce test
    // vérifie que le CÂBLAGE (onClick + stopPropagation) est correct — pas
    // que le badge est RÉELLEMENT atteignable au clic dans un navigateur
    // réel, ce que jsdom ne peut pas vérifier.
    it('le clic sur le badge appelle onViewOfficialProfile, SANS déclencher onPlayTemplate (stopPropagation)', () => {
      const onPlayTemplate = vi.fn();
      const onViewOfficialProfile = vi.fn();
      render(
        <TemplateCard
          theme={mockTheme} template={mockTemplate}
          onPlayTemplate={onPlayTemplate} isNaughtyMode={false} onViewOfficialProfile={onViewOfficialProfile}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'TempoFit' }));

      expect(onViewOfficialProfile).toHaveBeenCalledTimes(1);
      expect(onPlayTemplate).not.toHaveBeenCalled();
    });
  });

  it('le nom de l\'auteur (template.author) n\'est plus affiché en texte nulle part sur la carte (redondant avec le badge, retiré le 14/08)', () => {
    render(
      <TemplateCard
        theme={mockTheme} template={mockTemplate}
        onPlayTemplate={() => {}} isNaughtyMode={false} onViewOfficialProfile={() => {}}
      />
    );
    // Le SEUL "TempoFit" visible est celui du badge (devenu bouton ici,
    // puisque onViewOfficialProfile est fourni) — un seul élément, pas deux.
    expect(screen.getAllByText('TempoFit')).toHaveLength(1);
  });

  // ⚠️ RÉÉCRIT le 02/08 (2e retour direct : "je veux que ce compteur soit
  // honnête, 0 par défaut") — `cloneCount` est maintenant une PROP fournie
  // par DiscoverView.jsx (vraie table `template_clone_counts`), plus un
  // calcul interne (`fakeCloneCountForId`, RETIRÉE).
  describe('compteur de clonages (prop réelle, fournie par DiscoverView.jsx)', () => {
    it('affiche la valeur de la prop cloneCount telle quelle', () => {
      render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} cloneCount={7} />);
      expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('7');
    });

    it('affiche 0 par défaut si cloneCount est omis — jamais un nombre inventé', () => {
      render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
      expect(screen.getByTitle('Nombre de fois où cette playlist a été clonée')).toHaveTextContent('0');
    });

    // ⚠️ RÉÉCRIT le 14/08 (retour direct : "pour gagner de la place, le
    // compteur en bas à droite de la pochette ?") — le compteur ne vit
    // plus DEVANT le titre (l'ancien `<p>` "chapeau" a été retiré
    // entièrement, voir TemplateCard.jsx) mais EN OVERLAY sur la pochette
    // elle-même, coin inférieur droit, symétrique au badge "TempoFit" en
    // haut à gauche.
    it('le compteur de clonages est affiché en overlay SUR la pochette, pas dans le bloc texte en dessous', () => {
      const { container } = render(
        <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} cloneCount={3} />
      );
      const badge = screen.getByTitle('Nombre de fois où cette playlist a été clonée');
      const coverContainer = container.querySelector('.aspect-square');
      expect(coverContainer.contains(badge)).toBe(true);
      expect(badge).toHaveTextContent('3');
    });

    it('le titre suit directement la pochette, sans ligne "chapeau" intermédiaire (retirée entièrement)', () => {
      const { container } = render(
        <TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />
      );
      const h3 = container.querySelector('h3');
      // Premier enfant du bloc texte sous la pochette — plus aucun <p>
      // "chapeau" avant lui (ni auteur ni compteur, tous deux déménagés).
      expect(h3.previousElementSibling).toBeNull();
    });
  });

  // Retour direct (02/08, 9e passe : "on ne peut pas avoir une description
  // sur la carte Découvrir et rien du tout en ouvrant la playlist — il
  // faut une synchronisation partout dans l'app") — remplace le texte de
  // remplissage Lorem ipsum d'une passe précédente par la VRAIE source
  // partagée (`CATEGORY_DESCRIPTIONS`, curatedSessions.js), la même que
  // la vitrine ET la playlist réellement ouverte.
  it('affiche la description de la CATÉGORIE du template (source partagée avec la vitrine et l\'ouverture réelle de la playlist)', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText(CATEGORY_DESCRIPTIONS['Cardio Express'])).toBeInTheDocument();
  });

  it('2 templates de catégories DIFFÉRENTES affichent 2 descriptions différentes', () => {
    const { rerender } = render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText(CATEGORY_DESCRIPTIONS['Cardio Express'])).toBeInTheDocument();

    const otherCategoryTemplate = { ...mockTemplate, id: 'autre-template', title: 'Autre Titre', category: 'Récupération & Flow' };
    rerender(<TemplateCard theme={mockTheme} template={otherCategoryTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText(CATEGORY_DESCRIPTIONS['Récupération & Flow'])).toBeInTheDocument();
  });
});

// Garde-fou (02/08) — chaque catégorie RÉELLEMENT utilisée dans
// curatedSessions.js doit avoir une entrée dans CATEGORY_DESCRIPTIONS,
// sinon `TemplateCard.jsx` afficherait silencieusement rien du tout
// (`undefined` ne lève pas d'erreur en JSX) pour toute nouvelle catégorie
// ajoutée sans que la source partagée ne soit mise à jour en même temps.
describe('TemplateCard — CATEGORY_DESCRIPTIONS couvre bien toutes les catégories réelles', () => {
  it('toutes les catégories de curatedSessions/naughtyCuratedSessions ont une description non vide', () => {
    const allCategories = new Set([...curatedSessions, ...naughtyCuratedSessions].map(t => t.category));
    allCategories.forEach(category => {
      expect(typeof CATEGORY_DESCRIPTIONS[category]).toBe('string');
      expect(CATEGORY_DESCRIPTIONS[category].length).toBeGreaterThan(0);
    });
  });
});
