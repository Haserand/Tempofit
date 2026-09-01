import { X, Share2, MessageCircle, ExternalLink, Copy, Loader2, Download } from 'lucide-react';
import { ICON_BUTTON_ROUNDING } from '../../layout/iconButtonLayout';
import { useShareImage } from '../../contexts/ShareImageContext';
import ModalShell from '../shared/ModalShell';
import ModalCloseButton from '../shared/ModalCloseButton';

/**
 * ShareModal — partage d'une playlist/routine (lien copié, réseaux sociaux,
 * e-mail, partage natif du téléphone/OS si disponible). Extrait de App.jsx
 * (voir CustomActivityModal.jsx pour le contexte de cette série
 * d'extractions).
 *
 * ⚠️ RESTAURÉ (31/07) — ce fichier était devenu, par accident, une copie
 * EXACTE de SearchModal.jsx (même contenu, même nom de fonction exportée),
 * cassant totalement le partage dans toute l'app : `App.jsx` passe
 * `isShareModalOpen`/`shareData`/etc., mais le code (celui de SearchModal)
 * attendait `isSearchModalOpen`/`closeSearchModal`/etc. — jamais fournis,
 * donc `if (!isSearchModalOpen) return null` était TOUJOURS vrai. Le
 * bouton "Partager" ne faisait donc plus rien de visible, nulle part,
 * probablement depuis un commit du 25/07 (dernier commit GitHub validé
 * avant la casse : `e128533`). Contenu ci-dessous récupéré depuis ce
 * commit, avec seulement 2 classes Tailwind v3 obsolètes mises à jour vers
 * la convention v4 déjà en place partout ailleurs dans le projet
 * (`backdrop-blur-sm` → `backdrop-blur-xs` ; retrait de
 * `animate-in fade-in duration-200`, qui dépendait du plugin
 * `tailwindcss-animate`, jamais installé dans ce projet — ces classes
 * n'avaient donc jamais eu d'effet réel).
 *
 * RETOUR DIRECT ("insérer le bilan image directement dans l'option de
 * partage, avec une croix pour le retirer") — le Bilan Visuel de Séance
 * (voir PlaylistDetailView.jsx, `startBackgroundImageGeneration`) se génère
 * maintenant TOUT SEUL en arrière-plan dès l'ouverture du menu "Partager",
 * PAS ICI : cette modale se contente d'en afficher l'état
 * (`summaryImageStatus`) et l'aperçu une fois prêt, sans jamais déclencher ni
 * bloquer sur la génération elle-même — le partage texte/lien reste
 * utilisable immédiatement, que l'image soit prête, en cours, ou en échec.
 * `summaryImage*`/`includeSummaryImage` lus via `useShareImage()` (21/08,
 * extraction ShareImageContext.jsx — venaient avant en props, prop-drillées
 * depuis App.jsx) ; TOUJOURS définis maintenant (jamais `undefined`), mais
 * ça ne change rien pour un partage de trophée (voir TrophiesView.jsx,
 * `handleShare('trophy', ...)`) : le garde-fou `shareData.type ===
 * 'playlist'` ci-dessous masque déjà cette section indépendamment de la
 * valeur de `summaryImageStatus`.
 */
