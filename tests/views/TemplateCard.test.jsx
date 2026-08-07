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
  it('affiche le titre, l\'auteur, le type de séance et la durée calculée depuis les titres', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    expect(screen.getByText('Cardio Blast')).toBeInTheDocument();
    // (180+200)/60 = 6.33 -> arrondi à 6 min
    expect(screen.getByText(/Course à pied • 6 min/)).toBeInTheDocument();
  });

  it('affiche le BPM moyen à côté de l\'auteur quand les titres en ont', () => {
    render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    // (150+160)/2 = 155
    expect(screen.getByText('TempoFit • 155 BPM')).toBeInTheDocument();
  });

  it('n\'affiche AUCUN BPM quand le modèle n\'a aucun titre (tracks vide)', () => {
    const templateSansTracks = { ...mockTemplate, tracks: [] };
    render(<TemplateCard theme={mockTheme} template={templateSansTracks} onPlayTemplate={() => {}} isNaughtyMode={false} />);
    // ⚠️ "TempoFit" apparaît à 2 endroits ici (le badge "officiel" ET le nom
    // d'auteur du mock, qui vaut aussi "TempoFit") — `selector: 'p'` cible
    // spécifiquement la ligne auteur, pas le badge, pour lever l'ambiguïté.
    expect(screen.getByText('TempoFit', { selector: 'p' })).toBeInTheDocument();
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

  // Feature Sociale "Cold Start" (02/08) — auteur cliquable. 0 test
  // jusqu'ici.
  describe('auteur cliquable (profil vitrine)', () => {
    it('sans onViewOfficialProfile fourni : l\'auteur reste du texte simple, pas de bouton', () => {
      const { container } = render(<TemplateCard theme={mockTheme} template={mockTemplate} onPlayTemplate={() => {}} isNaughtyMode={false} />);
      expect(screen.queryByRole('button', { name: 'TempoFit' })).toBeNull();
      // Regex (recherche PARTIELLE), pas une chaîne exacte : ce <p> contient
      // aussi le BPM ("TempoFit • 155 BPM", 2 nœuds de texte distincts) —
      // `getByText('TempoFit', ...)` avec une chaîne exige que ce soit TOUT
      // le contenu de l'élément, ce qui n'est pas le cas ici (contrairement
      // au test "n'affiche AUCUN BPM" juste au-dessus, où le <p> ne contient
      // QUE "TempoFit" puisque tracks est vide).
      expect(screen.getByText(/TempoFit/, { selector: 'p' })).toBeInTheDocument();
      expect(container.querySelector('p button')).toBeNull();
    });

    it('template.isOfficial=false : l\'auteur reste du texte simple, MÊME avec onViewOfficialProfile fourni (garde-fou pour du contenu non-officiel futur)', () => {
      render(
        <TemplateCard
          theme={mockTheme} template={{ ...mockTemplate, isOfficial: false }}
          onPlayTemplate={() => {}} isNaughtyMode={false} onViewOfficialProfile={() => {}}
        />
      );
      expect(screen.queryByRole('button', { name: 'TempoFit' })).toBeNull();
    });

    it('isOfficial=true ET onViewOfficialProfile fourni : l\'auteur devient un bouton cliquable', () => {
      render(
        <TemplateCard
          theme={mockTheme} template={mockTemplate}
          onPlayTemplate={() => {}} isNaughtyMode={false} onViewOfficialProfile={() => {}}
        />
      );
      expect(screen.getByRole('button', { name: 'TempoFit' })).toBeInTheDocument();
    });

    it('le clic sur l\'auteur appelle onViewOfficialProfile, SANS déclencher onPlayTemplate (stopPropagation)', () => {
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
