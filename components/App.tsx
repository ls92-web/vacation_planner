"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/store";
import { TripsProvider } from "@/lib/trips/store";
import { UIProvider } from "@/lib/ui/store";
import { AuthGate } from "./auth/AuthGate";
import { ThemeApplier } from "./theme/ThemeApplier";
import { AppShell } from "./shell/AppShell";
import { Dashboard } from "./screens/Dashboard";
import { TripsDashboard } from "./trips/TripsDashboard";
import { SavedPlaces } from "./screens/SavedPlaces";
import { RouteBuilder } from "./screens/RouteBuilder";
import { ExploreExperience } from "./explore/ExploreExperience";
import { GeneratingScreen } from "./screens/Generating";
import { Itinerary } from "./screens/Itinerary";
import { ProfilePage } from "./account/ProfilePage";
import { SettingsPage } from "./account/SettingsPage";
import { Welcome } from "./welcome/Welcome";
import { Workspace } from "./workspace/Workspace";
import { Toast } from "./Toast";

function Screens() {
  const { state } = useTrip();
  return (
    <>
      {state.screen === "dashboard" && <Dashboard />}
      {state.screen === "trips" && <TripsDashboard />}
      {state.screen === "saved" && <SavedPlaces />}
      {state.screen === "form" && <RouteBuilder />}
      {state.screen === "explore" && <ExploreExperience />}
      {state.screen === "generating" && <GeneratingScreen />}
      {state.screen === "plan" && <Itinerary />}
      {state.screen === "profile" && <ProfilePage />}
      {state.screen === "settings" && <SettingsPage />}
      <Toast />
    </>
  );
}

/** Boots into the immersive Welcome (no chrome); everything else runs in the AppShell. */
function Shell() {
  const { state } = useTrip();
  if (state.screen === "welcome") return <><Welcome /><Toast /></>;
  if (state.screen === "workspace") return <><Workspace /><Toast /></>;
  return (
    <AppShell>
      <Screens />
    </AppShell>
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
