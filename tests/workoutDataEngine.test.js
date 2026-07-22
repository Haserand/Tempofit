import { describe, it, expect } from 'vitest';
import { parseGarminCsv } from '../src/workoutDataEngine.js';

/**
 * workoutDataEngine.test.js — sécurise le parsing des exports CSV Garmin/
 * Strava. Terrain par nature instable (format contrôlé par un tiers, fichier
 * parfois modifié à la main, export dans une langue différente...) : cette
 * suite vérifie que `parseGarminCsv` dégrade toujours proprement (erreur
 * explicite ou ligne ignorée) plutôt que de planter ou de renvoyer des
 * données silencieusement fausses.
 *
 * Toutes les chaînes CSV ci-dessous sont des mocks écrits à la main
 * (aucun fichier physique importé) — format Garmin réel : chaque ligne est
 * une liste de champs entre guillemets séparés par des virgules
 * (`"champ1","champ2","champ3"`), ce que `parseGarminCsv` découpe via
 * `line.split('","')`. Toutes les valeurs attendues ci-dessous ont été
 * vérifiées par exécution réelle de la fonction avant d'écrire les
 * assertions.
 */

// Construit une ligne au format Garmin ("champ1","champ2",...) — évite de
// répéter la ponctuation à la main dans chaque test.
const csvLine = (...fields) => fields.map(f => `"${f}"`).join(',');

describe('parseGarminCsv — cas nominal (export complet, cadence + FC)', () => {
  const csv = [
    csvLine('Circuit', 'Temps cumulé', 'Distance', 'Fréquence cardiaque moyenne', 'Cadence de course moyenne (ppm)'),
    csvLine('1', '00:05:00', '1.00', '145', '172'),
    csvLine('2', '00:10:00', '2.00', '150', '175'),
  ].join('\n');

  it('accepte le fichier et détecte les deux métriques', () => {
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.hasCadence).toBe(true);
    expect(result.hasHeartRate).toBe(true);
    expect(result.data).toHaveLength(2);
  });

  it('type toutes les métriques en Number, jamais en String', () => {
    const { data } = parseGarminCsv(csv);
    for (const point of data) {
      expect(typeof point.circuit).toBe('number');
      expect(typeof point.timeSec).toBe('number');
      expect(typeof point.cadenceReelle).toBe('number');
      expect(typeof point.heartRate).toBe('number');
    }
  });

  it('extrait les bonnes valeurs, dont le temps cumulé converti en secondes', () => {
    const { data } = parseGarminCsv(csv);
    expect(data[0]).toEqual({ circuit: 1, timeSec: 300, heartRate: 145, cadenceReelle: 172 });
    expect(data[1]).toEqual({ circuit: 2, timeSec: 600, heartRate: 150, cadenceReelle: 175 });
  });
});

describe('parseGarminCsv — export Strava en anglais (Heart Rate uniquement)', () => {
  it('reconnaît l\'en-tête anglais "Heart Rate" sans colonne cadence', () => {
    const csv = [
      csvLine('Lap', 'Time', 'Heart Rate'),
      csvLine('1', '00:05:00', '140'),
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.hasHeartRate).toBe(true);
    expect(result.hasCadence).toBe(false);
    expect(result.data[0].heartRate).toBe(140);
    expect(result.data[0].cadenceReelle).toBeUndefined();
  });
});

describe('parseGarminCsv — tolérance aux champs vides (perte de signal GPS)', () => {
  it('ignore silencieusement une ligne dont les deux métriques sont vides, sans planter', () => {
    const csv = [
      csvLine('Circuit', 'Temps cumulé', 'Fréquence cardiaque moyenne', 'Cadence de course moyenne (ppm)'),
      csvLine('1', '00:05:00', '145', '172'),
      csvLine('2', '00:10:00', '', ''),   // perte de signal : rien à en tirer
      csvLine('3', '00:15:00', '150', '170'),
    ].join('\n');

    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    // La ligne creuse a bien disparu (3 lignes de données -> 2 points), sans
    // exception levée et sans point "à moitié rempli" ou à valeurs nulles.
    expect(result.data).toHaveLength(2);
    // Le numéro de circuit REFLÈTE la position d'origine dans le fichier
    // (comportement réel vérifié) : la ligne manquante laisse un "trou"
    // plutôt que d'être renumérotée 1, 2 — utile pour recaler visuellement
    // sur le fichier source en cas de doute.
    expect(result.data.map(d => d.circuit)).toEqual([1, 3]);
  });

  it('garde une ligne partiellement remplie (une seule métrique présente)', () => {
    const csv = [
      csvLine('Circuit', 'Temps cumulé', 'Fréquence cardiaque moyenne', 'Cadence de course moyenne (ppm)'),
      csvLine('1', '00:05:00', '145', ''), // FC seule, cadence manquante ce tour-ci
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.data[0].heartRate).toBe(145);
    expect(result.data[0].cadenceReelle).toBeUndefined();
  });
});

describe('parseGarminCsv — cas limites', () => {
  it('refuse une chaîne vide sans planter', () => {
    expect(() => parseGarminCsv('')).not.toThrow();
    const result = parseGarminCsv('');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('refuse un fichier qui n\'a que l\'en-tête (aucune ligne de données)', () => {
    const result = parseGarminCsv(csvLine('Circuit', 'Distance'));
    expect(result.ok).toBe(false);
  });

  it('refuse proprement un CSV sans colonne cadence NI fréquence cardiaque', () => {
    const csv = [
      csvLine('Circuit', 'Distance', 'Vitesse'),
      csvLine('1', '1.00', '12.5'),
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cadence|fréquence/i);
  });

  it('refuse un fichier dont toutes les lignes de données sont vides (0/0 partout)', () => {
    const csv = [
      csvLine('Circuit', 'Fréquence cardiaque moyenne', 'Cadence de course moyenne (ppm)'),
      csvLine('1', '', ''),
      csvLine('2', '', ''),
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('ne plante pas sur un format de temps totalement inattendu — retombe sur 0 plutôt que NaN', () => {
    const csv = [
      csvLine('Circuit', 'Temps cumulé', 'Fréquence cardiaque moyenne'),
      csvLine('1', 'n-importe-quoi', '145'),
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.data[0].timeSec).toBe(0);
    expect(Number.isNaN(result.data[0].timeSec)).toBe(false);
  });

  it('retombe sur un calcul par défaut (1 point par minute) quand il n\'y a aucune colonne de temps du tout', () => {
    const csv = [
      csvLine('Circuit', 'Fréquence cardiaque moyenne'),
      csvLine('1', '145'),
      csvLine('2', '150'),
    ].join('\n');
    const result = parseGarminCsv(csv);
    expect(result.ok).toBe(true);
    expect(result.data[0].timeSec).toBe(0);
    expect(result.data[1].timeSec).toBe(60);
  });
});
