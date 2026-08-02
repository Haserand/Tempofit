/**
 * username.js — validation locale des pseudos réservés (Correctif UX,
 * 02/08). Regroupe ce qui, sans lui, aurait été dupliqué une 4e/5e/6e fois
 * (AuthModal.jsx et SettingsView.jsx déclaraient déjà CHACUN leur propre
 * copie de `USERNAME_REGEX`, sans compter celle d'AuthContext.jsx) —
 * source UNIQUE désormais, utilisée partout où un pseudo est saisi.
 *
 * ⚠️ Contexte important, vérifié avant d'écrire ce fichier : AUCUNE
 * contrainte SQL équivalente n'existe côté Supabase (voir
 * supabase-schema.sql — rien de tel n'y a jamais été ajouté, malgré ce que
 * le brief affirmait). Ce fichier n'est donc, pour l'instant, qu'un
 * garde-fou d'EXPÉRIENCE UTILISATEUR (retour instantané, sans aller-retour
 * réseau) — PAS une vraie barrière de sécurité : un appel direct à l'API
 * Supabase (hors de ce frontend) pourrait toujours créer un pseudo
 * "réservé" sans jamais passer par ce fichier. Si une vraie garantie est
 * nécessaire, il faudrait la contrainte SQL correspondante — volontairement
 * pas ajoutée ici, hors du scope frontend demandé.
 *
 * `ADMIN_USERNAME_EXCEPTION` — pseudo unique concerné, en toutes lettres
 * plutôt qu'un pattern : les pseudos étant IMMUABLES une fois posés (voir
 * `setUsername`, AuthContext.jsx — refuse toute resoumission dès qu'un
 * pseudo existe déjà), cette exception ne joue en pratique QUE si ce
 * compte devait être recréé un jour, pas pour "modifier" un profil déjà
 * existant (qui n'a de toute façon plus ce champ à revalider ensuite).
 */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export const ADMIN_USERNAME_EXCEPTION = 'tempofit_admin';

// Pattern EXACT fourni par le brief — `tempofit` interdit n'importe où
// dans le pseudo, les mots-clés système interdits uniquement en PRÉFIXE
// (`^(...)`) : "admin_123" est bloqué, mais un pseudo qui contiendrait
// "admin" plus loin (ex. "grand_admin_fan", cas limite non couvert par ce
// pattern volontairement fourni tel quel par le brief) ne l'est pas — pas
// de resserrement de ma part au-delà de ce qui a été explicitement
// demandé.
const RESERVED_USERNAME_PATTERN = /tempofit|^(admin|support|system|modo|staff|root|officiel)/i;

/**
 * `true` si `candidate` doit être refusé comme pseudo réservé — `false`
 * pour l'exception admin explicite, même si elle matcherait sinon le
 * pattern ci-dessus (`tempofit_admin` contient bien "tempofit").
 */
export function isReservedUsername(candidate) {
  if (candidate === ADMIN_USERNAME_EXCEPTION) return false;
  return RESERVED_USERNAME_PATTERN.test(candidate || '');
}

export const RESERVED_USERNAME_ERROR = 'Ce pseudo est réservé ou invalide.';
