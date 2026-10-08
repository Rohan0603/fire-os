import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Per-route error boundary. One of these wraps the router outlet so a crash in
 * one route renders a fallback instead of blanking the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Route render failed:', error, info.componentStack);
  }

  private readonly retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="rounded-md border border-(--color-danger) p-4">
        <h2 className="text-base font-semibold">This section failed to load</h2>
        <p className="mt-1 text-sm text-(--color-muted-foreground)">{error.message}</p>
        <button
          type="button"
          onClick={this.retry}
          className="mt-3 rounded-md border border-(--color-border) px-3 py-1.5 text-sm
                     focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-(--color-secondary)"
        >
          Try again
        </button>
      </div>
    );
  }
}
