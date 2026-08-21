import { Lock, Globe, Trash2, Copy } from 'lucide-react';

/**
 * PlaylistHeaderBadges.jsx — les éléments qui flottent en overlay absolu
 * au-dessus de la carte d'en-tête (jamais dans le flux normal) : médaille
 * de rang (coin haut-droit, en dehors de la carte), et une rangée
 * compteur de clonages + badge "Lecture seule"/boutons publique-privée
 * + retirer (même coin, juste en dessous). Extrait de `PlaylistHeader.jsx`
 * (chantier découpage, 08/08) — voir ce fichier pour le raisonnement
 * complet sur pourquoi ces éléments coexistent au même coin sans jamais
 * se chevaucher (offsets différents, `isSaved`/`!isSaved` mutuellement
 * exclusifs sur médaille+lecture-seule).
 *
 * Rendu en `<>...</>` (fragment) — ces éléments sont des ENFANTS DIRECTS
 * du conteneur `relative` de `PlaylistHeader.jsx`, pas un wrapper imbriqué
 * (chacun se positionne en `absolute` par rapport à CE conteneur externe,
 * pas par rapport à un div propre à ce composant).
 *
 * ⚠️ COMPTEUR DE CLONAGES DÉPLACÉ ICI (10/08, retour direct avec capture
 * d'écran — "je le veux davantage sur la même ligne que le bouton public/
 * corbeille, à leur gauche ; laisse le pseudo où il est, dans les
 * métadonnées c'est très bien") — 2e déplacement de ce compteur dans la
 * même session : d'abord `PlaylistHeaderTitleBlock.jsx` →
 * `PlaylistHeaderMeta.jsx` (avec le pseudo), maintenant SÉPARÉ du pseudo
 * pour rejoindre cette rangée d'icônes. Gaté sur
 * `currentPlaylist.cloneCount !== undefined` (inchangé) — indépendant de
 * `isSaved`/`isReadOnly` (peut apparaître aux 2 côtés du Lock OU du
 * Globe/Trash2, jamais les 2 en même temps par construction), donc rendu
 * DANS le même conteneur flex que ces derniers plutôt qu'en bloc séparé —
 * l'ancien code avait 2 conteneurs `absolute top-4 right-4` distincts
 * (Lock d'un côté, Globe/Trash2 de l'autre, mutuellement exclusifs) ;
 * fusionnés en UN SEUL flex ici pour que le compteur puisse se positionner
 * proprement "à gauche de ce qui s'affiche", peu importe lequel des 2.
 */
export default function PlaylistHeaderBadges({
  currentPlaylist, currentPlaylistRank, currentPlaylistRankStyle,
  isSaved, isReadOnly, handleTogglePlaylistPublic, handleUnsavePlaylist,
}) {
  return (
    <>
      {currentPlaylistRankStyle && (
        <span
          className="absolute -top-2 -right-2 text-xl z-10"
          title={`${currentPlaylist.completions.length} fois — la ${currentPlaylistRank === 0 ? 'plus' : currentPlaylistRank === 1 ? '2e plus' : '3e plus'} utilisée`}
        >
          {currentPlaylistRankStyle.emoji}
        </span>
      )}

      <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
        {/* Pas de fond/bordure gris ici, contrairement au badge "Lecture
            seule"/aux boutons juste après (retour direct : "je veux pas
            de la zone grise qui entoure le compteur de clonages") — texte
            + icône seuls, `p-2` gardé pour l'alignement vertical avec ses
            voisins (même hauteur de ligne), pas pour un fond visible.
            ⚠️ CONDITION ÉLARGIE (10/08, retour direct — "j'ai changé
            d'avis, il faut le compteur pour les séances même en mode
            invité, pas grave si ce sera toujours à 0") : avant, gaté
            UNIQUEMENT sur `cloneCount !== undefined` — une playlist
            fraîchement générée puis sauvegardée n'a jamais eu cette
            valeur posée (voir handleSavePlaylist, usePlaylistLibrary.js),
            donc le badge n'apparaissait jamais pour elle, même une fois
            dans "Mes Playlists". Maintenant : `isSaved` fait apparaître le
            badge SYSTÉMATIQUEMENT pour toute playlist "à toi" (connecté
            OU invité), `|| 0` affichant honnêtement "0" plutôt qu'un
            calcul — cohérence visuelle voulue explicitement (toujours au
            même endroit sur la carte) plutôt qu'une apparition/disparition
            selon l'origine de la playlist, et un signal que la
            fonctionnalité EXISTE même pour un invité qui n'a encore rien
            fait cloner. Le cas "pas encore sauvegardé" (template/playlist
            étrangère consultée en lecture seule) garde l'ancienne
            condition — ces cas ont de toute façon presque toujours
            `cloneCount` déjà posé (App.jsx/TemplateCard.jsx à
            l'ouverture), rien à changer là. */}
        {(isSaved || currentPlaylist.cloneCount !== undefined) && (
          <span
            className="text-slate-300 text-xs font-bold p-2 flex items-center gap-1"
            title="Nombre de fois où cette playlist a été clonée"
          >
            <Copy size={12} />{currentPlaylist.cloneCount || 0}
          </span>
        )}

        {/* Badge "Lecture seule" — jamais affiché en même temps que la
            médaille ci-dessus (un rang suppose des complétions, donc une
            playlist déjà sauvegardée), ni en même temps que Globe/Trash2
            ci-dessous (mutuellement exclusifs sur `isSaved`). Icône seule
            + `title` natif du navigateur pour l'explication complète au
            survol. */}
        {!isSaved && (
          <span
            title="Lecture seule — tu ne peux pas modifier cette playlist tant qu'elle n'est pas ajoutée à Mes Playlists"
            className="bg-slate-800/80 border border-slate-700 text-slate-300 p-2 rounded-full flex items-center justify-center"
          >
            <Lock size={12} />
          </span>
        )}

        {/* Rendre publique/privée (Globe) PUIS Retirer (Trash2), même ordre
            que PlaylistCard.jsx ("Mes Playlists" en carte). Fond au SURVOL
            uniquement (contrairement au compteur/badge "Lecture seule"
            ci-dessus, volontairement toujours visibles — un STATUT/une
            info à signaler passivement, pas la même famille que ces 2
            actions). */}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleTogglePlaylistPublic}
            title={currentPlaylist.isPublic ? "Visible sur ton profil public — clique pour la rendre privée" : "Rendre cette playlist visible sur ton profil public"}
            className={`p-2 rounded-full flex items-center justify-center transition-colors ${
              currentPlaylist.isPublic
                ? 'text-emerald-400 hover:bg-emerald-600/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
          >
            <Globe size={14} />
          </button>
        )}
        {isSaved && !isReadOnly && (
          <button
            onClick={handleUnsavePlaylist}
            title="Retirer cette séance de 'Mes Playlists'"
            className="p-2 rounded-full flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </>
  );
}
