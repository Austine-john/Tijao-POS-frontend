import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last line of defence: a crash shows a readable message, never a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Tijao POS crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-lg rounded-lg bg-white p-8 text-center">
          <h1 className="mb-2 text-2xl font-semibold text-ink">Something went wrong on this screen</h1>
          <p className="mb-6 text-lg text-ink-soft">No sale was lost. Reload the page to carry on.</p>
          <button onClick={() => window.location.reload()} className="h-14 rounded-lg bg-brand-800 px-8 text-lg font-semibold text-white hover:bg-brand-900">
            Reload
          </button>
          <p className="mt-6 break-words font-mono text-sm text-ink-faint">{this.state.error.message}</p>
        </div>
      </div>
    );
  }
}
