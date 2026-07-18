import { X, Image as ImageIcon } from 'lucide-react';
import { AVAILABLE_ICONS } from '../../appConfig';

/**
 * IconPickerModal — change l'emoji-avatar d'une playlist. Extrait de App.jsx
 * (voir CustomActivityModal.jsx pour le contexte de cette série
 * d'extractions).
 */
export default function IconPickerModal({
  theme,
  isIconPickerOpen, setIsIconPickerOpen,
  currentPlaylist, setCurrentPlaylist, savedPlaylists, setSavedPlaylists,
  showToast,
}) {
  const { cardBg, cardBorder, textHighlight } = theme;

  if (!isIconPickerOpen || !currentPlaylist) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsIconPickerOpen(false)}>
      <div className={"p-8 rounded-3xl w-full max-w-sm shadow-2xl transform transition-all border " + cardBg + " " + cardBorder} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}><ImageIcon className="text-purple-500"/> <span>Personnaliser l'image</span></h3>
          <button onClick={() => setIsIconPickerOpen(false)} className="p-2 -mr-2 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-surface-hover"><X size={20}/></button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {AVAILABLE_ICONS.map(icon => (
            <button
              key={icon}
              onClick={() => {
                setCurrentPlaylist({ ...currentPlaylist, coverIcon: icon });
                setSavedPlaylists(savedPlaylists.map(p => p.id === currentPlaylist.id ? { ...p, coverIcon: icon } : p));
                setIsIconPickerOpen(false);
                showToast("Image de playlist mise à jour !");
              }}
              className={"text-3xl p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:scale-110 hover:shadow-md transition-all " + (currentPlaylist.coverIcon === icon ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-900/20' : '')}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