export default function ShareModal({
  theme,
  isShareModalOpen, onClose, shareData,
  shareNative, shareToWhatsApp, shareToTwitter, shareToFacebook,
  copyToClipboard, shareViaEmail,
  shareImageFile,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;
  const { summaryImageStatus, summaryImageFile, summaryImagePreviewUrl, includeSummaryImage, setIncludeSummaryImage } = useShareImage();

  if (!isShareModalOpen || !shareData) return null;

  const hasReadyImage = shareData.type === 'playlist' && summaryImageStatus === 'ready' && includeSummaryImage && summaryImageFile;

  // Partage natif AVEC l'image si elle est prête et incluse (le fichier
  // ET le texte partent ensemble via shareImageFile — voir useShare.js) —
  // sinon repli sur le partage texte/lien classique (`shareNative`), comme
  // avant ce chantier. `shareImageFile` ne ferme pas la modale elle-même
  // (appelée aussi ailleurs sans modale de partage ouverte, voir
  // PlaylistDetailView.jsx) — fermée ici explicitement après.
  const handleNativeShare = async () => {
    if (hasReadyImage) {
      await shareImageFile(summaryImageFile, shareData.title, shareData.text);
      onClose();
    } else {
      shareNative();
    }
  };

  return (
    <ModalShell onClose={() => onClose()} theme={theme}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Share2 className={textColorClass}/>
            <span>Partager</span>
          </h3>
          <ModalCloseButton onClick={() => onClose()} />
        </div>
        {/* Texte de partage — RETOUR DIRECT (01/09, capture d'écran) : "la
            localisation du texte serait pas meilleure à gauche de l'image
            dans un encart dédié plutôt qu'au-dessus, là ça isole quand même
            vachement le visuel ?" — vérifié avant d'y toucher : l'image du
            Bilan Visuel est un format PORTRAIT (1080×1920, voir
            PlaylistDetailView.jsx, `scale: 2.7` sur une carte 400px de
            large) donc affichée à `h-28` (112px), elle ne fait qu'environ
            63px de large — un petit rectangle qui flottait seul dans sa
            ligne, avec tout le reste de la largeur de la modale vide à
            côté, pendant que le texte occupait sa PROPRE ligne pleine
            largeur juste au-dessus. D'où le fractionnement en 2 cas :
            avec image prête, texte + vignette dans UN SEUL encart flex
            (`flex gap-3`, image à gauche, texte à droite, centré
            verticalement) — sans image (chargement, trophée, ou image
            retirée), le texte redevient pleine largeur comme avant. Le
            bouton "×" (retrait de l'image) reste positionné pareil
            (`absolute -top-2 -right-2` sur le conteneur RELATIF de
            l'image, pas de l'encart entier) — fonctionne à l'identique en
            flex qu'en `inline-block`. */}
        {hasReadyImage ? (
          <div className={`flex gap-3 p-3 rounded-xl mb-4 text-sm ${inputBg} border ${inputBorder} ${textHighlight}`}>
            <div className="relative shrink-0">
              <img src={summaryImagePreviewUrl} alt="Bilan visuel de la séance" className={`h-28 rounded-lg border ${inputBorder} object-cover`} />
              <button
                onClick={() => setIncludeSummaryImage(false)}
                title="Retirer le bilan visuel"
                className={`absolute -top-2 -right-2 w-6 h-6 ${ICON_BUTTON_ROUNDING} bg-gray-900 text-white flex items-center justify-center shadow-md hover:bg-red-500 transition-colors`}
              >
                <X size={14}/>
              </button>
            </div>
            <div className="flex items-center">{shareData.text}</div>
          </div>
        ) : (
          <div className={`p-4 rounded-xl mb-4 text-sm ${inputBg} border ${inputBorder} ${textHighlight}`}>
            {shareData.text}
          </div>
        )}

        {/* État "en cours" du Bilan Visuel de Séance — génération en
            arrière-plan (voir la docstring de tête de fichier), jamais
            déclenchée depuis cette modale. Le 4e état (error) reste
            silencieux (voir startBackgroundImageGeneration,
            PlaylistDetailView.jsx — c'est un bonus discret, pas une action
            explicitement demandée). Reste un bloc à part, SOUS le texte
            (pas fusionné avec lui comme le cas "prêt" ci-dessus) : il n'y a
            pas encore d'image à ce stade, rien à mettre côte-à-côte. */}
        {shareData.type === 'playlist' && summaryImageStatus === 'loading' && (
          <div className={`flex items-center gap-2 mb-4 text-xs font-semibold ${textMuted}`}>
            <Loader2 size={14} className="animate-spin"/> Préparation du bilan visuel...
          </div>
        )}

        {/* RETOUR DIRECT (01/09, capture d'écran annotée) : "le bouton
            télécharger le visuel devrait pas être juste en dessous du dit
            visuel ?" — jusqu'ici positionné après "Copier le lien" comme
            repli manuel pour WhatsApp/X/Facebook plus bas (ces liens
            n'ouvrent qu'une URL, impossible d'y joindre un fichier
            automatiquement — limite technique de ces plateformes, pas de
            ce code), MAIS "Copier le lien" (gros bouton plein, très
            visible) s'était entre-temps intercalé entre ce lien et les
            tuiles WhatsApp/X/Facebook (voir commentaire retiré du 14/08 :
            "juste SOUS les tuiles ... ci-dessus", plus vrai depuis) —
            cassant la proximité qui justifiait sa position. Remonté ici,
            juste sous le visuel lui-même : reste tout aussi accessible
            avant de cliquer WhatsApp/X/Facebook plus bas qu'après. */}
        {hasReadyImage && (
          <a
            href={summaryImagePreviewUrl} download="tempofit-bilan-de-seance.png"
            className={`w-full py-3 mb-4 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-2`}
          >
            <Download size={16}/> Télécharger le visuel
          </a>
        )}

        {/* Boutons directs vers les réseaux les plus courants — tuiles discrètes
            (fond léger + accent coloré) plutôt que des blocs pleins saturés qui se
            battaient visuellement entre eux. Le partage natif (menu "Partager"
            habituel du téléphone/OS, quand disponible) est intégré comme une tuile
            de plus, pas un gros bouton séparé qui dominait tout le reste. */}
        <div className={`grid gap-2 mb-4 ${typeof navigator !== 'undefined' && navigator.share ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={handleNativeShare} title={hasReadyImage ? "Partager le visuel (Story, Instagram, WhatsApp...)" : "Autres options"} className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-surface-hover transition-colors`}>
              <Share2 size={18} className={textColorClass}/>
              <span className={`text-[11px] font-bold text-center leading-tight ${textMuted}`}>{hasReadyImage ? 'Story / IG' : 'Plus'}</span>
            </button>
          )}
          <button onClick={shareToWhatsApp} title="WhatsApp" className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors">
            <MessageCircle size={18} className="text-[#25D366]"/>
            <span className="text-[11px] font-bold text-[#25D366]">WhatsApp</span>
          </button>
          <button onClick={shareToTwitter} title="X (Twitter)" className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-surface-hover transition-colors`}>
            <span className={`text-base font-black leading-none ${textHighlight}`}>𝕏</span>
            <span className={`text-[11px] font-bold ${textMuted}`}>X</span>
          </button>
          <button onClick={shareToFacebook} title="Facebook" className="flex flex-col items-center gap-1.5 py-3.5 rounded-xl bg-[#1877F2]/10 hover:bg-[#1877F2]/20 border border-[#1877F2]/30 transition-colors">
            <ExternalLink size={18} className="text-[#1877F2]"/>
            <span className="text-[11px] font-bold text-[#1877F2]">Facebook</span>
          </button>
        </div>

        <button onClick={copyToClipboard} className={`w-full py-4 text-white font-bold rounded-xl shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 ${bgAccentClass}`}>
          <Copy size={18}/> Copier le lien
        </button>

        <button onClick={shareViaEmail} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-2`}>
          <MessageCircle size={16}/> Envoyer par e-mail
        </button>
    </ModalShell>
  );
}
