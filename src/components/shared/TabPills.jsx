/**
 * TabPills — barre d'onglets en pastilles, style standard de l'app pour
 * TOUT sélecteur à onglets horizontal (PlaylistsView.jsx/ProfileView.jsx/
 * DiscoverView.jsx/SettingsView.jsx/TrophiesView.jsx).
 *
 * Extrait le 21/08 (retour direct) après avoir trouvé 2 dérives distinctes
 * sur ce qui aurait dû être un seul et même pattern, jamais réunies avant
 * faute d'un point d'entrée commun :
 * - `SettingsView.jsx` avait dérivé vers un style SOULIGNEMENT (`border-b-2`)
 *   pendant ~3 semaines (28/07 → 21/08) sans que personne ne s'en aperçoive
 *   — jusqu'à une capture d'écran comparant les deux.
 * - `TrophiesView.jsx` utilisait un style "contrôle segmenté" (fond
 *   `bg-surface-hover rounded-xl p-1`, boutons `rounded-lg`+`shadow-xs`),
 *   visuellement proche mais structurellement différent du style plat
 *   (`flex gap-1`, pas de fond) déjà majoritaire ailleurs (4 vues contre 1).
 *   Repéré seulement en creusant pour répondre à "ça vaut le coup de
 *   standardiser ?" — pas trouvé avant faute d'audit dédié.
 *
 * Décision : style PLAT retenu (majoritaire), `TrophiesView.jsx` aligné
 * dessus — perd son fond/ombre au profit de la cohérence avec le reste de
 * l'app. Un seul composant désormais : une future dérive comme celle de
 * `SettingsView.jsx` devient structurellement impossible (un seul endroit
 * où le style peut diverger, pas cinq copies indépendantes).
 *
 * `label` accepte un ReactNode (pas seulement une chaîne) — couvre déjà
 * tous les cas réels sans props dédiées "count"/"icon" : un compteur en
 * opacité réduite (`Playlists (1)`), une icône + texte alignés
 * (`<Lock/> Secrets (1/8)`), ou un texte simple. Chaque appelant compose
 * son propre `label`, ce composant se contente de le rendre — garde l'API
 * minimale plutôt que d'anticiper des variantes qui n'existent pas encore.
 */
export default function TabPills({ tabs, activeTab, onChange, theme, className = '' }) {
  const { bgAccentClass, textMuted } = theme;

  return (
    <div className={`flex items-center gap-1 ${className}`} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={activeTab === tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${
            activeTab === tab.value ? `${bgAccentClass} text-white` : `${textMuted} hover:text-main`
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
