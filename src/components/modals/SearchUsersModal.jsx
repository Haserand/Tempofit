import { useState, useEffect } from 'react';
import { Search, Loader2, UserX } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import ModalShell from '../shared/ModalShell';
import ModalCloseButton from '../shared/ModalCloseButton';

/**
 * SearchUsersModal — recherche d'un profil TempoFit par pseudo (Feature
 * Sociale — Navigation, 01/08). Délibérément SÉPARÉE de SearchModal.jsx
 * (recherche de titres pour construire une playlist) plutôt qu'ajoutée
 * dedans : cette dernière n'est jamais un point d'entrée général — elle ne
 * s'ouvre que depuis 3 endroits précis, tous liés à l'ajout d'un titre dans
 * une playlist en cours (TrackList.jsx, GeneratorWizard.jsx,
 * FavoritesView.jsx), avec des props entièrement dédiées à ce rôle
 * (`currentPlaylist`, `editingBpmId`...). Personne ne tombe dessus en
 * cherchant un ami. Cette modale-ci a son propre point d'entrée dans
 * Sidebar.jsx (icône loupe, toujours visible), sans rapport avec le
 * contexte "playlist en cours".
 *
 * Login Wall cohérent (même principe que ProfileView.jsx) — `user` (reçu en
 * prop) conditionne l'accès : un visiteur non connecté qui ouvrirait quand
 * même cette modale (ex. Sidebar l'affiche à tort) verrait un message
 * l'invitant à se connecter plutôt qu'un champ de recherche voué à échouer
 * — mais en pratique, voir Sidebar.jsx, l'icône elle-même n'est affichée
 * QUE si `user` existe déjà, ce cas ne devrait jamais se présenter.
 *
 * `search_public_profiles` (SECURITY DEFINER, supabase-schema.sql) ne
 * renvoie QUE `username`/`avatar_url` de profils `is_profile_public = true`
 * — jamais les stats, jamais un profil resté privé (même son EXISTENCE
 * n'est pas confirmée par une recherche qui ne matcherait rien).
 *
 * Debounce 350ms sur la frappe (pas de recherche à chaque touche) — même
 * ordre de grandeur qu'un debounce de recherche classique, assez court
 * pour rester réactif, assez long pour ne pas spammer Supabase à chaque
 * lettre tapée.
 */
export default function SearchUsersModal({ theme, isOpen, onClose, user, onViewProfile }) {
  const { textHighlight, textMuted, inputBg, inputBorder } = theme;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'searching' | 'ready'

  // Reset à chaque ouverture — sans ça, rouvrir la modale plus tard
  // montrerait encore la recherche/les résultats de la fois précédente,
  // potentiellement obsolètes.
  useEffect(() => {
    if (isOpen) { setQuery(''); setResults([]); setStatus('idle'); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !user || !isSupabaseConfigured) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) { setResults([]); setStatus('idle'); return; }

    setStatus('searching');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_public_profiles', { search_query: trimmed });
      if (cancelled) return;
      setResults(!error && Array.isArray(data) ? data : []);
      setStatus('ready');
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isOpen, user]);

  if (!isOpen) return null;

  const handleSelect = (username) => {
    onViewProfile(username);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} theme={theme} cardClassName="p-6 flex flex-col max-h-[70vh]">
        <div className="flex justify-between items-center mb-4">
          <h3 className={"text-xl font-bold flex items-center space-x-2 " + textHighlight}>
            <Search size={20}/> <span>Trouver un profil</span>
          </h3>
          <ModalCloseButton onClick={onClose} />
        </div>

        {!user ? (
          <p className={"text-sm " + textMuted}>Connecte-toi pour rechercher d'autres profils.</p>
        ) : (
          <>
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-3 ${inputBorder} ${inputBg}`}>
              <Search size={16} className={textMuted}/>
              <input
                type="text" autoFocus placeholder="Pseudo (ex: alex_runner)"
                value={query} onChange={e => setQuery(e.target.value.toLowerCase())}
                className={`flex-1 min-w-0 bg-transparent outline-hidden text-sm ${textHighlight}`}
              />
              {status === 'searching' && <Loader2 size={14} className={`animate-spin ${textMuted}`}/>}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
              {query.trim().length > 0 && query.trim().length < 2 && (
                <p className={`text-xs text-center py-4 ${textMuted}`}>Encore un caractère...</p>
              )}

              {status === 'ready' && results.length === 0 && query.trim().length >= 2 && (
                <div className="flex flex-col items-center text-center py-8 gap-2">
                  <UserX size={28} className={textMuted}/>
                  <p className={`text-sm ${textMuted}`}>Aucun profil public trouvé pour "{query.trim()}".</p>
                </div>
              )}

              {results.map(r => (
                <button
                  key={r.username}
                  onClick={() => handleSelect(r.username)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-colors text-left"
                >
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${textMuted} bg-black/5 dark:bg-white/5 font-bold`}>
                      {r.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`font-bold text-sm truncate ${textHighlight}`} title={`@${r.username}`}>@{r.username}</span>
                </button>
              ))}
            </div>
          </>
        )}
    </ModalShell>
  );
}
