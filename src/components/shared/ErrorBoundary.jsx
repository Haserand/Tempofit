import { Component } from 'react';

/**
 * ErrorBoundary — remplace la page blanche silencieuse (bug signalé : "je
 * rentre dans une playlist générée via routine, page blanche") par un écran
 * lisible affichant le VRAI message d'erreur + la pile des COMPOSANTS React
 * (`componentStack` — des noms comme "PlaylistCharts", "TrackItem", pas des
 * numéros de ligne minifiés type "Lce"/"index-f7HPyOwQ.js:40:39766").
 *
 * Pourquoi un composant CLASSE (seul cas restant dans toute l'app) : les
 * error boundaries React ne peuvent être que des classes à ce jour — c'est
 * le seul mécanisme du framework qui déclenche `getDerivedStateFromError`/
 * `componentDidCatch`, aucun hook équivalent n'existe.
 *
 * Placé UNE SEULE FOIS, tout en haut (autour de `<AppContent/>` dans le
 * composant racine `App`, App.jsx) plutôt que vue par vue : une erreur
 * n'importe où dans l'arbre remonte jusqu'ici et affiche ce même écran,
 * sans avoir à en poser un dans chaque vue individuellement.
 *
 * `showToast` n'est PAS utilisé ici volontairement : un toast disparaît
 * après quelques secondes et l'app resterait quand même plantée derrière —
 * ce cas précis a besoin d'un écran qui REMPLACE le rendu cassé, pas d'une
 * notification par-dessus.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // `info.componentStack` : liste des composants React imbriqués au
    // moment du crash (ex. "in TrackItem \n in TrackList \n in
    // PlaylistDetailView...") — c'est CE texte qui permet de localiser le
    // bug directement, même sur un build minifié en production où les
    // numéros de ligne du bundle ne veulent plus rien dire.
    this.setState({ componentStack: info.componentStack });
    // Toujours loggé aussi en console (en plus de l'écran ci-dessous) — au
    // cas où quelqu'un ouvrirait quand même les DevTools par réflexe.
    console.error('ErrorBoundary a intercepté :', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen w-full flex items-center justify-center p-6 bg-gray-950 text-gray-100">
        <div className="max-w-2xl w-full space-y-4">
          <h1 className="text-2xl font-black text-red-400">Une erreur a interrompu l'affichage de cette page</h1>
          <p className="text-sm text-gray-400">
            Plutôt qu'une page blanche silencieuse, voici le détail technique — utile pour le corriger.
          </p>
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4">
            <p className="font-mono text-sm text-red-300 break-words">{this.state.error?.message || String(this.state.error)}</p>
          </div>
          {this.state.componentStack && (
            <details className="rounded-xl border border-gray-800 bg-gray-900 p-4" open>
              <summary className="cursor-pointer text-sm font-bold text-gray-300">Pile des composants React</summary>
              <pre className="mt-3 text-xs text-gray-400 whitespace-pre-wrap font-mono overflow-x-auto">{this.state.componentStack}</pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
