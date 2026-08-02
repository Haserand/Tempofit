/**
 * username.js — validation locale des pseudos réservés (Correctif UX,
 * 02/08). Regroupe ce qui, sans lui, aurait été dupliqué une 4e/5e/6e fois
 * (AuthModal.jsx et SettingsView.jsx déclaraient déjà CHACUN leur propre
 * copie de `USERNAME_REGEX`, sans compter celle d'AuthContext.jsx) —
 * source UNIQUE désormais, utilisée partout où un pseudo est saisi.
 *
 * ⚠️ Mise à jour (02/08, relecture globale) : au moment de l'écriture
 * initiale de ce fichier, AUCUNE contrainte SQL équivalente n'existait
 * côté Supabase, malgré ce qu'un brief affirmait à l'époque — vérifié dans
 * le vrai fichier avant de coder dessus, confirmé absent. Depuis, la
 * contrainte `profiles_username_not_reserved` a bien été ajoutée
 * (supabase-schema.sql — même motif, même exception 'tempofit_admin') :
 * elle constitue la VRAIE garantie, un appel direct à l'API Supabase (hors
 * de ce frontend) ne peut donc plus créer de pseudo "réservé". Ce fichier
 * reste néanmoins la couche utile pour un retour instantané côté UX (sans
 * aller-retour réseau) — la contrainte SQL n'intervient qu'à l'échec de
 * l'insertion, plus tard et moins agréable pour l'utilisateur.
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
