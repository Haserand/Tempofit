import { formatDuration } from '../utils/format';
import { encodePlaylistForSharing } from '../utils/playlistShareCode';
import { copyTextToClipboard } from '../utils/clipboard';
import { useModalContext } from '../contexts/ModalContext';

/**
 * useShare — regroupe l'état et la logique de la modale de partage
 * (playlist ou trophée débloqué) : préparation du texte à partager, et les
 * différents canaux (presse-papier, partage natif OS, WhatsApp, Twitter,
 * Facebook, email).
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre, utilisée uniquement par `copyToClipboard` pour confirmer la copie.
 *
 * `shareData`/`isShareModalOpen` (chantier "centraliser les modales", 25/07)
 * viennent maintenant de `ModalContext` (`modalData`/`activeModal === 'SHARE'`)
 * plutôt que de state local — candidat naturel, contrairement à
 * `editingRoutine` (useRoutines.js) : `shareData` n'est JAMAIS relu ni modifié
 * une fois posé par `handleShare`, seulement lu par ShareModal.jsx jusqu'à sa
 * fermeture — un vrai payload figé, pas un formulaire actif. Toujours
 * retournés sous les mêmes noms qu'avant pour que App.jsx/ShareModal n'aient
 * rien d'autre à changer côté lecture.
 */
