/**
 * BottomBarShell.jsx — conteneur partagé pour les 2 barres ancrées en bas
 * de l'écran (MiniPlayerBar.jsx, GuestModeBar.jsx), extrait le 22/08.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE — les 2 barres ci-dessus recopiaient
 * jusqu'ici, chacune indépendamment, la même "recette" de conteneur
 * (`h-[70px]` + `max-w-5xl mx-auto` + padding), avec de petites
 * divergences de détail à chaque copie (`px-4` vs `px-6`, `justify-center`
 * présent ou non sur le conteneur externe). Cette duplication a produit
 * 3 bugs de désalignement DISTINCTS la même session — pas 3 causes
 * différentes, mais 3 symptômes de la même fragilité : une convention
 * maintenue par la mémoire humaine ("se souvenir de recopier le même
 * motif partout") dérive avec le temps, contrairement à une convention
 * imposée par la STRUCTURE du code. Voir la Convention UI du README
 * ("Une recette de mise en page recopiée... dérive") pour le principe
 * général tiré de ce chantier.
 *
 * `h-[70px]` DOIT rester une classe Tailwind écrite en toutes lettres ICI
 * (piège JIT déjà documenté ailleurs sur ce projet, voir passation du
 * 26/07 — une classe reconstruite par interpolation, ex.
 * `` `h-[${N}px]` ``, ne serait jamais générée par le scanner). Comme ce
 * fichier est désormais l'UNIQUE endroit où cette hauteur est écrite en
 * dur (avant ce refactor, elle vivait dupliquée dans MiniPlayerBar.jsx ET
 * GuestModeBar.jsx séparément — voir bottomBarLayout.js pour l'historique
 * complet de cette ancienne duplication), il n'y a plus 2 classes à
 * garder manuellement synchronisées : la changer ici suffit, propage
 * automatiquement aux 2 barres qui utilisent ce conteneur.
 *
 * `shadow`, `justify`, `innerClassName` : les 3 seuls points de
 * personnalisation qui différaient réellement entre les 2 barres avant ce
 * refactor (MiniPlayerBar a une ombre portée, GuestModeBar centre son
 * conteneur externe en plus du centrage interne). Tout le reste
 * (hauteur, bordure, `max-w-5xl mx-auto`) est désormais imposé par ce
 * composant, pas laissé au choix de chaque appelant — c'est justement le
 * but : réduire la surface où une future divergence pourrait se glisser.
 */
export default function BottomBarShell({ theme, shadow = false, justify = false, innerClassName = '', children }) {
  const { cardBg, cardBorderStrong } = theme;
  return (
    <div className={`h-[70px] border-t-2 ${cardBorderStrong} ${shadow ? 'shadow-2xl ' : ''}${cardBg} flex items-center${justify ? ' justify-center' : ''}`}>
      <div className={`max-w-5xl mx-auto w-full ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
