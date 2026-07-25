import { Component, type ErrorInfo, type ReactNode } from "react";

// Catches render-time crashes anywhere below it — without this, an uncaught error (e.g. a bad
// API response shape) unmounts the whole React tree and leaves a blank white page with no
// indication anything happened. A coach or player hitting that has no next step but to give up.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[hoops-coaching] uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card">
          <h2>Something went wrong</h2>
          <p>This page hit an unexpected error. Your data is safe — try reloading.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
