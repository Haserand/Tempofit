// @vitest-environment jsdom
//
// Palier 3 (29/07, 5/11 ; mis à jour 08/08) — AthleticProfilePanel.
// `AthleticContext` est mocké dans son intégralité via `vi.mock` (comme
// pour CustomActivityModal) — seuls `theme`, `showToast` et `changeView`
// restent des props reçues directement par ce composant.
//
// ⚠️ Ce composant lit `useAthleticContext()` DEPUIS LE 08/08 (auparavant
// `useGeneratorContext()` — voir la docstring de AthleticContext.jsx pour
// le raisonnement du découpage). Tous les champs qu'il utilise étaient
// déjà 100% athlétiques (aucun champ du formulaire du wizard) — simple
// renommage du mock ici, aucune scission de champs nécessaire
// (contrairement à GeneratorWizard.test.jsx/CustomActivityModal.test.jsx,
// qui ont besoin des deux Contextes à la fois).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mockUseAthleticContext = vi.fn();
vi.mock('../../src/contexts/AthleticContext.jsx', () => ({
  useAthleticContext: () => mockUseAthleticContext(),
}));

import AthleticProfilePanel from '../../src/components/views/AthleticProfilePanel.jsx';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockTheme = {
  cardBg: 'mock-card-bg',
  cardBorder: 'mock-border',
  textHighlight: 'mock-highlight',
  textMuted: 'mock-muted',
  textColorClass: 'mock-text-color',
  bgAccentClass: 'mock-accent-bg',
  borderAccentClass: 'mock-border-accent',
  inputBg: 'mock-input-bg',
  inputBorder: 'mock-input-border',
};

const DEFAULT_PREVIEW = { targetBpm: 140, zone1: 120, zone2: 140, zone3: 160, zone4: 180, isConfigured: false };

function makeActivity(overrides = {}) {
  return { isConfigured: false, targetBpm: null, zone1: null, zone2: null, zone3: null, zone4: null, cadenceIntent: 'energy', ...overrides };
}

function makeContextValue(overrides = {}) {
  return {
    isNaughtyMode: false,
    athleticProfile: {
      activities: { 'Course à pied': makeActivity(), 'Cyclisme': makeActivity() },
      custom: [],
    },
    setBaseBpmForActivity: vi.fn(),
    setZoneForActivity: vi.fn(),
    resetActivityProfile: vi.fn(),
    addCustomActivity: vi.fn(),
    removeCustomActivity: vi.fn(),
    setBaseBpmForCustom: vi.fn(),
    setZoneForCustom: vi.fn(),
    getDefaultBaseBpm: vi.fn(() => 140),
    buildDefaultPreviewProfile: vi.fn(() => ({ ...DEFAULT_PREVIEW })),
    setCadenceIntentForActivity: vi.fn(),
    setCadenceIntentForCustom: vi.fn(),
    isCadenceIntentEligible: vi.fn(() => true),
    ...overrides,
  };
}

const baseProps = {
  theme: mockTheme,
  showToast: vi.fn(),
  changeView: vi.fn(),
};

