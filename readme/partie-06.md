## Décidé mais pas encore construit — futur champ `profile.bio` éditable

Retour direct (21/08) : l'utilisateur veut, un jour, permettre à CHAQUE
utilisateur de se poser une courte phrase de description sur son profil
public (une vraie "bio", comme un réseau social classique) — pas construit
pour l'instant (aucun champ `bio` dans `get_public_profile_summary`,
supabase-schema.sql, ni dans le formulaire de `SettingsView.jsx`).

En attendant, la carte d'en-tête de `ProfileView.jsx` affiche déjà cette
mise en forme précise — mais SEULEMENT pour `@tempofit_officiel` (voir
"Profil vitrine" plus haut), texte câblé en dur dans
`officialVitrineProfile.js`. Décision explicite : le compte vitrine sert de
banc d'essai visuel pour ce futur champ, AVANT que la vraie fonctionnalité
existe — 2 essais de mise en forme rejetés avant d'arriver à la bonne
(bandeau séparé façon alerte, puis ligne repliée dans la carte mais encore
traitée comme une notice système avec icône/texte muted/séparateur) : ce
qui restait attendu depuis le début était un vrai encart façon bio, texte
`textHighlight` (blanc en mode sombre — `--color-main: 255 255 255`,
`src/index.css`) plutôt que `textMuted`, sans icône ni séparateur — pour
qu'il se lise comme un compte qui se présente, pas comme un avertissement
de l'appli.

Quand ce chantier démarrera pour de vrai : reprendre EXACTEMENT ce style
(`<p className="text-sm mt-3 ${textHighlight}">`, sans bordure ni icône)
pour le vrai champ `profile.bio`, conditionné sur sa présence plutôt que
sur `isOfficialVitrine` — et retirer alors le texte en dur de
`officialVitrineProfile.js` au profit d'une vraie valeur (ou continuer de
lui donner une bio écrite à la main, cohérente avec son rôle de vitrine).

## Tests

- `tests/` en miroir de `src/` (`views/`, `modals/`, `shared/`, `contexts/`, `hooks/`, `engine/`, `utils/`, `config/`, `data/`).
- 6 fichiers restés volontairement à la racine (`fileExtensionTrap.test.js`, `noDuplicateFiles.test.js`, `tailwindConcatTrap.test.js`, `testFileIdentityTrap.test.js`, `testLocationTrap.test.js`, `criticalExportsTrap.test.js` — ces 2 derniers ajoutés le 05/08, voir "État d'avancement") — des garde-fous qui scannent tout le projet via leur propre `__dirname`, les déplacer casserait leur scan. (Le compte était déjà erroné avant le 05/08 — `testFileIdentityTrap.test.js` manquait à la liste, corrigé au passage.)
- `PlaylistDetailContext.jsx` (Provider) n'a **pas** de couverture exhaustive — juste un test ciblé sur `isSaved`/`isReadOnly` (`tests/contexts/PlaylistDetailContext.test.jsx`). Le monter en entier exigerait de mocker `GeneratorContext` + `AudioPlayerContext` + le moteur de recalcul de timeline ; jugé disproportionné pour ce qui reste, à part ce point précis, de la logique triviale déjà couverte indirectement ailleurs.
- ⚠️ **Corrigé (22/08)** — cette ligne affirmait encore "aucune exécution réelle de `vitest` n'est possible dans le bac à sable" : faux depuis la découverte du 21/08 (`npm install`/un vrai serveur `vite`/Playwright/`vitest run` fonctionnent réellement, voir CLAUDE-SANDBOX-VERIFICATION.md §5ter) — `npx vitest run` tourne pour de vrai sur la suite complète à chaque session depuis, résultat cité à chaque chantier de ce README.

## À vérifier visuellement à la première occasion — risques non mesurés

⚠️ Mise à jour (22/08, plus tard la même session) — Playwright a fini
par être débloqué : le téléchargement via `npx playwright install`
reste bloqué (`cdn.playwright.dev` hors liste d'autorisation), MAIS un
binaire Chromium était déjà en cache sur le système
(`/opt/pw-browsers/chromium-1194/`, trouvé par `find / -iname
"*chromium*"`), utilisable directement via `executablePath` — voir
CLAUDE-SANDBOX-VERIFICATION.md §5quinquies pour la commande exacte. Ce
chemin n'est PAS garanti persister d'une session à l'autre (cache
d'image système, pas un acquis du projet) — à re-tester, jamais
supposer acquis.

- **`MiniPlayerBar.jsx`/`GuestModeBar.jsx` à `h-[70px]`** — ✅ CONFIRMÉ
  par mesure réelle (Playwright) : bouton play, "Se connecter" et texte
  muted tombent tous au même x, écart de 0.008px (arrondi de rendu,
  négligeable). Plus un risque.
- **Migration recharts 2→3** — toujours PAS vérifié visuellement (le
  Chromium retrouvé a servi aux bugs de centrage, pas encore réutilisé
  pour un contrôle visuel des graphiques). Build/tests réels au vert,
  mais le rendu visuel des 5 `<Pie>` et des graphiques en ligne/barres
  reste à inspecter à l'œil (2 changements visuels mineurs connus côté
  recharts : plus de bordure au clic sur les sections de pie,
  `CartesianGrid` inverse l'ordre de rendu de son fond).
- **`PlaylistCharts.jsx`, glisser-déposer sur le graphique** —
  `accessibilityLayer={false}` ajouté par prudence sur ce graphique
  précis, jamais testé contre cette interaction maison en conditions
  réelles (nécessiterait de simuler un vrai glisser-déposer souris, pas
  fait lors des mesures de centrage).

**Cas limite connu, non traité** (`PlaylistHeaderBadges.jsx`) : le badge
"Lecture seule" (`isReadOnly`) et le badge "séance déjà réalisée"
(`isLocked`) sont conceptuellement indépendants et pourraient en théorie
apparaître ensemble (playlist publique déjà complétée par son
propriétaire) — 2 icônes Lock à la suite dans la même rangée. Jamais
rencontré dans les retours reçus jusqu'ici.

Récit complet de la session qui a produit tout ça (check-up en 3 passes,
migration recharts, corrections UI ciblées, cloneCount x4, centrage
GuestModeBar/MiniPlayerBar x3, 4 refactors de composants partagés,
garde-fou automatique) : voir l'index `HISTORIQUE.md` → blocs 7-8.

## Autres fichiers de référence à ce niveau

- `CLAUDE-SANDBOX-VERIFICATION.md` — outils de vérification de code pour une session Claude sans accès réseau.
- `DEEZER-CONNECT-REMOVED.md` — historique d'une intégration retirée.
- `supabase-schema.sql` — rejouable en entier sans risque (`drop if exists` systématique avant chaque `create`).
