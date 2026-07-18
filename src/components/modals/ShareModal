import { X, Share2, MessageCircle, ExternalLink, Copy } from 'lucide-react';

/**
 * ShareModal — partage d'une playlist/routine (lien copié, réseaux sociaux,
 * e-mail, partage natif du téléphone/OS si disponible). Extrait de App.jsx
 * (voir CustomActivityModal.jsx pour le contexte de cette série
 * d'extractions).
 */
export default function ShareModal({
  theme,
  isShareModalOpen, setIsShareModalOpen, shareData,
  shareNative, shareToWhatsApp, shareToTwitter, shareToFacebook,
  copyToClipboard, shareViaEmail,
}) {
  const { cardBg, cardBorder, textHighlight, textColorClass, inputBg, inputBorder, textMuted, bgAccentClass } = theme;

  if (!isShareModalOpen || !shareData) return null;

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
        <div className={`p-4 rounded-xl mb-6 text-sm ${inputBg} border ${inputBorder} ${textHighlight}`}>
          {shareData.text}
        </div>

        {/* Boutons directs vers les réseaux les plus courants — tuiles discrètes
            (fond léger + accent coloré) plutôt que des blocs pleins saturés qui se
            battaient visuellement entre eux. Le partage natif (menu "Partager"
            habituel du téléphone/OS, quand disponible) est intégré comme une tuile
            de plus, pas un gros bouton séparé qui dominait tout le reste. */}
        <div className={`grid gap-2 mb-4 ${typeof navigator !== 'undefined' && navigator.share ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={shareNative} title="Autres options" className={`flex flex-col items-center gap-1.5 py-3.5 rounded-xl ${cardBg} border ${cardBorder} hover:bg-surface-hover transition-colors`}>
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
        <button onClick={shareViaEmail} className={`w-full py-3 mt-2 rounded-xl text-sm font-bold ${textMuted} hover:text-main transition-colors flex items-center justify-center gap-2`}>
          <MessageCircle size={16}/> Envoyer par e-mail
        </button>
      </div>
    </div>
  );
}
