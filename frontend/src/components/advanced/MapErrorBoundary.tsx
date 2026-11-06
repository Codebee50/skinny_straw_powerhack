"use client";

import { Component, type ReactNode } from "react";

/** Renders `fallback` if Leaflet (or its lazy-loaded chunk) throws, so the page never loses the map. */
export class MapErrorBoundary extends Component<
  { fallback: ReactNode; onError?: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
