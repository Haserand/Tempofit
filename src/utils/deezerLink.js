/**
 * deezerLink.js — construit un lien "écouter en entier sur Deezer" à partir
 * d'un `trackId` interne (retour direct, 27/08 : "on est ok que tous les
 * extraits viennent de Deezer... que penses-tu de proposer d'écouter le
 * titre en entier via cette plateforme ?"). Un simple lien de SORTIE vers
 * deezer.com/track/{id} — pas un widget/lecteur intégré : ce dernier
 * exigerait que la personne soit connectée à SON PROPRE compte Deezer, ET
 * abonnée Premium pour entendre un titre en entier dans un contexte
 * playlist (sinon même le widget "complet" ne joue que 30s, comme nos
 * propres extraits) — un mur payant surprise pour une bonne partie des
 * visiteurs, pour un gain qu'un simple lien externe couvre déjà.
 *
 * `trackId` interne n'est un VRAI identifiant Deezer que pour les titres
 * effectivement sourcés depuis Deezer (`deezer-{id}`, voir musicEngine.js,
 * ex. `trackId: \`deezer-${full.id}\``) — jamais pour un titre de secours
 * (`fallback-{timestamp}-{random}`, aucun vrai titre Deezer derrière) ni un
 * template du catalogue vitrine (`curated-{templateId}-{i}`, un identifiant
 * purement local à ce projet). Renvoie `null` dans ces cas — à l'appelant
 * de ne rien afficher plutôt que d'afficher un lien mort.
 */
export const getDeezerTrackUrl = (trackId) => {
  if (typeof trackId !== 'string' || !trackId.startsWith('deezer-')) return null;
  const numericId = trackId.slice('deezer-'.length);
  if (!numericId) return null;
  return `https://www.deezer.com/track/${numericId}`;
};
