/**
 * TrophyShareCard — visuel partageable pour un trophée débloqué, même
 * principe que SessionSummaryCard.jsx/GlobalStatsShareCard.jsx (composant
 * PUREMENT présentationnel, capturé ensuite via html2canvas par l'appelant —
 * voir TrophiesView.jsx pour la logique d'export une fois câblée).
 *
 * RETOUR DIRECT (01/09, suite du chantier "vrai partage Instagram Stories" —
 * "et pour les trophées ?", puis "oui, crée un visuel pour les trophées") :
 * jusqu'ici, partager un trophée ne partageait QUE du texte (`handleShare`,
 * useShare.js) — aucun visuel, donc `hasReadyImage` (ShareModal.jsx) restait
 * toujours faux pour ce type de partage, et le bouton "Story / IG"
 * n'apparaissait jamais (juste "Plus", honnête mais sans intégration
 * Instagram réelle). Ce composant comble ce manque.
 *
 * Design volontairement DORÉ/AMBRE (pas le rouge habituel de l'app ni le
 * bleu/violet de GlobalStatsShareCard.jsx) — cohérent avec la couleur déjà
 * utilisée pour un trophée débloqué ailleurs dans l'app (bordure/halo jaune
 * sur la carte trophée, voir TrophiesView.jsx, `renderTrophyCard`) : un
 * accomplissement mérite sa propre identité visuelle, pas un recyclage des
 * couleurs déjà prises par les 2 autres visuels partageables.
 *
 * Zéro appel réseau/pochette à résoudre (contrairement à
 * SessionSummaryCard.jsx) : un trophée n'a qu'un emoji (`trophy.icon`,
 * appConfig.js) comme illustration — la capture peut donc se faire
 * immédiatement au clic, sans étape de préparation asynchrone préalable.
 */
export default function TrophyShareCard({ trophy, isNaughtyMode = false }) {
  if (!trophy) return null;

  return (
    <div
      className="w-[400px] rounded-[32px] overflow-hidden relative"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Fond dégradé doré/ambre (mode standard) ou rose sombre (Mode
          Intime, même principe que les 2 autres cartes partageables) — en
          style inline avec des valeurs hex réelles, PAS des classes
          Tailwind nommées (voir GlobalStatsShareCard.jsx : les couleurs
          nommées Tailwind v4 génèrent de l'oklch(), qu'html2canvas ne sait
          pas toujours parser correctement selon la combinaison de styles —
          convention déjà établie, reprise ici par prudence plutôt que
          revérifiée au cas par cas). */}
      <div className="absolute inset-0" style={{ background: isNaughtyMode ? 'linear-gradient(to bottom right, #9f1239, #831843, #450a0a)' : 'linear-gradient(to bottom right, #b45309, #92400e, #451a03)' }} />
      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }} />
      <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(0,0,0,0.20)' }} />

      <div className="relative p-8 pb-6">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{isNaughtyMode ? '🔥' : '🏆'}</span>
          </div>
          <span className="font-black text-lg tracking-tight" style={{ color: '#ffffff' }}>{isNaughtyMode ? 'TempoIntime' : 'TempoFit'}</span>
        </div>

        <p className="text-xs font-bold uppercase tracking-[0.2em] mb-1" style={{ color: 'rgba(255,255,255,0.70)' }}>Trophée débloqué</p>

        {/* Icône du trophée — gros plan, pas juste une petite pastille comme
            sur la carte du mur des trophées (TrophiesView.jsx) : c'est ICI
            le sujet principal du visuel, pas un élément secondaire à côté
            d'un titre. */}
        <div className="flex justify-center my-8">
          <div className="w-32 h-32 rounded-[28px] flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)', fontSize: '64px', lineHeight: 1 }}>
            {trophy.icon}
          </div>
        </div>

        <h1 className="text-3xl font-black leading-tight mb-3 text-center" style={{ color: '#ffffff' }}>{trophy.name}</h1>
        <p className="text-sm text-center px-2" style={{ color: 'rgba(255,255,255,0.80)' }}>{trophy.desc}</p>
      </div>

      <div className="relative px-8 py-4 border-t flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
        <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.60)' }}>tempofit.app — cale ta musique sur ton effort</p>
      </div>
    </div>
  );
}
