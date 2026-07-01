"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/store";
import { TripsProvider } from "@/lib/trips/store";
import { UIProvider } from "@/lib/ui/store";
import { AuthGate } from "./auth/AuthGate";
import { ThemeApplier } from "./theme/ThemeApplier";
import { ImmersiveShell } from "./immersive/ImmersiveShell";
import { TripsDashboard } from "./trips/TripsDashboard";
import { SavedPlaces } from "./screens/SavedPlaces";
import { Welcome } from "./welcome/Welcome";
import { Workspace } from "./workspace/Workspace";
import { Toast } from "./Toast";

/** Secondary immersive screens (reached from the floating menu): My journeys + Saved. */
function Screens() {
  const { state } = useTrip();
  return (
    <>
      {state.screen === "saved" ? <SavedPlaces /> : <TripsDashboard />}
      <Toast />
    </>
  );
}

/**
 * One continuous immersive experience — no sidebar, no admin dashboard.
 * Welcome (start) and the Workspace (Journey Board) own their full-screen layout;
 * everything else rides the shared immersive shell.
 */
function Shell() {
  const { state } = useTrip();
  if (state.screen === "welcome" || state.screen === "dashboard") return <><Welcome /><Toast /></>;
  if (state.screen === "workspace") return <><Workspace /><Toast /></>;
  return (
    <ImmersiveShell>
      <Screens />
    </ImmersiveShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ThemeApplier />
      <AuthGate>
        <UIProvider>
          <TripsProvider>
            <TripProvider>
              <Shell />
            </TripProvider>
          </TripsProvider>
        </UIProvider>
      </AuthGate>
    </AuthProvider>
  );
}
