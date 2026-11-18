// Line icons from the boards: 24 × 24, currentColor, hidden from screen readers
const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const PlusIcon = () => <svg {...base} strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>;
export const CloseIcon = () => <svg {...base} strokeWidth={1.8}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const BackIcon = () => <svg {...base} width={20} height={20} strokeWidth={1.8}><path d="M15 5l-7 7 7 7" /></svg>;
export const RecentreIcon = () => <svg {...base} strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
export const VoyageIcon = () => <svg {...base} width={24} height={24} strokeWidth={1.6}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 L13.5 13.5 L8.5 15.5 L10.5 10.5 Z" /></svg>;
export const ChartIcon = () => <svg {...base} width={24} height={24} strokeWidth={1.6}><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>;
export const FocusIcon = () => <svg {...base} width={24} height={24} strokeWidth={2.2}><path d="M19.6 9.2A8 8 0 1 1 14.6 4.4" /></svg>;
export const TreasureIcon = () => <svg {...base} width={24} height={24} strokeWidth={1.6}><rect x="3" y="10" width="18" height="10" rx="1.5" /><path d="M3 10a9 5 0 0 1 18 0" /><path d="M10 13h4v3h-4z" /></svg>;
export const GearIcon = () => <svg {...base} strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
export const BossIcon = () => <svg {...base} strokeWidth={1.8}><path d="M5 5l14 14M19 5L5 19" /></svg>;
export const ReturnIcon = () => <svg {...base} width={18} height={18} strokeWidth={1.8}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>;
export const SailIcon = () => <svg {...base} width={20} height={20} strokeWidth={1.8}><path d="M4 17l3 3h10l3-3" /><path d="M12 3v12" /><path d="M12 4l6 9h-6" /></svg>;
export const PagodaIcon = () => <svg {...base} strokeWidth={1.5}><path d="M4 9h16l-3-4H7z" /><path d="M6 9v9h12V9" /><path d="M3 18h18" /><path d="M10 18v-5h4v5" /></svg>;

export function Grip() {
  return (
    <svg className="grip" width="16" height="16" viewBox="0 0 24 24" fill="#5C5546" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F6F0E2" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}
