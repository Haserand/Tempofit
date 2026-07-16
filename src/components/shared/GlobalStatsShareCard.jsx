import { Activity, Zap, ListMusic } from 'lucide-react';
import { formatDuration } from '../../utils/format';

/**
 * GlobalStatsShareCard — "Bilan Global" façon Spotify Wrapped, pensé pour être
 * capturé en image (même principe que SessionSummaryCard.jsx : un composant
 * PUREMENT présentationnel, capturé ensuite via html2canvas par l'appelant —
 * voir StatsView.jsx pour la logique d'export une fois câblée).
 *
 * ⚠️ ÉTAPE 1/2 (consigne explicite) : ce fichier ne contient QUE le
 * composant visuel, avec des valeurs de démonstration par défaut pour
 * chaque prop — pas encore branché sur `useUserStats.js`/`StatsView.jsx`.
 * Toutes les props ont une valeur par défaut réaliste, donc
 * `<GlobalStatsShareCard />` sans rien lui passer s'affiche déjà
 * correctement pour ajuster le design. Le câblage aux vraies données
 * (`totalSeconds`, BPM moyen, etc. — déjà calculés dans StatsView.jsx pour
 * les besoins des graphiques existants, voir `totalSeconds`/`bpmSum`/
 * `bpmCount` là-bas) viendra dans un 2e temps, une fois le design validé.
 *
 * Design volontairement DIFFÉRENT du rouge habituel de l'app (voir
 * SessionSummaryCard.jsx, qui lui reste dans la charte TempoFit) — dégradé
 * bleu/violet demandé explicitement, dans l'esprit "récap annuel" qui se
 * démarque pour donner envie de partager, plutôt qu'un simple export de
 * données.
 *
 * Zéro donnée (nouvel utilisateur, `totalSessions === 0`) : bascule sur un
 * texte motivant ("Début de l'aventure !") plutôt que d'afficher des zéros
 * partout — un bilan à 0h00/0 séance n'a rien d'un "bilan" à partager, mieux
 * vaut le présenter comme un point de départ.
 */
export default function GlobalStatsShareCard({
  // --- Stat 1 : Volume ---
  totalSeconds = 154 * 3600 + 40 * 60, // ~154h40 (mock)
  totalPlaylistsGenerated = 87,
  // --- Stat 2 : Profil d'effort ---
  avgBpm = 152,
  favoriteBpmLabel = '160 BPM', // ex. tranche de BPM la plus jouée, déjà formatée par l'appelant
  // --- Cadre / identité ---
  userName = null, // ex. "Damien" — optionnel, personnalise le titre si fourni
  periodLabel = 'Depuis le début', // ex. "En 2026", "Ces 30 derniers jours"...
  isNaughtyMode = false,
}) {
  const totalSessions = totalPlaylistsGenerated; // le nb de séances EST le nb de playlists ici (voir doc plus haut : distinction possible plus tard si besoin)
  const hasAnyData = totalSeconds > 0 || totalPlaylistsGenerated > 0;

  return (
    <div
      className="w-[400px] rounded-[32px] overflow-hidden shadow-2xl relative"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Fond dégradé accrocheur (demande explicite) + halo décoratif — le halo
          utilise `blur` en CSS pur (pas une image), donc capturé sans souci
          par html2canvas au moment de l'export. */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700" />
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-black/20 blur-3xl" />

      <div className="relative p-8 pb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Activity size={20} color="white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">TempoFit</span>
        </div>

        <p className="text-white/70 text-xs font-bold uppercase tracking-[0.2em] mb-1">{periodLabel}</p>
        <h1 className="text-white text-3xl font-black leading-tight mb-1">
          {userName ? `Le bilan de ${userName}` : 'Mon Bilan TempoFit'}
        </h1>

        {!hasAnyData ? (
          // Nouvel utilisateur : rien à récapituler, mais un point de départ
          // motivant plutôt qu'un mur de zéros.
          <div className="mt-10 mb-4 text-center py-10">
            <p className="text-6xl mb-4">🚀</p>
            <p className="text-white text-xl font-black mb-2">Début de l'aventure !</p>
            <p className="text-white/70 text-sm px-4">Ta première séance n'attend plus que toi. Reviens ici pour voir ton bilan prendre forme.</p>
          </div>
        ) : (
          <>
            {/* Stat 1 — Volume : temps total + nombre de playlists générées,
                mise en scène "gros chiffre" façon Spotify Wrapped plutôt
                qu'une carte discrète comme dans SessionSummaryCard. */}
            <div className="mt-8 mb-6">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Temps total d'entraînement</p>
              <p className="text-white text-5xl font-black leading-none tracking-tight">{formatDuration(totalSeconds)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-1.5 text-white/70 mb-1"><ListMusic size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">Playlists générées</span></div>
                <p className="text-white text-2xl font-black">{totalPlaylistsGenerated}</p>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/10">
                <div className="flex items-center gap-1.5 text-white/70 mb-1"><Zap size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">BPM moyen</span></div>
                <p className="text-white text-2xl font-black">{avgBpm}</p>
              </div>
            </div>

            {/* Stat 2 — Profil d'effort : l'allure la plus jouée, mise en avant
                comme le "signature move" de l'utilisateur. */}
            <div className="bg-black/20 backdrop-blur rounded-2xl p-5 border border-white/10 mb-2">
              <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-1">Ton allure favorite</p>
              <p className="text-white text-3xl font-black">{favoriteBpmLabel}</p>
            </div>
          </>
        )}
      </div>

      <div className="relative px-8 py-4 border-t border-white/10 flex items-center justify-center">
        <p className="text-white/60 text-[11px] font-semibold">tempofit.app — cale ta musique sur ton effort</p>
      </div>
    </div>
  );
}
