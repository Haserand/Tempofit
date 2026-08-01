#!/bin/bash
# Réorganise tests/ en sous-dossiers miroir de src/ — à lancer UNE FOIS,
# à la racine du dépôt (là où se trouve le dossier tests/).
#
# Utilise `git mv` si le dépôt est suivi par git (garde l'historique de
# chaque fichier), sinon retombe sur un simple `mv`.
#
# 3 fichiers volontairement JAMAIS déplacés : fileExtensionTrap.test.js,
# noDuplicateFiles.test.js, tailwindConcatTrap.test.js — ce sont des
# garde-fous qui scannent tout le projet via leur propre position
# (__dirname), pas des tests d'un composant précis. Les déplacer casserait
# leur propre logique de scan.

set -e

if [ ! -d "tests" ]; then
  echo "Erreur : lancez ce script à la racine du dépôt (là où se trouve tests/)."
  exit 1
fi

USE_GIT=false
if git rev-parse --is-inside-work-tree &>/dev/null; then
  USE_GIT=true
  echo "Dépôt git détecté — utilisation de 'git mv' (historique préservé)."
else
  echo "Pas de dépôt git détecté ici — utilisation de 'mv' classique."
fi

move() {
  local src="tests/$1"
  local dest="tests/$2/$1"
  if [ ! -f "$src" ]; then
    echo "  ⚠ absent, ignoré : $src"
    return
  fi
  if [ "$USE_GIT" = true ]; then
    git mv "$src" "$dest"
  else
    mv "$src" "$dest"
  fi
}

mkdir -p tests/views tests/views/PlaylistDetail tests/modals tests/shared tests/contexts tests/hooks tests/engine tests/utils tests/config

echo "Déplacement des fichiers..."

for f in AthleticProfilePanel DiscoverView FavoritesView GeneratorView GeneratorWizard PlaylistCard PlaylistDetailView PlaylistsView ProfileView RoutinesView SettingsView Templatecard; do
  move "$f.test.jsx" views
done
for f in PlaylistHeader PlaylistCharts TrackItem TrackList; do
  move "$f.test.jsx" views/PlaylistDetail
done
for f in AuthModal CustomActivityModal Importsharedplaylistmodal PendingNavigationModal Pendingunsavemodal Savingroutinemodal SearchModal SearchUsersModal ShareModal; do
  move "$f.test.jsx" modals
done
for f in Audioprogressbar Completionslist Dualrangeslider Errorboundary Globalstatssharecard GuestModeBar ModalContainer Sidebar Topcompletiondate ViewHeader; do
  move "$f.test.jsx" shared
done
move "AuthContext.test.jsx" contexts
for f in useShare useSyncedCollection; do
  move "$f.test.js" hooks
done
for f in genreWeightDeviation workoutDataEngine searchEngine musicEngine fetchInBatches; do
  move "$f.test.js" engine
done
for f in numberInput favoritesNormalize coverArt format playlistShareCode; do
  move "$f.test.js" utils
done
for f in appConfig athleticZones musicCatalog; do
  move "$f.test.js" config
done

echo "Correction des chemins d'import relatifs (../src -> ../../src ou ../../../src)..."

# Fichiers à 1 niveau (tests/categorie/Fichier.test.jsx)
find tests -mindepth 2 -maxdepth 2 \( -name "*.test.jsx" -o -name "*.test.js" \) -print0 \
  | xargs -0 sed -i.bak "s#'\.\./src#'../../src#g" 2>/dev/null || \
  find tests -mindepth 2 -maxdepth 2 \( -name "*.test.jsx" -o -name "*.test.js" \) -print0 \
  | xargs -0 sed -i "s#'\.\./src#'../../src#g"

# Fichiers à 2 niveaux (tests/views/PlaylistDetail/Fichier.test.jsx)
find tests -mindepth 3 -maxdepth 3 \( -name "*.test.jsx" -o -name "*.test.js" \) -print0 \
  | xargs -0 sed -i.bak "s#'\.\./src#'../../../src#g" 2>/dev/null || \
  find tests -mindepth 3 -maxdepth 3 \( -name "*.test.jsx" -o -name "*.test.js" \) -print0 \
  | xargs -0 sed -i "s#'\.\./src#'../../../src#g"

# Nettoyage des .bak laissés par sed sur macOS (BSD sed exige un suffixe
# après -i, contrairement à GNU sed sous Linux — le -i.bak ci-dessus gère
# les deux, mais laisse des .bak sur macOS qu'il faut retirer).
find tests -name "*.bak" -delete

echo ""
echo "Terminé. Vérification rapide :"
echo "  - fichiers restés à la racine de tests/ (attendu : les 3 garde-fous) :"
ls tests/*.test.* 2>/dev/null
echo ""
echo "Lancez maintenant vos tests (npm run test:run) pour confirmer que tout passe encore."
