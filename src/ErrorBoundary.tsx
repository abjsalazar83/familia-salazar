import { Component, type ReactNode } from 'react';
type S = { err: Error | null };
export class ErrorBoundary extends Component<{ children: ReactNode }, S> {
  state: S = { err: null };
  static getDerivedStateFromError(err: Error): S { return { err }; }
  componentDidCatch(err: Error) { try { localStorage.setItem('fs-last-error', `${new Date().toISOString()} ${err.message}`); } catch { /* */ } }
  reload = async () => {
    try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch { /* */ }
    sessionStorage.removeItem('fs-reloaded'); location.reload();
  };
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="wrap"><h2 className="err">A app encontrou um erro</h2>
      <p className="small">{this.state.err.message}</p>
      <p className="dim small">Os teus dados estão guardados. Recarregar resolve quase sempre.</p>
      <button className="pri wide" onClick={this.reload}>recarregar</button>
      <button className="wide" onClick={() => this.setState({ err: null })}>tentar continuar</button></div>;
  }
}
