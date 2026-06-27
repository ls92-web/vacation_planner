"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/store";
import { TripsProvider } from "@/lib/trips/store";
import { UIProvider } from "@/lib/ui/store";
import { AuthGate } from "./auth/AuthGate";
import { AppShell } from "./shell/AppShell";
import { TripsDashboard } from "./trips/TripsDashboard";
import { RouteBuilder } from "./screens/RouteBuilder";
import { ExploreExperience } from "./explore/ExploreExperience";
import { GeneratingScreen } from "./screens/Generating";
import { Itinerary } from "./screens/Itinerary";
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
      <Toast />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
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
