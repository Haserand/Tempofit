// @vitest-environment jsdom
//
// Test dédié à SessionSummaryCard.jsx — 0 test jusqu'ici. Composant
// purement présentationnel (voir sa docstring : "aucun appel réseau ici"),
// aucun Contexte à mocker — même famille que GlobalStatsShareCard.test.jsx
// (cartes pensées pour être capturées en image via html2canvas).
//
// Écrit le 14/08, suite directe du chantier "infobulles manquantes"
// (check-up du même jour) : `bars` (zones d'intensité / répartition BPM)
// a été restructuré pour porter un `title` distinct du `label` abrégé
// affiché — ces tests couvrent en particulier ce point précis, plus les
// branches générales du composant (jusque-là non testées du tout).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SessionSummaryCard from '../../src/components/shared/SessionSummaryCard.jsx';

afterEach(() => {
  cleanup();
});

function makeTrack(overrides = {}) {
  return { trackId: 't1', title: 'Titre', artist: 'Artiste', bpm: 140, duration: 180, ...overrides };
}

function basePlaylist(overrides = {}) {
  return {
    name: 'Ma Séance', workoutType: 'Course à pied', totalDuration: 1800,
    tracks: [makeTrack()], completions: [], config: {},
    ...overrides,
  };
}

describe('SessionSummaryCard — garde-fou', () => {
  it('playlist absente (null) : ne rend rien, ne plante pas', () => {
    const { container } = render(<SessionSummaryCard playlist={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SessionSummaryCard — en-tête et méta', () => {
  it('affiche le nom de la playlist et le type de séance', () => {
    render(<SessionSummaryCard playlist={basePlaylist()} />);
    expect(screen.getByText('Ma Séance')).toBeInTheDocument();
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
  });

  it('affiche la distance UNIQUEMENT si targetMode="distance" (pas pour une séance calée par durée)', () => {
    const { rerender } = render(<SessionSummaryCard playlist={basePlaylist({
      targetMode: 'distance', config: { distanceVal: 5 }, distanceUnit: 'km',
    })} />);
    // Regex plutôt que chaîne exacte : `getByText` compare le texte des
    // nœuds DIRECTS de l'élément, qui inclut ici le "· " précédent dans le
    // même <span> (voir le JSX : `· <MapPin/> {distanceLabel}`) — le texte
    // réel de ce nœud est "· 5 km", pas juste "5 km".
    expect(screen.getByText(/5 km/)).toBeInTheDocument();

    rerender(<SessionSummaryCard playlist={basePlaylist({ targetMode: 'time' })} />);
    expect(screen.queryByText(/km/)).toBeNull();
  });

  it('affiche la date de la DERNIÈRE complétion si la séance a déjà été faite, sinon repli sur createdAt', () => {
    const { rerender } = render(<SessionSummaryCard playlist={basePlaylist({
      completions: ['2026-08-01', '2026-08-10'], createdAt: '1 juil. 2026',
    })} />);
    expect(screen.getByText(/10 août 2026/)).toBeInTheDocument();

    rerender(<SessionSummaryCard playlist={basePlaylist({ completions: [], createdAt: '1 juil. 2026' })} />);
    expect(screen.getByText('1 juil. 2026')).toBeInTheDocument();
  });

  it('Mode Intime : utilise config.workoutName plutôt que workoutType (toujours "Ambiance" en Intime)', () => {
    render(<SessionSummaryCard
      playlist={basePlaylist({ workoutType: 'Ambiance', config: { workoutName: 'Course à pied' } })}
      isNaughtyMode={true}
    />);
    expect(screen.getByText('Course à pied')).toBeInTheDocument();
    // "TempoIntime" est réparti entre un nœud texte "Tempo" et un <span>
    // imbriqué "Intime" (couleur différente) — `getByText` ne concatène
    // JAMAIS le texte d'un élément enfant à celui de son parent (seuls les
    // nœuds texte DIRECTS comptent). "Intime" seul, sans ambiguïté
    // possible avec le mode Sport ("Fit" à la place), suffit à confirmer
    // que le Mode Intime est bien actif.
    expect(screen.getByText('Intime')).toBeInTheDocument();
  });
});

describe('SessionSummaryCard — badge BPM moyen', () => {
  it('avgBpm=0 (aucun titre avec BPM, ni config.bpm) : affiche juste "0", pas de badge coloré', () => {
    render(<SessionSummaryCard playlist={basePlaylist({ tracks: [makeTrack({ bpm: null })], config: {} })} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('sans profil configuré mais avgBpm > 0 : badge coloré (repli générique "Énergie Musicale"), SANS suffixe de zone', () => {
    render(<SessionSummaryCard playlist={basePlaylist({ tracks: [makeTrack({ bpm: 140 })] })} />);
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.queryByText(/140 •/)).toBeNull(); // pas de "140 • Zone", aucune zone à suggérer sans profil
  });

  it('avec un profil configuré : affiche le badge coloré avec le libellé ABRÉGÉ de la zone, et le libellé COMPLET en infobulle', () => {
    const getProfileForWorkout = () => ({ zone1: 100, zone2: 120, zone3: 140, zone4: 160 });
    render(<SessionSummaryCard
      playlist={basePlaylist({ tracks: [makeTrack({ bpm: 140 })] })}
      getProfileForWorkout={getProfileForWorkout}
    />);
    expect(screen.getByText('140 • Seuil')).toBeInTheDocument();
    // Avec ce même profil/cette même piste, la section "Zones d'intensité"
    // s'affiche AUSSI (voir le describe suivant) — le libellé complet
    // "Seuil / Tempo" apparaît donc sur 3 éléments simultanément (badge +
    // segment de barre + légende), pas seulement le badge.
    expect(screen.getAllByTitle('Seuil / Tempo').length).toBeGreaterThanOrEqual(1);
  });
});

describe('SessionSummaryCard — barres de répartition (zones réelles vs repli BPM)', () => {
  it('profil configuré : libellé "Zones d\'intensité", affiche le libellé ABRÉGÉ, l\'infobulle porte le libellé COMPLET (distinct)', () => {
    const getProfileForWorkout = () => ({ zone1: 100, zone2: 120, zone3: 140, zone4: 160 });
    render(<SessionSummaryCard
      playlist={basePlaylist({ tracks: [makeTrack({ bpm: 140 })] })}
      getProfileForWorkout={getProfileForWorkout}
    />);
    expect(screen.getByText("Zones d'intensité")).toBeInTheDocument();
    // "Seuil" apparaît à la fois dans le badge BPM et dans la légende de la
    // barre — au moins 2 occurrences, pas juste 1.
    expect(screen.getAllByText(/Seuil/).length).toBeGreaterThanOrEqual(2);
    // Le libellé complet en infobulle apparaît sur les 3 éléments qui
    // portent l'abrégé "Seuil" à l'écran : le badge BPM, le segment de la
    // barre colorée, et sa légende — jamais une simple répétition de
    // l'abrégé sur aucun des trois.
    expect(screen.getAllByTitle('Seuil / Tempo')).toHaveLength(3);
  });

  it('sans profil configuré : replie sur "Répartition par BPM", tranches génériques — l\'infobulle reformule en phrase complète, ne duplique pas bêtement le texte visible', () => {
    render(<SessionSummaryCard playlist={basePlaylist({ tracks: [makeTrack({ bpm: 145 })] })} />);
    expect(screen.getByText('Répartition par BPM')).toBeInTheDocument();
    expect(screen.getByText('140-159 · 100%')).toBeInTheDocument();
    // Le segment de la barre colorée ET sa légende portent tous les deux
    // ce title — 2 éléments, pas 1 (même motif que le describe précédent).
    expect(screen.getAllByTitle('De 140 à 159 BPM')).toHaveLength(2);
  });

  it('aucun titre avec BPM : aucune section de répartition affichée (ni zones, ni repli)', () => {
    render(<SessionSummaryCard playlist={basePlaylist({ tracks: [makeTrack({ bpm: null })] })} />);
    expect(screen.queryByText("Zones d'intensité")).toBeNull();
    expect(screen.queryByText('Répartition par BPM')).toBeNull();
  });
});

describe('SessionSummaryCard — premiers titres', () => {
  it('affiche au plus les 3 premiers titres, dans l\'ordre de la playlist (pas un tri par popularité)', () => {
    const tracks = [
      makeTrack({ trackId: 't1', title: 'Premier', artist: 'A' }),
      makeTrack({ trackId: 't2', title: 'Deuxième', artist: 'B' }),
      makeTrack({ trackId: 't3', title: 'Troisième', artist: 'C' }),
      makeTrack({ trackId: 't4', title: 'Quatrième', artist: 'D' }),
    ];
    render(<SessionSummaryCard playlist={basePlaylist({ tracks })} />);
    expect(screen.getByText('Premier')).toBeInTheDocument();
    expect(screen.getByText('Troisième')).toBeInTheDocument();
    expect(screen.queryByText('Quatrième')).toBeNull();
  });

  it('pochette de titre résolue (topTrackCovers) : utilisée comme image, sinon icône générique', () => {
    const tracks = [makeTrack({ trackId: 't1', title: 'Avec pochette' })];
    const { container, rerender } = render(
      <SessionSummaryCard playlist={basePlaylist({ tracks })} topTrackCovers={{ t1: 'https://cover.jpg' }} />
    );
    expect(container.querySelector('img[src="https://cover.jpg"]')).not.toBeNull();

    rerender(<SessionSummaryCard playlist={basePlaylist({ tracks })} topTrackCovers={{}} />);
    expect(container.querySelector('img[src="https://cover.jpg"]')).toBeNull();
  });

  it('aucun titre : la section "Premiers titres" ne s\'affiche pas du tout', () => {
    render(<SessionSummaryCard playlist={basePlaylist({ tracks: [] })} />);
    expect(screen.queryByText('Premiers titres')).toBeNull();
  });
});
