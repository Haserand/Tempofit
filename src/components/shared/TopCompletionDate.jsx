import { Edit3 } from 'lucide-react';

/**
 * TopCompletionDate — date de la 1ère complétion d'une playlist (`completions[0]`),
 * éditable en ligne. Extrait d'App.jsx (chantier "réduire le God Component", 25/07) :
 * c'était `renderTopCompletionDate`, une fonction interne à AppContent qui retournait
 * du JSX et était transmise en prop jusqu'à PlaylistHeader.jsx — un vrai composant
 * nommé, rendu comme un élément (`<TopCompletionDate .../>`), est la façon normale de
 * faire la même chose : pas de redéfinition à chaque re-render de AppContent, pas de
 * prop-function à transporter sur 2 niveaux (App → PlaylistDetailView → PlaylistHeader).
 * Comportement et classes CSS strictement identiques à l'original — aucun changement
 * visuel dans cette extraction.
 *
 * Ne gère QUE `completions[0]` (la première réalisation) — volontairement, pas toutes
 * les dates : une playlist rejouée plusieurs fois a plusieurs dates, l'en-tête n'a la
 * place/le sens d'en montrer qu'une. Les autres restent gérables individuellement dans
 * <CompletionsList/>, qui exclut `completions[0]` pour ne plus la répéter.
 *
 * `editingCompletion`/`setEditingCompletion` : état d'édition possédé par le parent
 * (App.jsx) et PARTAGÉ avec <CompletionsList/> — une seule date de complétion éditable
 * à la fois, tous playlists ET tous composants confondus (pas un state local ici, qui
 * casserait cette garantie). `theme` : tokens ADAPTATIFS (inputBg/borderAccentClass/
 * textHighlight, pensés pour un fond clair/sombre qui change) — hérités tels quels de
 * l'implémentation d'origine. Note pour un futur chantier (déjà repérée avant cette
 * extraction, non traitée ici) : PlaylistHeader.jsx utilise depuis son redesign une
 * palette FIXE slate-900 partout ailleurs sur la carte, pas ces tokens adaptatifs — cet
 * élément-ci reste le seul de la carte à ne pas suivre cette palette fixe. Un
 * changement visuel, pas structurel : à traiter séparément, avec confirmation par
 * capture d'écran comme le reste des choix visuels de l'app.
 *
 * `isReadOnly` (Feature Sociale — Consultation/Clonage, 01/08, retour direct :
 * "à traiter si vous voulez que ce soit parfaitement propre") — `false` par défaut
 * (AUCUN appelant existant n'a besoin de le préciser, comportement inchangé partout
 * ailleurs). Sur une playlist étrangère consultée en aperçu (PlaylistHeader.jsx,
 * `isReadOnly` du contexte), la date affichée devient du texte simple, sans bouton ni
 * icône crayon : cette date appartient à l'HISTOIRE du propriétaire d'origine, pas à
 * celle du visiteur — la modifier ici n'aurait plus persisté nulle part (cette
 * playlist n'est jamais dans SA propre `savedPlaylists`, voir
 * PlaylistDetailContext.jsx) mais aurait quand même semblé fonctionner à l'écran,
 * silencieusement inefficace — un bouton qui a l'air de marcher sans rien faire est
 * pire qu'un bouton absent.
 */
export default function TopCompletionDate({
  playlist, editingCompletion, setEditingCompletion, editCompletionDate, theme, isReadOnly = false,
}) {
  const { inputBg, borderAccentClass, textHighlight } = theme;
  const iso = playlist.completions?.[0];
  if (!iso) return null;

  const longLabel = new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  if (isReadOnly) {
    return <span>{longLabel}</span>;
  }

  const isEditing = editingCompletion && editingCompletion.playlistId === playlist.id && editingCompletion.isoDate === iso;
  if (isEditing) {
    return (
      <input
        type="date" autoFocus defaultValue={iso}
        onBlur={(e) => { editCompletionDate(playlist.id, iso, e.target.value); setEditingCompletion(null); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingCompletion(null); }}
        className={`px-2 py-1 rounded-lg text-xs font-bold normal-case tracking-normal ${inputBg} border ${borderAccentClass} ${textHighlight}`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditingCompletion({ playlistId: playlist.id, isoDate: iso })}
      className="inline-flex items-center gap-1 group/date"
      title="Modifier cette date"
    >
      {/* `text-main` en dur (pas `${textHighlight}` interpolé dans le nom de variant) :
          Tailwind scanne le code SOURCE pour repérer les noms de classes à générer —
          une classe reconstruite au runtime via template literal
          (`group-hover/date:${textHighlight}`) n'apparaît jamais telle quelle dans le
          code, donc jamais générée. `textHighlight` vaut toujours littéralement
          "text-main" depuis le Design System sémantique (voir useTheme.js) — mais ça
          reste une variable, pas un littéral, donc dangereux à interpoler dans un
          préfixe de variant. */}
      <span className="group-hover/date:text-main">{longLabel}</span>
      <Edit3 size={11} className="opacity-60 group-hover/date:opacity-100 transition-opacity shrink-0" />
    </button>
  );
}
