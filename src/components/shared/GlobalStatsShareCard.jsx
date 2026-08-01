import { Activity, Zap, ListMusic } from 'lucide-react';
import { formatDuration } from '../../utils/format';

/**
 * GlobalStatsShareCard — "Bilan Global" façon Spotify Wrapped, pensé pour être
 * capturé en image (même principe que SessionSummaryCard.jsx : un composant
 * PUREMENT présentationnel, capturé ensuite via html2canvas par l'appelant —
 * voir StatsView.jsx pour la logique d'export une fois câblée).
 *
 * Câblé sur les VRAIES données depuis StatsView.jsx (voir le rendu hors
 * écran juste avant `exportGlobalStatsImage`, qui lui passe `totalSeconds`/
 * `avgBpm`/`favoriteBpmLabel`/`totalPlaylistsGenerated` déjà calculés là-bas
 * pour les besoins des graphiques existants). Toutes les props gardent
 * cependant une valeur par défaut réaliste : `<GlobalStatsShareCard />` sans
 * rien lui passer reste utilisable telle quelle (design, tests, Storybook
 * éventuel) sans dépendre de StatsView.jsx.
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
  const hasAnyData = totalSeconds > 0 || totalPlaylistsGenerated > 0;

  return (
    <div
      className="w-[400px] rounded-[32px] overflow-hidden relative"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Fond dégradé accrocheur (demande explicite) + halo décoratif — le halo
          utilise `blur` en CSS pur (pas une image), donc capturé sans souci
          par html2canvas au moment de l'export.
          BUG CORRIGÉ (01/08) : `bg-linear-to-br from-blue-600 via-indigo-600
          to-purple-700` (couleurs NOMMÉES Tailwind, donc générées en oklch()
          sous Tailwind v4) faisait échouer html2canvas ("Attempting to parse
          an unsupported color function oklch"). Dégradé réécrit en style
          inline avec les valeurs hex réelles de ces mêmes couleurs — même
          rendu visuel, mais un format qu'html2canvas sait lire.
          PERSONNALISATION MODE INTIME (01/08, suite — retour direct : "le
          texte dit déjà TempoIntime mais le fond reste bleu/violet") — même
          principe que SessionSummaryCard.jsx (accent rose/dégradé sombre
          dédié) : bleu/indigo/violet en mode normal, rose/rouge sombre en
          Mode Intime, cohérent avec l'identité visuelle déjà établie
          ailleurs dans l'app pour ce mode. */}
      <div className="absolute inset-0" style={{ background: isNaughtyMode ? 'linear-gradient(to bottom right, #be123c, #9f1239, #4c0519)' : 'linear-gradient(to bottom right, #2563eb, #4f46e5, #7e22ce)' }} />
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(0,0,0,0.20)' }} />

      <div className="relative p-8 pb-6">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl backdrop-blur-sm flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <Activity size={20} color="white" />
          </div>
          <span className="font-black text-lg tracking-tight" style={{ color: '#ffffff' }}>{isNaughtyMode ? 'TempoIntime' : 'TempoFit'}</span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}>{periodLabel}</p>
        <h1 className="text-3xl font-black leading-tight mb-1" style={{ color: '#ffffff' }}>
          {userName ? `Le bilan de ${userName}` : `Mon Bilan ${isNaughtyMode ? 'TempoIntime' : 'TempoFit'}`}
        </h1>

        {!hasAnyData ? (
          // Nouvel utilisateur : rien à récapituler, mais un point de départ
          // motivant plutôt qu'un mur de zéros.
          <div className="mt-10 mb-4 text-center py-10">
            <p className="text-6xl mb-4">🚀</p>
            <p className="text-xl font-black mb-2" style={{ color: '#ffffff' }}>Début de l'aventure !</p>
            <p className="text-sm px-4" style={{ color: 'rgba(255,255,255,0.70)' }}>Ta première séance n'attend plus que toi. Reviens ici pour voir ton bilan prendre forme.</p>
          </div>
        ) : (
          <>
            {/* Stat 1 — Volume : temps total + nombre de playlists générées,
                mise en scène "gros chiffre" façon Spotify Wrapped plutôt
                qu'une carte discrète comme dans SessionSummaryCard. */}
            <div className="mt-8 mb-6">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}>Temps total d'entraînement</p>
              <p className="text-5xl font-black leading-none tracking-tight" style={{ color: '#ffffff' }}>{formatDuration(totalSeconds)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="backdrop-blur-sm rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.10)' }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}><ListMusic size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">Playlists générées</span></div>
                <p className="text-2xl font-black" style={{ color: '#ffffff' }}>{totalPlaylistsGenerated}</p>
              </div>
              <div className="backdrop-blur-sm rounded-2xl p-4 border" style={{ backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.10)' }}>
                <div className="flex items-center gap-1.5 mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}><Zap size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">BPM moyen</span></div>
                <p className="text-2xl font-black" style={{ color: '#ffffff' }}>{avgBpm}</p>
              </div>
            </div>

            {/* Stat 2 — Profil d'effort : l'allure la plus jouée, mise en avant
                comme le "signature move" de l'utilisateur. */}
            <div className="backdrop-blur-sm rounded-2xl p-5 border mb-2" style={{ backgroundColor: 'rgba(0,0,0,0.20)', borderColor: 'rgba(255,255,255,0.10)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}>Ton allure favorite</p>
              <p className="text-3xl font-black" style={{ color: '#ffffff' }}>{favoriteBpmLabel}</p>
            </div>
          </>
        )}
      </div>

      <div className="relative px-8 py-4 border-t flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.10)' }}>
        <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.60)' }}>tempofit.app — cale ta musique sur ton effort</p>
      </div>
    </div>
  );
}
