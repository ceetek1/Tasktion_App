import { useEffect, type ReactNode } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router";
import { MotionConfig } from "motion/react";
import Shell from "./components/Shell";
import { ApiError, patch } from "./lib/api";
import { useMe, useSettings, useTerm } from "./lib/queries";
import { signOut, useSession } from "./lib/session";
import { useWide } from "./lib/useWide";
import Bosses from "./screens/Bosses";
import ChartRoom from "./screens/ChartRoom";
import DayIsland from "./screens/DayIsland";
import Focus from "./screens/Focus";
import NewQuest from "./screens/NewQuest";
import Onboarding from "./screens/Onboarding";
import Settings from "./screens/Settings";
import SignIn, { NotInvited } from "./screens/SignIn";
import Treasure from "./screens/Treasure";
import VoyageScreen from "./screens/Voyage";

function Waiting({ children }: { children: ReactNode }) {
  return <p className="muted" role="status" style={{ padding: 24 }}>{children}</p>;
}

/** Keep the planner's timezone in step with this device, as the classic dashboard does */
function useTimezoneSync(enabled: boolean) {
  // Only once the member exists: a first sign-in creates them, and parallel requests would race
  const settings = useSettings(enabled);
  useEffect(() => {
    if (!enabled || !settings.data) return;
    let zone = "";
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (zone && zone !== settings.data.timezone) patch("/planner/settings", { timezone: zone }).catch(() => {});
  }, [enabled, settings.data]);
}

/** Signed in, a member of the group, and through onboarding */
function Gate() {
  const session = useSession();
  const me = useMe(!!session);
  const term = useTerm(!!me.data);
  const location = useLocation();
  useTimezoneSync(!!me.data);

  if (session === undefined) return <Waiting>Raising the sails…</Waiting>;
  if (session === null) return <SignIn />;
  if (me.error instanceof ApiError && me.error.status === 403) return <NotInvited onSignOut={signOut} />;
  if (me.error instanceof ApiError && me.error.status === 401) {
    signOut();
    return <Waiting>Signing out…</Waiting>;
  }
  if (me.isError) return <p className="notice" role="alert" style={{ margin: 24 }}>Couldn't reach Tasktion: {me.error.message}</p>;
  if (!me.data || !term.data) return <Waiting>Raising the sails…</Waiting>;
  const onboarding = location.pathname.endsWith("/onboarding");
  if (!term.data.onboarded && !onboarding) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** On wide screens the new-quest form opens over the map */
function NewQuestRoute() {
  const wide = useWide();
  return wide ? (
    <>
      <VoyageScreen />
      <NewQuest />
    </>
  ) : (
    <NewQuest />
  );
}

const router = createBrowserRouter(
  [
    {
      element: <Gate />,
      children: [
        { path: "onboarding", element: <Onboarding /> },
        {
          element: <Shell />,
          children: [
            { index: true, element: <VoyageScreen /> },
            { path: "day/:date", element: <DayIsland /> },
            { path: "new", element: <NewQuestRoute /> },
            { path: "bosses", element: <Bosses /> },
            { path: "focus", element: <Focus /> },
            { path: "chart-room", element: <ChartRoom /> },
            { path: "treasure", element: <Treasure /> },
            { path: "settings", element: <Settings /> },
            { path: "*", element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") },
);

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
