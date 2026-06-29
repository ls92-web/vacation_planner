"use client";

import React from "react";

/**
 * Contains render errors from a subtree so one screen crashing can't white-screen
 * the whole app (which otherwise falls through to the framework's bare error page).
 * `resetKey` changing (e.g. the active screen) clears the error so navigating away
 * gives the next screen a fresh attempt.
 */
export class ErrorBoundary extends React.Component<
  { resetKey?: string | number; fallback: (reset: () => void) => React.ReactNode; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the real cause for debugging (kept generic for the user via the fallback).
    console.error("[ErrorBoundary]", error, info.componentStack);

    // Stale-deployment recovery: after a redeploy, a tab opened on the old build
    // references chunk hashes that no longer exist → ChunkLoadError on navigation.
    // Reload once (guarded against loops) to fetch the current build's chunks.
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    const isChunkError = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
    if (isChunkError && typeof window !== "undefined") {
      const KEY = "itinera_chunk_reloaded";
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, "1");
        window.location.reload();
      }
    }
  }

  componentDidUpdate(prev: { resetKey?: string | number }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.reset);
    return this.props.children;
  }
}
