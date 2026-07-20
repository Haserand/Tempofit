import { X, Share2, MessageCircle, ExternalLink, Copy, Loader2, Download } from 'lucide-react';

/**
 * ShareModal — partage d'une playlist/routine (lien copié, réseaux sociaux,
 * e-mail, partage natif du téléphone/OS si disponible). Extrait de App.jsx
 * (voir CustomActivityModal.jsx pour le contexte de cette série
 * d'extractions).
 *
 * RETOUR DIRECT ("insérer le bilan image directement dans l'option de
 * partage, avec une croix pour le retirer") — le Bilan Visuel de Séance
 * (voir PlaylistDetailView.jsx, `startBackgroundImageGeneration`) se génère
 * maintenant TOUT SEUL en arrière-plan dès l'ouverture du menu "Partager",
 * PAS ICI : cette modale se contente d'en afficher l'état
 * (`summaryImageStatus`) et l'aperçu une fois prêt, sans jamais déclencher ni
 * bloquer sur la génération elle-même — le partage texte/lien reste
 * utilisable immédiatement, que l'image soit prête, en cours, ou en échec.
 * `summaryImage*`/`includeSummaryImage` sont `undefined` pour un partage de
 * trophée (voir TrophiesView.jsx, `handleShare('trophy', ...)`) — toute cette
 * section reste alors masquée (pas de session à résumer en image).
 */
export default function ShareModal({
  theme,
  isShareModalOpen, setIsShareModalOpen, shareData,
  shareNative, shareToWhatsApp, shareToTwitter, shareToFacebook,
  copyToClipboard, shareViaEmail,
  shareImageFile,
  summaryImageStatus, summaryImageFile, summaryImagePreviewUrl,
  includeSummaryImage, setIncludeSummaryImage,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

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
      setIsShareModalOpen(false);
    } else {
      shareNative();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsShareModalOpen(false)}>
      <div className={"p-8 rounded-3xl w-full max-w-md shadow-2xl border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Share2 className={textColorClass}/>
            <span>Partager</span>
          </h3>
          <button onClick={() => setIsShareModalOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        <div className={`p-4 rounded-xl mb-4 text-sm ${inputBg} border ${inputBorder} ${textHighlight}`}>
          {shareData.text}
        </div>

        {/* Aperçu du Bilan Visuel de Séance — génération en arrière-plan (voir
            la docstring), jamais déclenchée depuis cette modale. 3 états
            visibles, le 4e (error) reste silencieux (voir
            startBackgroundImageGeneration, PlaylistDetailView.jsx — c'est un
            bonus discret, pas une action explicitement demandée). */}
        {shareData.type === 'playlist' && summaryImageStatus === 'loading' && (
          <div className={`flex items-center gap-2 mb-4 text-xs font-semibold ${textMuted}`}>
            <Loader2 size={14} className="animate-spin"/> Préparation du bilan visuel...
          </div>
        )}
        {hasReadyImage && (
          <div className="relative mb-4 inline-block">
            <img src={summaryImagePreviewUrl} alt="Bilan visuel de la séance" className={`h-28 rounded-xl border ${inputBorder} object-cover`} />
            <button
              onClick={() => setIncludeSummaryImage(false)}
              title="Retirer le bilan visuel"
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center shadow-md hover:bg-red-500 transition-colors"
            >
              <X size={14}/>
            </button>
          </div>
        )}

        {/* Boutons directs vers les réseaux les plus courants — tuiles discrètes
            (fond léger + accent coloré) plutôt que des blocs pleins saturés qui se
            battaient visuellement entre eux. Le partage natif (menu "Partager"
            habituel du téléphone/OS, quand disponible) est intégré comme une tuile
            de plus, pas un gros bouton séparé qui dominait tout le reste. */}
        <div className={`grid gap-2 mb-4 ${typeof navigator !== 'undefined' && navigator.share ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={handleNativeShare} title="Autres options" className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-surface-hover transition-colors`}>
              <Share2 size={18} className={textColorClass}/>
              <span className={`text-[11px] font-bold ${textMuted}`}>Plus</span>
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

        {/* Repli manuel pour WhatsApp/X/Facebook ci-dessus : ces liens n'ouvrent
            qu'une URL, impossible d'y joindre un fichier automatiquement (limite
            technique de ces plateformes, pas de ce code) — au moins l'image est
            à portée de main pour l'attacher soi-même après. */}
        {hasReadyImage && (
          <a
            href={summaryImagePreviewUrl} download="tempofit-bilan-de-seance.png"
            className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-2`}
          >
            <Download size={16}/> Télécharger l'image (pour WhatsApp/X/Facebook)
          </a>
        )}

        <button onClick={shareViaEmail} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-2`}>
          <MessageCircle size={16}/> Envoyer par e-mail
        </button>
      </div>
    </div>
  );
}
