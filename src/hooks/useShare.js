import { useState } from 'react';
import { formatDuration } from '../utils/format';

/**
 * useShare — regroupe l'état et la logique de la modale de partage
 * (playlist ou trophée débloqué) : préparation du texte à partager, et les
 * différents canaux (presse-papier, partage natif OS, WhatsApp, Twitter,
 * Facebook, email).
 *
 * `showToast` est une dépendance externe (définie dans App.jsx) passée en
 * paramètre, utilisée uniquement par `copyToClipboard` pour confirmer la copie.
 */
export function useShare(showToast) {
  const [shareData, setShareData] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Prépare le contenu à partager (playlist ou trophée) et ouvre la modale de partage.
  const handleShare = (type, item) => {
    if (type === 'playlist') {
      setShareData({
        type: 'playlist', title: item.name,
        text: `Je viens de générer la session musicale parfaite de ${formatDuration(item.totalDuration)} pour mon entraînement sur TempoFit ! 💪🎧`,
        url: window.location.href
      });
    } else if (type === 'trophy') {
      setShareData({
        type: 'trophy', title: item.name,
        text: `J'ai débloqué le trophée "${item.name}" ${item.icon} sur TempoFit ! 🔥 Rejoins-moi !`,
        url: window.location.href
      });
    }
    setIsShareModalOpen(true);
  };

  // Copie le texte de partage dans le presse-papier via l'ancienne API
  // execCommand (fallback compatible même sans HTTPS/contexte sécurisé,
  // contrairement à navigator.clipboard).
  const copyToClipboard = () => {
    if (!shareData) return;
    const textToCopy = `${shareData.text} ${shareData.url}`;
    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.top = "0"; textArea.style.left = "0"; textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); showToast("Lien copié dans le presse-papier !"); } catch (err) {}
    document.body.removeChild(textArea);
    setIsShareModalOpen(false);
  };

  // Partage natif du téléphone/OS (menu "Partager" habituel avec toutes les
  // apps installées) — disponible sur mobile et certains navigateurs desktop
  // récents, pas partout. D'où les boutons de partage direct ci-dessous en
  // complément, qui fonctionnent eux partout puisqu'ils ouvrent juste une URL classique.
  const shareNative = async () => {
    if (!shareData || !navigator.share) return;
    try {
      await navigator.share({ title: shareData.title, text: shareData.text, url: shareData.url });
      setIsShareModalOpen(false);
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
  // exportSessionSummaryImage) : `navigator.share({ files: [...] })` n'est
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

  return {
    shareData, setShareData,
    isShareModalOpen, setIsShareModalOpen,
    handleShare, copyToClipboard, shareNative,
    shareToWhatsApp, shareToTwitter, shareToFacebook, shareViaEmail,
    shareImageFile,
  };
}
