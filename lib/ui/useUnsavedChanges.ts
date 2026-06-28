"use client";

import { useEffect } from "react";
import { isUnsaved, requestNavigation, setUnsaved } from "./unsavedGuard";

/**
 * Protect an editable form against losing unsaved edits. Drives the shared
 * confirm dialog for in-app navigation, and guards the browser Back button and
 * tab close / refresh. Pass the form's current dirty state.
 */
export function useUnsavedChanges(dirty: boolean): void {
  // Register dirty state with the global guard (used by in-app navigation).
  useEffect(() => {
    setUnsaved(dirty);
    return () => setUnsaved(false);
  }, [dirty]);

  // Tab close / refresh → native browser prompt (the only thing browsers allow).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Browser Back button → custom confirm dialog.
  useEffect(() => {
    if (!dirty) return;
    window.history.pushState(null, ""); // sentinel so the first Back stays here
    const onPop = () => {
      if (!isUnsaved()) return;
      window.history.pushState(null, ""); // keep them on the page until they decide
      requestNavigation(() => {
        setUnsaved(false);
        window.history.go(-2); // discard → actually go back past our sentinel
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);
}
