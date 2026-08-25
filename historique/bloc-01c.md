⚠️ **SESSION DU 04/08 — vérification en conditions réelles du bloc 03/08 ci-
dessous (toutes confirmées bonnes, guest bar + badge Trophées), puis une
longue chaîne de correctifs en cascade. Voir `PASSATION.md` (généré en fin
de session, hors repo) pour le récit complet — résumé technique ici :**

- **`src/utils/targetValidation.js`** (nouveau) — centralise toute la
  validation "cible de séance" (distance ou durée, jamais 0/vide/négatif).
  `isTargetValueValid`/`isSegmentValid`/`areSegmentsValid` (blocage à
  l'action) + `snapDistanceOnBlur`/`snapSegmentBpmOnBlur`/
  `snapSegmentDurationOnBlur` (correction automatique au blur du champ,
  jamais pendant la frappe — casserait la saisie décimale). Câblé dans
  `GeneratorWizard.jsx` (étapes 2/3, y compris les segments du mode
  Fractionné), `EditRoutineModal.jsx`, `TargetModeInputs.jsx` (indices
  visuels) ET `RoutinesView.jsx` (bouton "Générer" d'une routine déjà
  sauvegardée — point d'entrée distinct des formulaires, trouvé en
  généralisant après coup). Seuil distance : `>= 0.1` (`MIN_VALID_DISTANCE`),
  pas juste `> 0` — cohérent avec `step="0.1"` déjà affiché sur les champs,
  qui portent aussi `min="0.1"` (bloque les flèches natives du spinner).
  ⚠️ Limite assumée : `EditRoutineModal.jsx` n'offre aucune édition des
  segments du mode Fractionné — une routine Fractionné cassée ne peut être
  réparée qu'en la recréant, pas de vraie UI de correction pour ce cas
  précis actuellement.
- **`src/layout/inlineLinkLayout.js`** (nouveau) — `INLINE_NAV_LINK_CLASS`
  (`'font-bold underline'`), convention centralisée pour les liens texte
  "ce lien t'emmène ailleurs dans l'app" (texte finissant par `→`, jamais
  d'icône) — 6 occurrences alignées (`StatsView.jsx` ×4, `FavoritesView.jsx`,
  `GeneratorWizard.jsx`).
- **Troncature des descriptions** — `line-clamp-2` généralisé aux 5 endroits
  qui affichent `content.description` (`ProfileView.jsx`/`TemplateCard.jsx`
  l'avaient déjà ; `PlaylistHeader.jsx`/`PublicRoutinePreviewModal.jsx`/
  `RoutinesView.jsx` corrigés). `MAX_DESCRIPTION_LENGTH` (`appConfig.js`)
  resserré **280 → 150** — décision produit explicite : troncature SÈCHE,
  sans "Voir plus" nulle part (pas de vrais utilisateurs actuellement).
  ⚠️ Piège CSS rencontré deux fois (`PlaylistHeader.jsx`/`RoutinesView.jsx`) :
  `line-clamp-2` seul ne suffit pas sur un `<p>` qui est item flex sans
  largeur propre (`min-width: auto` par défaut) — `flex-1 min-w-0`
  nécessaire en plus, même piège déjà documenté dans `ViewHeader.jsx`.
- **`GuestModeBar.jsx`** — état de fermeture (`isGuestBarDismissed`) remonté
  dans `AppContent` (était local au composant, invisible du spacer de
  `<main>` et de `Sidebar.jsx`) ; spacer dédié corrigé `h-10`→`h-[72px]`
  (désynchronisé depuis le passage de la barre à 72px le 29/07). Vérifié en
  conditions réelles, confirmé bon.
- **`GeneratorWizard.jsx`, étape 3** — hauteur `h-[300px]`/scroll interne
  désormais conditionnelle (Crescendo/Fractionné seulement, plus Constant
  qui n'en a jamais eu besoin).
- **`StatsView.jsx`, état vide** — hauteur calée sur la carte de l'étape 1
  du wizard ; écart `space-y-8`/`space-y-4` avec l'en-tête corrigé
  (conditionnel à l'état vide, la vue remplie garde `space-y-8`).
- **5 nouvelles habitudes de travail actées** dans
  `CLAUDE-SANDBOX-VERIFICATION.md` (section en tête) — cadrer l'utilité de
  chaque demande, format de livraison (jamais de zip), vérifier le test
  miroir de chaque fichier touché, `grep` avant de modifier un texte
  visible, généraliser/auditer spontanément à chaque bug trouvé.
- ⚠️ **Le fix `min-w-0` (dernier correctif de la session) n'a PAS été
  vérifié en conditions réelles** — priorité n°1 de la prochaine session.