describe('AthleticProfilePanel', () => {
  it('ne rend rien en Mode Intime (garde interne, défense en profondeur)', () => {
    mockUseAthleticContext.mockReturnValue(makeContextValue({ isNaughtyMode: true }));
    const { container } = render(<AthleticProfilePanel {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche "Course à pied" sélectionné par défaut avec les valeurs d\'aperçu par défaut', () => {
    mockUseAthleticContext.mockReturnValue(makeContextValue());
    render(<AthleticProfilePanel {...baseProps} />);
    // zone2 = 140 dans DEFAULT_PREVIEW, valeur unique parmi les 4 zones
    // affichées (120/140/160/180) — pas d'ambiguïté sur ce texte.
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('Enregistrer mon profil et générer →')).toBeInTheDocument();
  });

  it('infobulle (14/08) : chaque libellé court de zone (grille des 4 zones) porte le libellé complet en title=', () => {
    mockUseAthleticContext.mockReturnValue(makeContextValue());
    render(<AthleticProfilePanel {...baseProps} />);
    // ATHLETIC_ZONES réel (appConfig.js, non mocké dans ce fichier) — zone3
    // = "Seuil" (court) / "Seuil / Tempo" (complet).
    expect(screen.getByTitle('Seuil / Tempo')).toBeInTheDocument();
  });

  it('saisir un BPM invalide (vide) et cliquer "Calculer mes zones" affiche une erreur, sans appeler setBaseBpmForActivity', () => {
    const setBaseBpmForActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue({ setBaseBpmForActivity }));
    const { container } = render(<AthleticProfilePanel {...baseProps} />);

    const bpmInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(bpmInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('Calculer mes zones'));

    expect(screen.getByText(/Indique d'abord un chiffre/)).toBeInTheDocument();
    expect(setBaseBpmForActivity).not.toHaveBeenCalled();
  });

  it('saisir un BPM valide et cliquer "Calculer mes zones" appelle setBaseBpmForActivity avec la bonne activité', () => {
    const setBaseBpmForActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue({ setBaseBpmForActivity }));
    const { container } = render(<AthleticProfilePanel {...baseProps} />);

    const bpmInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(bpmInput, { target: { value: '150' } });
    fireEvent.click(screen.getByText('Calculer mes zones'));

    expect(setBaseBpmForActivity).toHaveBeenCalledWith('Course à pied', '150');
    expect(screen.queryByText(/Indique d'abord un chiffre/)).not.toBeInTheDocument();
  });

  it('appuyer sur Entrée dans le champ BPM déclenche aussi le calcul (même effet que le bouton)', () => {
    const setBaseBpmForActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue({ setBaseBpmForActivity }));
    const { container } = render(<AthleticProfilePanel {...baseProps} />);

    const bpmInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(bpmInput, { target: { value: '155' } });
    fireEvent.keyDown(bpmInput, { key: 'Enter' });

    expect(setBaseBpmForActivity).toHaveBeenCalledWith('Course à pied', '155');
  });

  it('changer d\'onglet vers "Cyclisme" recalcule le profil affiché pour cette activité', () => {
    const buildDefaultPreviewProfile = vi.fn((key) => ({
      ...DEFAULT_PREVIEW,
      targetBpm: key === 'Cyclisme' ? 90 : 140,
    }));
    mockUseAthleticContext.mockReturnValue(makeContextValue({ buildDefaultPreviewProfile }));
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText('Cyclisme'));

    expect(buildDefaultPreviewProfile).toHaveBeenCalledWith('Cyclisme', 'energy');
  });

  it('le bouton "Ajuster manuellement" déplie les 4 zones, dont la modification appelle setZoneForActivity', () => {
    const setZoneForActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(
      makeContextValue({
        setZoneForActivity,
        athleticProfile: { activities: { 'Course à pied': makeActivity({ isConfigured: true, targetBpm: 140, zone1: 120, zone2: 140, zone3: 160, zone4: 180 }), 'Cyclisme': makeActivity() }, custom: [] },
      })
    );
    const { container } = render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText('Ajuster manuellement'));
    const zoneInputs = container.querySelectorAll('input[type="number"]');
    // index 0 = Assistant Rapide, 1..4 = zone1..zone4
    fireEvent.change(zoneInputs[2], { target: { value: '145' } });

    expect(setZoneForActivity).toHaveBeenCalledWith('Course à pied', 'zone2', '145');
  });

  it('ajouter une activité personnalisée : Entrée dans le champ appelle addCustomActivity et bascule sur le nouvel onglet', () => {
    const addCustomActivity = vi.fn(() => 'custom-1');
    mockUseAthleticContext.mockReturnValue(makeContextValue({ addCustomActivity }));
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText('+ Ajouter une autre activité'));
    fireEvent.change(screen.getByPlaceholderText('ex : Elliptique'), { target: { value: 'Elliptique' } });
    fireEvent.keyDown(screen.getByPlaceholderText('ex : Elliptique'), { key: 'Enter' });

    expect(addCustomActivity).toHaveBeenCalledWith('Elliptique');
    // Le champ de saisie a disparu (formulaire refermé après succès)
    expect(screen.queryByPlaceholderText('ex : Elliptique')).not.toBeInTheDocument();
  });

  it('si addCustomActivity échoue (retourne une valeur falsy), le formulaire d\'ajout reste ouvert', () => {
    const addCustomActivity = vi.fn(() => null);
    mockUseAthleticContext.mockReturnValue(makeContextValue({ addCustomActivity }));
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText('+ Ajouter une autre activité'));
    fireEvent.click(screen.getByPlaceholderText('ex : Elliptique').nextSibling); // bouton "+" de validation

    expect(screen.getByPlaceholderText('ex : Elliptique')).toBeInTheDocument();
  });

  it('une activité personnalisée déjà configurée affiche un bouton de suppression qui appelle removeCustomActivity et revient sur "Course à pied"', () => {
    const removeCustomActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(
      makeContextValue({
        removeCustomActivity,
        athleticProfile: {
          activities: { 'Course à pied': makeActivity(), 'Cyclisme': makeActivity() },
          custom: [{ id: 'custom-1', name: 'Elliptique', isConfigured: true, targetBpm: 130, zone1: 110, zone2: 130, zone3: 150, zone4: 170, cadenceIntent: 'energy' }],
        },
      })
    );
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText(/Elliptique/));
    fireEvent.click(screen.getByTitle('Supprimer cette activité personnalisée'));

    expect(removeCustomActivity).toHaveBeenCalledWith('custom-1');
  });

  it('le bouton de réinitialisation (activité active et déjà configurée) appelle resetActivityProfile', () => {
    const resetActivityProfile = vi.fn();
    mockUseAthleticContext.mockReturnValue(
      makeContextValue({
        resetActivityProfile,
        athleticProfile: { activities: { 'Course à pied': makeActivity({ isConfigured: true, targetBpm: 140, zone1: 120, zone2: 140, zone3: 160, zone4: 180 }), 'Cyclisme': makeActivity() }, custom: [] },
      })
    );
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByTitle('Effacer ce profil — repartir de zéro pour cette activité'));

    expect(resetActivityProfile).toHaveBeenCalledWith('Course à pied');
  });

  it('isCadenceIntentEligible=true : affiche le toggle, clic sur "Suit ton rythme" appelle setCadenceIntentForActivity', () => {
    const setCadenceIntentForActivity = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue({ isCadenceIntentEligible: vi.fn(() => true), setCadenceIntentForActivity }));
    render(<AthleticProfilePanel {...baseProps} />);

    fireEvent.click(screen.getByText('Suit ton rythme'));

    expect(setCadenceIntentForActivity).toHaveBeenCalledWith('Course à pied', 'sync');
  });

  it('isCadenceIntentEligible=false : le toggle n\'est pas affiché', () => {
    mockUseAthleticContext.mockReturnValue(makeContextValue({ isCadenceIntentEligible: vi.fn(() => false) }));
    render(<AthleticProfilePanel {...baseProps} />);
    expect(screen.queryByText('Suit ton rythme')).not.toBeInTheDocument();
  });

  it('CTA final : profil non configuré, BPM valide → calcule les zones ET change de vue', () => {
    const setBaseBpmForActivity = vi.fn();
    const changeView = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue({ setBaseBpmForActivity }));
    const { container } = render(<AthleticProfilePanel {...baseProps} changeView={changeView} />);

    const bpmInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(bpmInput, { target: { value: '150' } });
    fireEvent.click(screen.getByText('Enregistrer mon profil et générer →'));

    expect(setBaseBpmForActivity).toHaveBeenCalled();
    expect(changeView).toHaveBeenCalledWith('generator');
  });

  it('CTA final : profil non configuré, BPM invalide (vide) → ne change PAS de vue', () => {
    const changeView = vi.fn();
    mockUseAthleticContext.mockReturnValue(makeContextValue());
    const { container } = render(<AthleticProfilePanel {...baseProps} changeView={changeView} />);

    const bpmInput = container.querySelectorAll('input[type="number"]')[0];
    fireEvent.change(bpmInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('Enregistrer mon profil et générer →'));

    expect(changeView).not.toHaveBeenCalled();
  });

  it('CTA final : profil déjà configuré → libellé "Générer une playlist →", change de vue directement', () => {
    const changeView = vi.fn();
    mockUseAthleticContext.mockReturnValue(
      makeContextValue({
        athleticProfile: { activities: { 'Course à pied': makeActivity({ isConfigured: true, targetBpm: 140, zone1: 120, zone2: 140, zone3: 160, zone4: 180 }), 'Cyclisme': makeActivity() }, custom: [] },
      })
    );
    render(<AthleticProfilePanel {...baseProps} changeView={changeView} />);

    fireEvent.click(screen.getByText('Générer une playlist →'));

    expect(changeView).toHaveBeenCalledWith('generator');
  });

  it('le popover d\'explication (icône Info) s\'ouvre au clic et se ferme via le fond', () => {
    mockUseAthleticContext.mockReturnValue(makeContextValue());
    render(<AthleticProfilePanel {...baseProps} />);

    // Le bouton Info est le seul <button> à l'intérieur du conteneur du
    // label "BPM cibles par zone" tant que le popover n'est pas ouvert
    // (pas de title/texte propre à cibler directement dessus).
    const infoButton = screen.getByText('BPM cibles par zone').parentElement.querySelector('button');
    fireEvent.click(infoButton);

    // ⚠️ CORRIGÉ (05/08, build Vercel cassé — voir logs) : cette assertion
    // ciblait le 1er paragraphe du popover ("Zone 2 = le BPM que tu tapes
    // ci-dessous..."), RETIRÉ le même jour (retour direct, capture
    // annotée — voir AthleticProfilePanel.jsx, `showZoneCalcInfo`) sans
    // que ce test miroir n'ait été vérifié/mis à jour dans la même passe
    // — exactement le réflexe que la règle "vérifier le fichier de test
    // miroir pour CHAQUE fichier src/ touché" (CLAUDE-SANDBOX-VERIFICATION.md)
    // est censée éviter, manqué ici car le grep de pré-modification ne
    // portait pas sur CETTE portion de phrase précise. Retargeté sur le
    // 2e paragraphe (toujours présent) plutôt que réintroduire un texte
    // qui n'existe plus.
    expect(screen.getByText(/niveau d'effort/)).toBeInTheDocument();
  });
});
