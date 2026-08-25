En cherchant à diagnostiquer une "barre quasi invisible" trop subtile pour
être tranchée à la lecture du code seul (artefact de rendu : un coin de
carte arrondi touchant à 0px près une ligne de séparation du wizard
générateur), tentative de `npm install` — **succès**, alors que
`CLAUDE-SANDBOX-VERIFICATION.md` affirmait depuis l'origine du projet que
le bac à sable n'avait aucun accès réseau. Corrigé aussitôt (titre +
intro du fichier, nouvelle section §5ter). Un vrai serveur `vite` + un
navigateur Playwright permettent désormais de mesurer des positions RÉELLES
(`getBoundingClientRect`) plutôt que de deviner depuis les classes
Tailwind. Immédiatement après, `npx vitest run` testé sur la suite
ENTIÈRE : **113 fichiers, 1506 tests, tous passent** — "les tests
passent" n'a donc plus besoin de rester une simple lecture attentive
quand le temps le permet. Limite qui reste réelle : ce navigateur n'a
toujours aucun accès réseau EXTERNE (pas de vrai Supabase/Deezer), donc
seulement utilisable pour des écrans qui fonctionnent en state local.
⚠️ Affirmation ci-dessus SUPPOSÉE au moment où elle a été écrite le
21/08, PAS testée — corrigé le lendemain (22/08, retour direct de
l'utilisateur : "tu en es sûr ?") : `curl`/le navigateur Playwright
essayant de charger `api.deezer.com`/`supabase.co` renvoient tous les
deux `403 Host not in allowlist`, message identique dans les 2 cas —
confirmé pour de vrai cette fois, pas juste déduit de la configuration
réseau documentée. Voir `CLAUDE-SANDBOX-VERIFICATION.md`, §5ter, pour le
détail complet du test.

Correctif du bug d'origine (coin de carte touchant la ligne du pied de
page, `GeneratorWizard.jsx`) : 1er réflexe (ajouter un `pb-3`, 12px de
plancher) fonctionnait mais coûtait de la hauteur — retour direct
immédiat avec 2 nouvelles captures : "pourtant j'ai du scroll, j'aurais
plus supprimé ta ligne qui sert à rien". Meilleure solution retenue :
retirer la ligne (`border-t border-gray-100 dark:border-gray-800`)
elle-même plutôt que lui laisser de la place — déjà quasi invisible,
donc rien perdu visuellement, et plus rien à toucher pour l'artefact.
Gain NET de hauteur par rapport à l'état d'avant tout ce chantier (0px
ajouté, contre +12px avec le 1er correctif). Revérifié en conditions
réelles sur le pire cas (mode Crescendo, viewports 800px et 700px) : 0px
de dépassement de page.

### 22/08 — En-tête de playlist : badge "Lecture seule" puis Corbeille mal alignés avec le badge BPM — 1re vérification erronée corrigée

Retour direct avec capture annotée : le badge "Lecture seule" (`Lock`)
utilisait un décalage FIXE (`right-4`, 16px) qui ignorait le vrai padding
de la carte (`p-6 md:p-8`) — corrigé en `right-6 md:right-8`, vérifié à
0px d'écart en conditions réelles (serveur de dev + Playwright).

Retour direct suivant, MÊME constat sur le bouton Corbeille (cas
`isSaved`, Globe+Trash2 au lieu de Lock) — **1er diagnostic erroné** :
mesuré la boîte cliquable du bouton (`button.getBoundingClientRect()`),
trouvé 0px d'écart, conclu à tort que le correctif précédent suffisait
déjà. Contesté à raison par l'utilisateur ("menteur") avec le fichier
exact + une nouvelle capture. Reprise rigoureuse : mesuré le SVG de
l'icône LUI-MÊME, pas son bouton englobant → 8px d'écart réel. Cause :
Trash2/Globe sont des icônes seules (14px) centrées dans un bouton de
30px (`p-2`, padding invisible pour la zone de survol) — contrairement au
badge BPM ou au badge Lock, qui ont une bordure/un fond VISIBLE remplissant
toute leur boîte. Corrigé (`-mr-2` sur le bouton Corbeille, annule
exactement son padding droit), revérifié sur le bon repère cette fois
(SVG, pas bouton) : 0px pile. Leçon ajoutée à `CLAUDE-SANDBOX-
VERIFICATION.md` (§5quater) : pour un alignement visuel, toujours mesurer
le glyphe/contenu visible réel, jamais seulement la boîte du conteneur
cliquable.

### 22/08 — Petits retouches finales

- `MiniPlayerBar.jsx` : préfixe "Playlist :" retiré devant le nom de la
  playlist (retour direct — redondant, le nom suit déjà et le tooltip/la
  ligne "Titre X/Y" en dessous donnent déjà le contexte).
- Suggestion de mettre les stats sportives du profil dans l'espace vide
  de l'en-tête (à côté de l'avatar) discutée et écartée : cette section
  n'est pas spécifique à la vitrine (vraie fonctionnalité pour tous les
  profils), et un 2e bloc symétrique existe ("Statistiques Mode Intime")
  qui ne pourrait pas suivre dans le même espace réduit — incohérence
  potentielle si un profil affiche les deux. Laissé tel quel après
  discussion, décision explicitement actée comme "pas du pinaillage".
