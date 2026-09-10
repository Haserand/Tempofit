### Pseudos réservés
- `src/utils/username.js` (`isReservedUsername`, garde-fou UX) **et** la contrainte SQL `profiles_username_not_reserved` (`supabase-schema.sql`) existent tous les deux et doivent rester identiques — c'est la contrainte SQL qui constitue la vraie garantie de sécurité.
- Exception unique : `tempofit_admin`, comparaison stricte sensible à la casse (contrairement au reste du motif, insensible à la casse).

### Profil vitrine `@tempofit_officiel`
- Jamais stocké en base, entièrement reconstruit côté client (`src/data/officialVitrineProfile.js`) — accessible même sans compte, court-circuite le Login Wall des profils volontairement. Le pseudo est structurellement bloqué à l'inscription par le système de pseudos réservés ci-dessus.

### Login Wall des profils publics
- Double verrou : droits d'exécution SQL retirés à `anon` sur `get_public_profile_summary`/`search_public_profiles` (`revoke ... from anon`) **et** vérification explicite `auth.uid() is null` en tout premier dans chaque fonction — voir `supabase-schema.sql`.

### Trophées à paliers (Garmin-style) — préférer un type générique à un flag booléen ad-hoc
- Constat (01/09, après avoir ajouté 10 paliers à 5 métriques d'un coup) : `checkTrophies` (`useUserStats.js`) gère déjà 4 types de `requirement` de façon GÉNÉRIQUE (`total`/`naughty`/`data`/`replace` — compare directement un compteur numérique existant à un seuil `count`). Ajouter un nouveau palier à l'une de ces 4 métriques = UNE ligne dans `TROPHIES_DATA` (appConfig.js), zéro autre fichier touché.
- À l'inverse, les métriques posées via `type: 'custom'` + un flag booléen ad-hoc (`has100km`, `hasReceivedClone`...) n'ont AUCUN mécanisme de seuil réutilisable — chaque palier futur demande un nouveau flag posé à la main, au même endroit précis que le précédent (`usePlaylistCompletions.js`/`StatsView.jsx`), dans CHAQUE fichier qui produit cette donnée.
- **Conséquence pour toute future métrique susceptible d'avoir plusieurs paliers un jour** (même si un seul palier suffit aujourd'hui) : si le compteur sous-jacent existe déjà comme un nombre simple sur `userStats` (pas un booléen), préférer étendre `checkTrophies` avec un nouveau type générique (`if (t.requirement.type === 'xxx' && newStats.xxxCount >= t.requirement.count) return true;`) plutôt qu'un flag `hasXxx` à seuil fixe codé en dur. Coût initial identique, mais élimine tout le travail de câblage pour CHAQUE palier futur. Pas appliqué rétroactivement à `has100km`/`hasReceivedClone` lors de ce chantier (minimal-diff préféré à une réarchitecture pour un ajout de fonctionnalité) — mais à faire dès la PROCHAINE fois qu'une métrique de ce type reçoit un 2e palier.
