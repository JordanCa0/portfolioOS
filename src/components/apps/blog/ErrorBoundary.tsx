import { Component, type ReactNode } from 'react';

/** Keeps one broken window from blanking the whole desktop. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <p className="p-6 text-xs text-term-close">This window crashed: {this.state.error.message}</p>;
    }
    return this.props.children;
  }
}
