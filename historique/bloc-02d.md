- **HARMONISATION — les 2 implémentations "copier dans le presse-papier"
  signalées ci-dessus, mais volontairement pas touchées, ONT FINALEMENT
  ÉTÉ unifiées (08/08, retour direct immédiat : "faut pas que tout soit
  le même ?").** En revérifiant les tests existants avant de trancher,
  le refactor s'est révélé bien MOINS risqué que redouté au moment du
  1er correctif — les deux suites de tests concernées vérifient déjà un
  comportement OBSERVABLE (toast affiché, modale fermée, `<textarea>`
  bien retiré du DOM, texte transmis au presse-papier), jamais un détail
  d'implémentation interne — un vrai signal que le refactor était sûr,
  vérifié avant d'agir plutôt que supposé.
  - **`useShare.js`, `copyToClipboard`** — la logique presse-papier
    elle-même (essai `navigator.clipboard`, repli `execCommand`,
    vérification de sa valeur de retour) déléguée à
    `copyTextToClipboard` (`clipboard.js`) ; ce qui reste ICI est
    seulement ce qui est spécifique à ce hook (construction du texte
    depuis `shareData`, fermeture de la modale, message exact du toast).
    Les 5 tests existants de `useShare.test.js` passent sans
    modification — confirmé AVANT de livrer, pas après coup.
  - **`SettingsView.jsx`, `copyRedirectUri`** — migré sur
    `copyTextToClipboard` (avant : `navigator.clipboard` seul, échec
    silencieux `.catch(() => {})`, aucun repli, aucun retour utilisateur
    en cas d'échec réel — exactement la version FRAGILE identifiée dans
    le correctif précédent). Message d'erreur ajouté au passage (absent
    avant, jamais aucun retour possible en cas d'échec) — cohérence avec
    `copyProfileLink` et `useShare.js`. 1 nouveau test ajouté
    (`SettingsView.test.jsx`) qui vérifie précisément ce nouveau message
    d'erreur, absent avant ce chantier.
  Résultat : **une seule implémentation** de "copier dans le
  presse-papier" dans tout le projet (`src/utils/clipboard.js`), utilisée
  par les 3 boutons "copier" existants (redirect URI Spotify, lien de
  profil public, partage de playlist/trophée) — plus aucune version
  fragile qui traîne, plus aucun risque d'en copier une par accident pour
  un futur 4e bouton.
  ⚠️ **Correctif PAS ENCORE vérifié en conditions réelles** — trouvé et
  livré dans cette session, mais pas encore déployé/testé sur l'app en
  prod au moment d'écrire ceci (retour direct de l'utilisateur : "je
  vérifie d'abord ton correctif" avant d'aller plus loin). Prochaine
  étape avant tout nouveau chantier sur ce sujet : confirmer qu'un VRAI
  template Découvrir (ex. "Midnight Runner 160", capture d'écran à
  l'appui dans cette session) affiche bien le badge une fois ce fichier
  poussé sur GitHub.
  ⚠️ **Question ouverte, mise en pause à la demande explicite de
  l'utilisateur ("note-toi la question pour plus tard")** : la playlist
  de démo locale (`playlist-example-1`, "Exemple : Session Rock/Métal",
  définie en dur dans `App.jsx`) devrait-elle AUSSI donner l'illusion
  d'avoir été générée par le faux compte vitrine "TempoFit Officiel", et
  afficher un compteur de clonages ? Contrairement aux vrais templates
  Découvrir corrigés ci-dessus, cette playlist n'est PAS backée par
  `curatedSessions.js`/`template_clone_counts` — elle est déjà "à
  l'utilisateur" dès l'inscription (renommable/supprimable, voir
  `App.jsx`). Tension identifiée avec le principe déjà acté ailleurs dans
  ce fichier ("le compteur de clonage doit être honnête, 0 par défaut,
  jamais un nombre inventé" — décision qui avait déjà fait annuler une
  1re implémentation avec des chiffres "ambitieux mais faux", voir plus
  bas dans ce README). 3 pistes proposées à l'utilisateur, aucune tranchée
  pour l'instant : (1) lier cette playlist à un VRAI template Découvrir
  existant/à créer (compteur honnête, mais demande plus de travail) ;
  (2) une entrée dédiée dans `template_clone_counts` pour ce cas précis,
  réelle mais qui démarrerait à 0 ; (3) afficher honnêtement 0 sans rien
  changer côté données. **À reprendre une fois le point ci-dessus (badge
  sur un vrai template) confirmé en conditions réelles** — pas commencé.
- **Dette corrigée — les données restaient dans localStorage après
  déconnexion, sur un appareil partagé le compte suivant pouvait les VOIR
  ET LES MODIFIER.** Connue et documentée de longue date (voir la
  docstring historique de `usePersistentState.js`), mais sous-estimée :
  la doc parlait d'un compte suivant qui verrait ces données "un court
  instant avant que son propre pull ne les remplace" — ça suppose qu'il
  se CONNECTE. S'il reste en mode invité (plausible sur un appareil
  partagé), il voyait — et pouvait modifier — les données de la personne
  précédente **indéfiniment**, jamais juste un instant. Corrigé :
  `signOut()` (AuthContext.jsx) appelle désormais `clearLocalCache()`
  (nouveau, `src/utils/localCache.js`) — vide tout le cache localStorage
  TempoFit (`tempofit:*`) de cet appareil, APRÈS
  `supabase.auth.signOut()` (si la déconnexion réseau échoue, le cache
  local n'est pas vidé pour rien). Safe par construction, aucune perte de
  donnée : au moment du `signOut()`, tout changement local a déjà été
  poussé vers Supabase en tâche de fond (`usePersistentState.js`/
  `useSyncedCollection.js`) — vider le cache oblige juste un vrai re-pull
  réseau à la prochaine connexion. `deleteAccount` en bénéficie
  automatiquement (il appelle déjà `signOut()` en interne) — logique,
  supprimer son compte doit *a fortiori* nettoyer le cache local.
  Occasion prise de centraliser `STORAGE_PREFIX` (`'tempofit:'`), trouvée
  dupliquée à l'identique dans `usePersistentState.js` ET
  `useSyncedCollection.js` — même raisonnement que les autres constantes
  déjà extraites du projet une fois une duplication confirmée (voir
  CLAUDE-SANDBOX-VERIFICATION.md §4sexies). Tests ajoutés :
  `tests/utils/localCache.test.js` (nouveau, 1er fichier de test de cet
  utilitaire) + 1 test dans `tests/contexts/AuthContext.test.jsx` (vrai
  `window.localStorage` de jsdom, vérifie qu'une clé étrangère au même
  domaine n'est jamais touchée).
