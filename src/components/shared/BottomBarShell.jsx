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
      {/* ⚠️ BUG RÉEL CORRIGÉ (22/08, MÊME JOUR, encore un retour direct
          avec capture — "le texte n'est plus centré, tu dois te
          planter") : `flex` MANQUAIT ici, dans le template DE BASE de ce
          composant. `GuestModeBar.jsx` transmettait `flex-col
          items-center justify-center` via `innerClassName`, mais SANS un
          `display: flex` de base sur ce conteneur, `flex-col`/
          `items-center` n'ont AUCUN effet — ce `<div>` restait un simple
          bloc. Confirmé par une vraie mesure Playwright (pas un
          raisonnement théorique cette fois, faux 2 fois de suite déjà ce
          jour-là sur ce même composant) : la boîte du texte muted
          collait au bord GAUCHE du conteneur, sur toute sa hauteur en
          flux normal, jamais centrée comme élément flex — alors que le
          bouton "Se connecter" juste au-dessus semblait, LUI, centré,
          mais uniquement parce qu'il a son PROPRE `flex items-center
          justify-center` autonome (`w-full flex ...`, un conteneur flex
          complet et indépendant, qui n'a jamais eu besoin de CE
          `display:flex`-ci pour fonctionner). `MiniPlayerBar.jsx` n'a
          jamais eu ce bug : son `innerClassName` inclut déjà SON PROPRE
          `flex` explicitement (`"px-4 flex items-center gap-3"`) — c'est
          cette différence qui a caché le problème jusqu'ici. `flex`
          ajouté ICI, dans le template DE BASE (pas seulement corrigé côté
          appelant) : plus aucun futur appelant ne pourra oublier cette
          classe, exactement l'esprit de ce composant partagé — imposer
          la structure plutôt que compter sur la mémoire de qui l'utilise.
          `flex` retiré en double de `MiniPlayerBar.jsx` dans la foulée
          (devenu redondant, désormais garanti ici). */}
      <div className={`max-w-5xl mx-auto w-full flex ${innerClassName}`}>
        {children}
      </div>
    </div>
  );
}
