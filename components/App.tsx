"use client";

import { TripProvider, useTrip } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/store";
import { TripsProvider } from "@/lib/trips/store";
import { AuthGate } from "./auth/AuthGate";
import { AccountButton } from "./auth/AccountButton";
import { TripsDashboard } from "./trips/TripsDashboard";
import { RouteBuilder } from "./screens/RouteBuilder";
import { ExploreExperience } from "./explore/ExploreExperience";
import { GeneratingScreen } from "./screens/Generating";
import { Itinerary } from "./screens/Itinerary";
import { Toast } from "./Toast";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { Map as MapIcon } from "./icons";

function Screens() {
  const { state, actions } = useTrip();
  return (
    <div
      data-theme={state.theme.toLowerCase()}
      className="vp-scroll min-h-screen overflow-x-hidden font-body text-ink"
      style={{ background: "var(--bg)" }}
    >
      {state.screen === "trips" && <TripsDashboard />}
      {state.screen === "form" && <RouteBuilder />}
      {state.screen === "explore" && <ExploreExperience />}
      {state.screen === "generating" && <GeneratingScreen />}
      {state.screen === "plan" && <Itinerary />}

      {state.screen !== "trips" && (
        <button
          onClick={actions.goTrips}
          title="All trips"
          className="fixed bottom-[22px] left-[136px] z-[70] h-10 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-surface border border-line text-ink text-[13px] font-bold cursor-pointer hover:border-accent"
          style={{ boxShadow: "0 8px 24px -12px rgba(0,0,0,.3)" }}
        >
          <MapIcon size={15} strokeWidth={2} className="text-accent" />Trips
        </button>
      )}

      <Toast />
      <ThemeSwitcher />
      <AccountButton />
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <TripsProvider>
          <TripProvider>
            <Screens />
          </TripProvider>
        </TripsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
