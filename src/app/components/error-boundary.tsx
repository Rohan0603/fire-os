import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card';

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
      <Card role="alert" className="border-(--color-destructive)">
        <CardHeader>
          <CardTitle>This section failed to load</CardTitle>
          <CardBody className="text-(--color-muted-foreground)">{error.message}</CardBody>
        </CardHeader>
        <Button variant="secondary" size="sm" onClick={this.retry}>
          Try again
        </Button>
      </Card>
    );
  }
}