export function useShare(showToast) {
  const { activeModal, modalData, openModal, closeModalIfActive } = useModalContext();
  const isShareModalOpen = activeModal === 'SHARE';
  const shareData = isShareModalOpen ? modalData : null;

  // Prépare le contenu à partager (playlist ou trophée) et ouvre la modale de partage.
  const handleShare = (type, item) => {
    let data;
    if (type === 'playlist') {
      // RETOUR DIRECT ("absurde de dire 'je viens de générer' pour une
      // séance déjà faite") — `handleShare('playlist', ...)` n'est appelé
      // que depuis PlaylistDetailView.jsx, mais cette page sert aussi bien à
      // une playlist FRAÎCHEMENT générée (pas encore faite) qu'à une séance
      // DÉJÀ réalisée une ou plusieurs fois (cadenas visible sur la page,
      // `completions` non vide) — même signal que `isLocked` déjà utilisé là-bas
      // pour ce même statut, recalculé ici à l'identique pour garder ce hook
      // autonome (ne dépend que de l'objet playlist reçu).
      const isCompleted = !!(item.completions && item.completions.length > 0);
      const text = isCompleted
        ? `Je viens de terminer une séance de ${formatDuration(item.totalDuration)} sur TempoFit ! 💪🎧`
        : `Je viens de générer la session musicale parfaite de ${formatDuration(item.totalDuration)} pour mon entraînement sur TempoFit ! 💪🎧`;
      // RETOUR DIRECT ("rendre le lien de partage réellement importable") —
      // avant, `url: window.location.href` pointait juste vers la page
      // courante de l'app, TOUJOURS la même quelle que soit la playlist
      // partagée (aucun routage par URL dans cette app — `view`/
      // `currentPlaylist` sont de simples state React, jamais reflétés dans
      // l'adresse). Qui ouvrait ce lien retombait sur l'accueil, sans aucun
      // moyen de savoir QUELLE playlist avait été partagée. Encode
      // maintenant la playlist elle-même dans l'URL (voir
      // playlistShareCode.js) — l'app, au chargement, détecte ce paramètre
      // et propose l'ajout direct (voir App.jsx). Repli sur l'ancien lien
      // simple si l'encodage échoue (jamais bloquant pour le partage).
      const code = encodePlaylistForSharing(item);
      const url = code ? `${window.location.origin}${window.location.pathname}?import=${code}` : window.location.href;
      data = { type: 'playlist', title: item.name, text, url };
    } else if (type === 'trophy') {
      data = {
        type: 'trophy', title: item.name,
        text: `J'ai débloqué le trophée "${item.name}" ${item.icon} sur TempoFit ! 🔥 Rejoins-moi !`,
        url: window.location.href
      };
    }
    openModal('SHARE', data);
  };

  // Copie le texte de partage dans le presse-papier — délègue la mécanique
  // presse-papier elle-même à `copyTextToClipboard` (08/08,
  // `src/utils/clipboard.js`) plutôt que de la garder dupliquée ici.
  //
  // HISTORIQUE — cette logique (navigator.clipboard en priorité, repli
  // execCommand SI indisponible, vérification de sa valeur de retour) a
  // été centralisée le 08/08 après que l'utilisateur a repéré que le
  // projet avait DEUX implémentations différentes de "copier dans le
  // presse-papier" ("faut pas que tout soit le même ?") — celle-ci
  // (déjà robuste, corrigée le 31/07 : avant, cette fonction n'utilisait
  // QUE `execCommand`, jamais `navigator.clipboard`, ET affichait un
  // toast de succès sans jamais vérifier la valeur de retour
  // d'`execCommand('copy')`, qui peut renvoyer `false` sans lever
  // d'exception dans la plupart des navigateurs) ET celle, plus fragile,
  // de `copyRedirectUri` (SettingsView.jsx). Reste ici tout ce qui est
  // SPÉCIFIQUE à ce hook (construction de `textToCopy` depuis
  // `shareData`, fermeture de la modale, message exact du toast) — seule
  // la mécanique presse-papier elle-même est désormais partagée.
  const copyToClipboard = async () => {
    if (!shareData) return;
    const textToCopy = `${shareData.text} ${shareData.url}`;
    const succeeded = await copyTextToClipboard(textToCopy);
    if (succeeded) showToast("Lien copié dans le presse-papier !");
    else showToast("Impossible de copier le lien automatiquement — copie-le manuellement.", 'error');
    // Scopé à 'SHARE' (19/08, check-up global) — l'écriture presse-papier
    // ci-dessus est asynchrone (`await`) : sans ce nom, une AUTRE modale
    // ouverte par l'utilisateur pendant cette attente se fermerait par
    // erreur. Voir la docstring de `closeModalIfActive` dans ModalContext.jsx.
    closeModalIfActive('SHARE');
  };

  // Partage natif du téléphone/OS (menu "Partager" habituel avec toutes les
  // apps installées) — disponible sur mobile et certains navigateurs desktop
  // récents, pas partout. D'où les boutons de partage direct ci-dessous en
  // complément, qui fonctionnent eux partout puisqu'ils ouvrent juste une URL classique.
  const shareNative = async () => {
    if (!shareData || !navigator.share) return;
    try {
      await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
      // Scopé à 'SHARE' (19/08, check-up global) — voir le commentaire
      // équivalent dans copyToClipboard ci-dessus, même raisonnement mais
      // fenêtre d'attente plus longue ici (boîte de dialogue système de
      // partage de l'OS, peut rester ouverte un moment).
      closeModalIfActive('SHARE');
    } catch (e) {
      // L'utilisateur a annulé le partage, ou l'API a échoué : on ne fait rien de spécial.
    }
  };

  const shareToWhatsApp = () => {
    if (!shareData) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`, '_blank');
  };
  const shareToTwitter = () => {
    if (!shareData) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`, '_blank');
  };
  const shareToFacebook = () => {
    if (!shareData) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`, '_blank');
  };
  const shareViaEmail = () => {
    if (!shareData) return;
    window.location.href = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(shareData.text + ' ' + shareData.url)}`;
  };

  // Partage d'un FICHIER (image) via le Web Share API — différent de
  // `shareNative` ci-dessus, qui ne partage qu'un texte/lien. Ajouté pour le
  // Bilan Visuel de Séance (voir PlaylistDetailView.jsx,
  // generateSummaryImageFile, et ShareModal.jsx qui l'appelle une fois
  // l'image prête) : `navigator.share({ files: [...] })` n'est
  // supporté que sur un sous-ensemble de navigateurs/OS (essentiellement
  // mobile) — `navigator.canShare({ files })` permet de le vérifier AVANT
  // d'essayer, plutôt que de laisser `.share()` échouer silencieusement.
  // Repli explicite en téléchargement direct si non supporté (desktop la
  // plupart du temps) : l'utilisateur récupère quand même l'image, à
  // partager lui-même ensuite.
  const canShareFiles = (files) => typeof navigator.canShare === 'function' && navigator.canShare({ files });

  const shareImageFile = async (file, title, text) => {
    if (canShareFiles([file])) {
      try {
        await navigator.share({ files: [file], title, text });
        return 'shared';
      } catch (e) {
        // Partage annulé par l'utilisateur (ou échec) — pas une erreur à
        // signaler, juste "rien ne s'est passé".
        return 'cancelled';
      }
    }
    // Repli : téléchargement direct — au moins l'utilisateur récupère
    // l'image, même sans le menu de partage natif (desktop, ou navigateur
    // mobile qui ne supporte pas encore le partage de fichiers).
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name || 'tempofit-bilan-de-seance.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (showToast) showToast("Partage direct non disponible sur ce navigateur — image téléchargée à la place.");
    return 'downloaded';
  };

  // Partage DIRECT vers une Story Instagram (iOS uniquement) — RETOUR DIRECT
  // (01/09, capture d'écran : "es-tu sûr que les boutons de partage vers les
  // réseaux sociaux ouvrent bien les réseaux sociaux ? ça ne me semble pas
  // être le cas pour Instagram"). Confirmé à raison : le bouton "Story / IG"
  // n'appelait jusqu'ici QUE `shareImageFile`/`shareNative` (partage
  // générique de l'OS, voir plus haut) — aucune intégration Instagram
  // réelle, juste l'espoir qu'Instagram apparaisse dans le sélecteur d'apps
  // du téléphone. Contrairement à WhatsApp/Twitter/Facebook (liens web
  // officiels documentés, fiables), Instagram n'expose PAS d'URL de partage
  // web classique — mais expose un schéma d'URL dédié aux Stories,
  // documenté par Meta, UNIQUEMENT sur iOS : `instagram-stories://share`,
  // qui lit l'image à partager depuis le presse-papier général du système.
  //
  // ⚠️ LIMITE HONNÊTE — jamais testé sur un vrai appareil iOS (aucun
  // disponible dans ce bac à sable, et un navigateur piloté par Playwright
  // ne peut pas simuler un vrai passage de main vers l'app Instagram
  // installée) : ce qui suit est une implémentation basée sur la
  // documentation Meta et des retours d'expérience publics d'autres sites
  // ayant déjà ce bouton (Spotify Wrapped, Strava...), PAS une vérification
  // de bout en bout faite dans ce projet. À reconfirmer sur un vrai iPhone
  // avec Instagram installé avant de considérer ce chantier clos.
  //
  // Mécanique : (1) écrit l'image dans le presse-papier GÉNÉRAL via
  // `navigator.clipboard.write()` (API standard, pas une astuce interne
  // à Instagram) — Instagram, une fois ouvert via ce schéma d'URL, va la
  // relire automatiquement s'il n'y trouve aucune des clés spéciales
  // `com.instagram.sharedSticker.*` (celles-ci ne sont accessibles qu'aux
  // apps natives via `UIPasteboard`, pas au web — donc hors de portée ici,
  // le simple presse-papier standard est le seul levier disponible côté
  // web). (2) navigue vers `instagram-stories://share` — si Instagram
  // n'est pas installé, cette navigation échoue SILENCIEUSEMENT (aucune
  // erreur JS levée, la page reste simplement affichée). (3) détection
  // best-effort de cet échec silencieux : si la page est ENCORE visible
  // après un court délai, on considère que ça n'a pas marché et on
  // bascule sur le partage générique (`shareImageFile`) — pattern
  // standard pour ce type de lien profond, mais PAS garanti à 100% (aucune
  // API web ne confirme directement l'échec d'ouverture d'un schéma d'URL
  // personnalisé). `source_application` laissé à une valeur générique : un
  // vrai identifiant Meta for Developers n'est pas configuré pour ce
  // projet (voir `.env.example`, rien de tel n'y figure) — sans lui,
  // Instagram accepte quand même l'image du presse-papier d'après les
  // retours publics consultés, seule l'attribution affichée en moins.
  //
  // `fallbackShareFn` (paramètre, PAS `shareImageFile` fermé directement
  // sur cette fonction) — App.jsx enveloppe `shareImageFile` dans
  // `shareImageFileWithTrophy` (déclenche `checkTrophies` sur un partage
  // réussi, voir App.jsx) : appeler `shareImageFile` en dur ici court-
  // circuiterait ce trophée pour tout partage qui transite par CETTE
  // fonction (repli iOS raté, ou Android/desktop d'emblée). Le vrai
  // "repli" à utiliser doit donc venir de l'appelant (ShareModal.jsx,
  // via sa prop `shareImageFile` — déjà la version enveloppée).
  const shareToInstagramStories = async (file, title, text, fallbackShareFn) => {
    const fallback = fallbackShareFn || shareImageFile;
    const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS || !file || typeof navigator.clipboard?.write !== 'function' || typeof ClipboardItem === 'undefined') {
      // Schéma d'URL Instagram Stories inexistant hors iOS (documenté par
      // Meta), ou API presse-papier indisponible (contexte non sécurisé,
      // navigateur trop ancien) — repli direct, inutile de tenter.
      return fallback(file, title, text);
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ [file.type]: file })]);
    } catch (e) {
      // Écriture presse-papier refusée/impossible — repli direct, aucune
      // image à proposer à Instagram sans elle.
      return fallback(file, title, text);
    }

    // Repli après un court délai SI la page est toujours visible (voir
    // limite honnête ci-dessus) — nettoyé si la page se cache entre-temps
    // (signe que la navigation vers Instagram a probablement fonctionné).
    const fallbackTimer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        fallback(file, title, text);
      }
    }, 1500);
    document.addEventListener('visibilitychange', function onHide() {
      if (document.visibilityState === 'hidden') {
        clearTimeout(fallbackTimer);
        document.removeEventListener('visibilitychange', onHide);
      }
    });

    window.location.href = 'instagram-stories://share?source_application=tempofit';
    return 'attempted';
  };

  return {
    shareData,
    isShareModalOpen,
    handleShare, copyToClipboard, shareNative,
    shareToWhatsApp, shareToTwitter, shareToFacebook, shareViaEmail,
    shareImageFile, shareToInstagramStories,
  };
}
