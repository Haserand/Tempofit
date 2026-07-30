// @vitest-environment jsdom
//
// Palier 2 (29/07, 9/10) — GlobalStatsShareCard, carte "Bilan Global" façon
// Spotify Wrapped, pensée pour être capturée en image. Purement
// présentationnelle, toutes les props ont une valeur par défaut réaliste —
// candidat facile, pas de thème/contexte à mocker du tout.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GlobalStatsShareCard from '../src/components/shared/GlobalStatsShareCard.jsx';

afterEach(() => {
  cleanup();
});

describe('GlobalStatsShareCard', () => {
  it('s\'affiche correctement sans AUCUNE prop fournie (toutes ont une valeur par défaut réaliste)', () => {
    render(<GlobalStatsShareCard />);
    expect(screen.getByText('Mon Bilan TempoFit')).toBeInTheDocument();
    expect(screen.getByText('Depuis le début')).toBeInTheDocument();
  });

  it('affiche "Le bilan de {userName}" quand userName est fourni', () => {
    render(<GlobalStatsShareCard userName="Damien" />);
    expect(screen.getByText('Le bilan de Damien')).toBeInTheDocument();
    expect(screen.queryByText('Mon Bilan TempoFit')).toBeNull();
  });

  it('affiche le message "Début de l\'aventure" quand il n\'y a AUCUNE donnée (totalSeconds=0 et totalPlaylistsGenerated=0)', () => {
    render(<GlobalStatsShareCard totalSeconds={0} totalPlaylistsGenerated={0} />);
    expect(screen.getByText("Début de l'aventure !")).toBeInTheDocument();
    // Les stats chiffrées ne doivent pas apparaître dans cet état.
    expect(screen.queryByText('Playlists générées')).toBeNull();
  });

  it('affiche les statistiques chiffrées dès qu\'il y a au moins une donnée', () => {
    render(<GlobalStatsShareCard totalSeconds={3600} totalPlaylistsGenerated={5} avgBpm={140} favoriteBpmLabel="140 BPM" />);
    expect(screen.queryByText("Début de l'aventure !")).toBeNull();
    expect(screen.getByText('5')).toBeInTheDocument(); // playlists générées
    expect(screen.getByText('140')).toBeInTheDocument(); // BPM moyen
    expect(screen.getByText('140 BPM')).toBeInTheDocument(); // allure favorite
  });

  it('affiche les statistiques même avec 0 seconde tant que totalPlaylistsGenerated > 0 (hasAnyData = OR, pas AND)', () => {
    render(<GlobalStatsShareCard totalSeconds={0} totalPlaylistsGenerated={3} />);
    expect(screen.queryByText("Début de l'aventure !")).toBeNull();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('formate la durée totale via formatDuration (ex. 2h30 pour 9000 secondes)', () => {
    render(<GlobalStatsShareCard totalSeconds={9000} totalPlaylistsGenerated={1} />);
    // formatDuration (utils/format.js, déjà testé séparément) — on vérifie
    // juste que ce composant l'utilise bien, pas le détail du format exact.
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });
});
