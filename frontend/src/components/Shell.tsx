import { NavLink, Outlet, useNavigate } from "react-router";
import { useTerm } from "../lib/queries";
import { useWide } from "../lib/useWide";
import { ChartIcon, FocusIcon, GearIcon, PlusIcon, TreasureIcon, VoyageIcon } from "./Icons";

const DESKTOP_NAV = [
  { to: "/", label: "Voyage", end: true },
  { to: "/bosses", label: "Bosses" },
  { to: "/focus", label: "Focus" },
  { to: "/chart-room", label: "Chart room" },
  { to: "/treasure", label: "Treasure" },
  { to: "/settings", label: "Settings" },
];

const TABS = [
  { to: "/", label: "Voyage", icon: <VoyageIcon />, end: true },
  { to: "/chart-room", label: "Chart room", icon: <ChartIcon /> },
  { to: "/focus", label: "Focus", icon: <FocusIcon /> },
  { to: "/treasure", label: "Treasure", icon: <TreasureIcon /> },
];

export function termLine(term: ReturnType<typeof useTerm>["data"]): string {
  if (!term?.name) return "Your voyage";
  return term.current_week ? `${term.name} · week ${term.current_week} of ${term.weeks}` : term.name;
}

export default function Shell() {
  const wide = useWide();
  const term = useTerm();
  const navigate = useNavigate();

  if (!wide) {
    return (
      <div className="shell">
        <main id="main" className="phone-page">
          <Outlet />
        </main>
        <nav aria-label="Main" className="tabbar">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {t.icon}
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="shell">
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <NavLink to="/" className="brand-name">Tasktion</NavLink>
          <span className="brand-line">{termLine(term.data)}</span>
        </div>
        <nav aria-label="Main" className="topnav">
          {DESKTOP_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.to === "/settings" ? <><GearIcon /><span className="sr-only">Settings</span></> : n.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="btn btn-moss" onClick={() => navigate("/new")}>
          <PlusIcon />
          New quest
        </button>
      </header>
      <main id="main" className="content">
        <Outlet />
      </main>
    </div>
  );
}
