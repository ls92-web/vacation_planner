"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/store";
import { TripsProvider } from "@/lib/trips/store";
import { UIProvider } from "@/lib/ui/store";
import { AuthGate } from "./auth/AuthGate";
import { ThemeApplier } from "./theme/ThemeApplier";
import { AppShell } from "./shell/AppShell";
import { TripsDashboard } from "./trips/TripsDashboard";
import { RouteBuilder } from "./screens/RouteBuilder";
import { ExploreExperience } from "./explore/ExploreExperience";
import { GeneratingScreen } from "./screens/Generating";
import { Itinerary } from "./screens/Itinerary";
import { ProfilePage } from "./account/ProfilePage";
import { SettingsPage } from "./account/SettingsPage";
import { Toast } from "./Toast";

function Screens() {
  const { state } = useTrip();
  return (
    <>
      {state.screen === "trips" && <TripsDashboard />}
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

export function App() {
  return (
    <AuthProvider>
      <ThemeApplier />
      <AuthGate>
        <UIProvider>
          <TripsProvider>
            <TripProvider>
              <AppShell>
                <Screens />
              </AppShell>
            </TripProvider>
          </TripsProvider>
        </UIProvider>
      </AuthGate>
    </AuthProvider>
  );
}
