// Hand-built SVG art from the Zen Voyage design boards: ink outlines, paper grain, map craft.
import { useId } from "react";
import type { Guardian } from "../lib/types";

export const INK = "#1F1E1B";
export const LINE = "#3A3326";

/** Filters and gradients for one SVG. Ids are unique per drawing. */
export function usePaper() {
  const id = useId().replace(/:/g, "");
  const ids = { grain: `${id}-grain`, soft: `${id}-soft`, glow: `${id}-glow`, brush: `${id}-brush`, grass: `${id}-grass` };
  const defs = (
    <defs>
      <filter id={ids.grain} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix values="0 0 0 0 0.3  0 0 0 0 0.26  0 0 0 0 0.18  0 0 0 0.2 0" />
      </filter>
      <filter id={ids.soft} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
      <filter id={ids.brush} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={3} seed={4} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="9" />
      </filter>
      <radialGradient id={ids.glow}>
        <stop offset="0" stopColor="#C9A24A" stopOpacity="0.75" />
        <stop offset="1" stopColor="#C9A24A" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={ids.grass} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7E9A72" />
        <stop offset="1" stopColor="#55704D" />
      </linearGradient>
    </defs>
  );
  return { ids, defs };
}

const ISLE = "M-40,8 C-40,-12 -26,-30 -4,-28 C18,-32 40,-20 40,-2 C42,16 28,28 6,28 C-14,32 -40,24 -40,8 Z";

/** One day-island, centred on (0, 0) */
export function Island({ shape, faded = false }: { shape: "isle" | "peak"; faded?: boolean }) {
  return (
    <g opacity={faded ? 0.75 : 1}>
      <path d={ISLE} transform="scale(1.2)" fill="none" stroke="#5F8A8B" strokeWidth="0.9" strokeDasharray="2 3" />
      {shape === "isle" ? (
        <>
          <path d={ISLE} fill="#D9C39A" stroke={LINE} strokeWidth="1.3" />
          <path d="M-28,10 C-22,-12 -9,-17 0,-6 C7,-20 22,-17 28,8 Z" fill="#8FA58A" stroke={LINE} />
          <path d="M-4,10 C0,-2 8,-7 14,2 L16,10 Z" fill="#6E8B67" />
          <circle cx="-20" cy="15" r="3.4" fill="#4F6B4A" />
          <circle cx="-12" cy="18" r="2.7" fill="#4F6B4A" />
          <circle cx="22" cy="15" r="3.1" fill="#4F6B4A" />
        </>
      ) : (
        <>
          <path d="M-38,4 C-36,-16 -18,-28 4,-26 C24,-28 40,-14 38,4 C38,20 22,28 2,27 C-20,29 -40,20 -38,4 Z" fill="#D9C39A" stroke={LINE} strokeWidth="1.3" />
          <path d="M-24,12 L-6,-22 L4,-8 L10,-16 L26,12 Z" fill="#8FA58A" stroke={LINE} strokeLinejoin="round" />
          <path d="M-6,-22 L-1,-12 L-9,-14 Z" fill="#EFE6D2" />
          <circle cx="-26" cy="16" r="3" fill="#4F6B4A" />
          <circle cx="24" cy="18" r="3.2" fill="#4F6B4A" />
          <circle cx="17" cy="20" r="2.4" fill="#4F6B4A" />
        </>
      )}
    </g>
  );
}

/** A map ribbon with a label, centred on (0, 0) */
export function Ribbon({ label, red = false }: { label: string; red?: boolean }) {
  return (
    <g>
      <path d="M-34,-9 L34,-9 L28,0 L34,9 L-34,9 L-28,0 Z" fill="#F3EAD6" stroke={LINE} />
      <text y="4" textAnchor="middle" fontFamily="'IM Fell English SC', serif" fontSize="12" fill={red ? "#B23A2E" : INK}>
        {label}
      </text>
    </g>
  );
}

export function Compass({ size = 21 }: { size?: number }) {
  const k = size / 21;
  return (
    <g transform={`scale(${k})`} aria-hidden="true">
      <circle r="21" fill="#F3EAD6" stroke={LINE} strokeWidth="0.9" />
      <path d="M0,-17 L4,-4 L17,0 L4,4 L0,17 L-4,4 L-17,0 L-4,-4 Z" fill="#F3EAD6" stroke={LINE} strokeWidth="0.9" />
      <path d="M0,-17 L4,-4 L0,0 L-4,-4 Z" fill={INK} />
      <path d="M0,17 L-4,4 L0,0 L4,4 Z" fill="#B23A2E" />
    </g>
  );
}

/** Fog over an uncharted island, centred on (0, 0) */
export function Fog({ soft }: { soft: string }) {
  return (
    <g>
      <g filter={`url(#${soft})`}>
        <circle cx="-26" cy="2" r="32" fill="#F1EBDD" />
        <circle cx="8" cy="-14" r="36" fill="#F1EBDD" />
        <circle cx="34" cy="10" r="28" fill="#F1EBDD" />
        <circle cx="-10" cy="24" r="26" fill="#E2DACA" />
        <circle cx="24" cy="28" r="22" fill="#E2DACA" />
      </g>
      <path d="M-40 -2 q18 -9 36 0 q18 -9 36 0" fill="none" stroke="#8E877A" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M-26 14 q14 -7 28 0 q14 -7 28 0" fill="none" stroke="#8E877A" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

export function CheckMedal() {
  return (
    <g>
      <circle r="8" fill="#C9A24A" stroke={INK} strokeWidth="1.2" />
      <path d="M-4 0 l3 3 l5 -6" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function XMark({ size = 9 }: { size?: number }) {
  return (
    <path d={`M${-size},${-size} L${size},${size} M${size},${-size} L${-size},${size}`} stroke="#B23A2E" strokeWidth="4.5" strokeLinecap="round" />
  );
}

/** Little guardian badge for the map: a coloured disc with the creature's first letter */
export function GuardianBadge({ guardian }: { guardian: Guardian | null }) {
  const tint = guardian === "dragon" ? "#B23A2E" : guardian === "golem" ? "#8E877A" : "#5F8A8B";
  return (
    <g>
      {guardian === "dragon" ? (
        <g transform="scale(0.32) translate(-195,-90)">
          <DragonBody />
        </g>
      ) : guardian === "golem" ? (
        <g transform="scale(0.32) translate(-195,-140)">
          <GolemBody />
        </g>
      ) : (
        <g transform="translate(0 0)" stroke={INK} strokeWidth="1.2" fill={tint}>
          <path d="M-16,10 C-20,-4 -9,-14 -13,-26 C-15,-33 -8,-37 -4,-31 C-6,-22 0,-12 -4,10 Z" />
          <path d="M1,10 C-3,-8 10,-17 6,-31 C5,-37 13,-39 14,-33 C15,-22 10,-10 12,10 Z" />
          <path d="M18,10 C16,0 24,-6 22,-17 C22,-21 28,-22 29,-18 C30,-10 27,0 29,10 Z" />
          <path d="M-26,12 q8 -4 16 0 q8 -4 16 0 q8 -4 16 0 q8 -4 16 0" fill="none" stroke="#5F8A8B" strokeWidth="1.4" />
        </g>
      )}
    </g>
  );
}

export function Chest({ open, size = 56 }: { open: boolean; size?: number }) {
  return (
    <svg width={size} height={(size * 46) / 56} viewBox="0 0 56 46" aria-hidden="true">
      {open ? (
        <g>
          <circle cx="28" cy="22" r="20" fill="#C9A24A" opacity="0.35" />
          <path d="M10 6 C10 -2 46 -2 46 6 L46 12 L10 12 Z" fill="#8A4B2E" stroke={INK} strokeWidth="1.4" transform="rotate(-18 10 12)" />
          <circle cx="22" cy="20" r="4" fill="#C9A24A" stroke={INK} />
          <circle cx="30" cy="18" r="4" fill="#C9A24A" stroke={INK} />
          <circle cx="36" cy="22" r="3.6" fill="#C9A24A" stroke={INK} />
          <rect x="8" y="22" width="40" height="20" rx="2" fill="#8A4B2E" stroke={INK} strokeWidth="1.4" />
          <path d="M8 30h40" stroke="#C9A24A" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <path d="M8 20 C8 6 48 6 48 20 Z" fill="#8A4B2E" stroke={INK} strokeWidth="1.4" />
          <rect x="8" y="20" width="40" height="22" rx="2" fill="#8A4B2E" stroke={INK} strokeWidth="1.4" />
          <path d="M8 26h40" stroke="#C9A24A" strokeWidth="2" />
          <rect x="24" y="22" width="8" height="10" rx="1.5" fill="#C9A24A" stroke={INK} />
        </g>
      )}
    </svg>
  );
}

/** A brushed ensō that fills with progress (0–1) */
export function Enso({ progress, size = 80, label }: { progress: number; size?: number; label?: string }) {
  const { ids, defs } = usePaper();
  const filled = Math.max(2, Math.min(100, progress * 100));
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {defs}
      <circle cx="40" cy="40" r="28" fill="none" stroke="#8FA58A" strokeWidth="10" opacity="0.18" />
      <circle
        cx="40" cy="40" r="28" fill="none" stroke="#7F9879" strokeWidth="10" strokeLinecap="round"
        pathLength={100} strokeDasharray={`${filled} 100`} transform="rotate(-100 40 40)" filter={`url(#${ids.brush})`}
      />
    </svg>
  );
}

// ---------- Guardians (drawn in a 390 × 286 scene) ----------
const TENTACLES = [
  "M160 200 C130 210 110 190 100 160 C95 145 108 138 114 150",
  "M170 205 C150 240 110 240 88 226",
  "M230 200 C260 210 280 190 290 160 C295 145 282 138 276 150",
  "M220 205 C240 240 272 238 288 228",
  "M186 206 C182 232 168 248 150 256",
  "M204 206 C208 232 222 248 240 256",
];

function KrakenBody() {
  return (
    <g>
      <g fill="none" strokeLinecap="round">
        <g stroke={INK} strokeWidth="15">{TENTACLES.map((d) => <path key={d} d={d} />)}</g>
        <g stroke="#5F8A8B" strokeWidth="11">{TENTACLES.map((d) => <path key={d} d={d} />)}</g>
      </g>
      <path d="M148 176 C146 96 244 96 242 176 C242 196 226 210 195 210 C164 210 148 196 148 176 Z" fill="#5F8A8B" stroke={INK} strokeWidth="1.8" />
      <path d="M166 120 C176 106 196 102 210 108" fill="none" stroke="#EFE6D2" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <g fill="#46706F"><circle cx="172" cy="140" r="5" /><circle cx="218" cy="132" r="4" /><circle cx="226" cy="152" r="3" /><circle cx="164" cy="160" r="3" /></g>
      <ellipse cx="178" cy="174" rx="10" ry="8" fill="#EFE6D2" stroke={INK} strokeWidth="1.4" />
      <ellipse cx="212" cy="174" rx="10" ry="8" fill="#EFE6D2" stroke={INK} strokeWidth="1.4" />
      <circle cx="180" cy="176" r="4" fill={INK} /><circle cx="210" cy="176" r="4" fill={INK} />
      <path d="M166 162 L188 168 M224 162 L202 168" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}

function DragonBody() {
  return (
    <g>
      <path d="M110 236 L168 124 L222 124 L280 236 Z" fill="#8A4B2E" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M168 124 Q195 108 222 124 L214 144 Q195 134 176 144 Z" fill="#B23A2E" stroke={INK} strokeWidth="1.2" />
      <path d="M184 150 L176 200 M206 152 L214 196" stroke="#C9A24A" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M195 92 C160 58 128 70 116 46 C150 54 168 40 190 74 Z" fill="#6B2A22" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M195 92 C230 58 262 70 274 46 C240 54 222 40 200 74 Z" fill="#6B2A22" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M182 112 C180 88 210 88 208 112 C206 124 184 124 182 112 Z" fill="#6B2A22" stroke={INK} strokeWidth="1.4" />
      <circle cx="195" cy="74" r="13" fill="#6B2A22" stroke={INK} strokeWidth="1.4" />
      <path d="M186 64 L180 50 M204 64 L210 50" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="190" cy="74" r="2.6" fill="#C9A24A" /><circle cx="200" cy="74" r="2.6" fill="#C9A24A" />
      <path d="M195 86 Q190 100 180 104" fill="none" stroke="#B23A2E" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

/** Not drawn on the boards; made in the same ink-and-paper style as the others */
function GolemBody() {
  return (
    <g stroke={INK} strokeWidth="1.6" strokeLinejoin="round">
      <path d="M150 236 L158 178 L232 178 L240 236 Z" fill="#8E877A" />
      <path d="M138 176 L150 118 L240 118 L252 176 Z" fill="#A39C8C" />
      <path d="M118 128 L144 122 L150 186 L124 196 Z" fill="#8E877A" />
      <path d="M272 128 L246 122 L240 186 L266 196 Z" fill="#8E877A" />
      <path d="M170 118 L176 82 L214 82 L220 118 Z" fill="#B9B3A3" />
      <path d="M160 142 L178 150 M206 160 L226 148 M186 196 L200 212" stroke="#5C5546" strokeWidth="1.4" fill="none" />
      <rect x="182" y="96" width="8" height="5" fill="#C9A24A" stroke="none" />
      <rect x="200" y="96" width="8" height="5" fill="#C9A24A" stroke="none" />
      <path d="M150 140 q8 -6 14 2 M226 150 q8 -8 14 0" fill="none" stroke="#6E8B67" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** The boss scene: water, the guardian, a storm cloud and the X on the shore */
export function BossScene({ guardian, label, struck, beaten }: { guardian: Guardian | null; label: string; struck: boolean; beaten: boolean }) {
  const { ids, defs } = usePaper();
  return (
    <svg role="img" aria-label={label} viewBox="0 0 390 286" className="boss-scene">
      {defs}
      <rect x="12" y="4" width="366" height="278" rx="18" fill="#DCE0D0" stroke={LINE} />
      <rect x="12" y="4" width="366" height="278" rx="18" filter={`url(#${ids.grain})`} />
      <circle cx="195" cy="150" r="108" fill="none" stroke="#8FA58A" strokeWidth="26" strokeLinecap="round" strokeDasharray="600 79" transform="rotate(-70 195 150)" opacity="0.3" />
      <g transform="translate(64 50)" aria-hidden="true">
        <g filter={`url(#${ids.soft})`} fill="#B9B3A3"><circle r="16" /><circle cx="20" cy="-6" r="20" /><circle cx="40" cy="2" r="14" /></g>
        <path d="M18 14 L12 30 L20 30 L14 46" fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      </g>
      <g aria-hidden="true">
        <circle cx="330" cy="206" r={beaten ? 46 : 22} fill={`url(#${ids.glow})`} className="glow" />
        <path d="M300 222 C300 206 316 198 330 200 C346 198 360 208 358 222 Z" fill="#D9C39A" stroke={LINE} strokeWidth="1.2" />
        <path d="M322 196 L338 212 M338 196 L322 212" stroke="#B23A2E" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g className={`guardian${struck ? " struck" : ""}${beaten ? " beaten" : ""}`}>
        {guardian === "dragon" ? <DragonBody /> : guardian === "golem" ? <GolemBody /> : <KrakenBody />}
      </g>
      <path
        d="M12 232 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q15 -8 30 0 q6 -3 6 0 L378 264 Q378 282 360 282 L30 282 Q12 282 12 264 Z"
        fill="#A9C0BC" stroke={LINE}
      />
      <g fill="none" stroke="#5F8A8B" strokeWidth="1.2" strokeLinecap="round" opacity="0.7">
        <path d="M60 256 q5 -5 10 0 q5 -5 10 0" /><path d="M200 266 q5 -5 10 0 q5 -5 10 0" /><path d="M300 254 q5 -5 10 0 q5 -5 10 0" />
      </g>
    </svg>
  );
}

// ---------- The monk ----------
function MonkFigure() {
  return (
    <g>
      <path d="M96 458 C96 428 150 426 195 432 C240 426 294 428 294 458 C294 476 240 480 195 476 C150 480 96 476 96 458 Z" fill={INK} />
      <path d="M168 354 C148 366 140 404 138 440 L252 440 C250 404 242 366 222 354 L210 356 L195 376 L180 356 Z" fill={INK} />
      <path d="M180 354 L195 376 L210 354 L204 351 L195 364 L186 351 Z" fill="#EFE6D2" />
      <path d="M150 400 C160 420 176 430 195 432 C214 430 230 420 240 400" fill="none" stroke="#3A3832" strokeWidth="1.4" />
      <ellipse cx="185" cy="436" rx="10" ry="6.5" fill="#EFE6D2" stroke={INK} />
      <ellipse cx="205" cy="436" rx="10" ry="6.5" fill="#EFE6D2" stroke={INK} />
      <circle cx="188" cy="436" r="2.6" fill={INK} /><circle cx="202" cy="436" r="2.6" fill={INK} />
      <ellipse cx="195" cy="344" rx="20" ry="15" fill={INK} />
      <path d="M116 334 L195 290 L274 334 Q195 346 116 334 Z" fill="#D4BC86" stroke={LINE} strokeWidth="1.2" strokeLinejoin="round" />
      <g stroke="#A8915F" strokeWidth="0.8" opacity="0.9">
        <path d="M195 290 L130 334 M195 290 L150 337 M195 290 L172 339 M195 290 L195 340 M195 290 L218 339 M195 290 L240 337 M195 290 L260 334" />
        <path d="M150 316 Q195 324 240 316 M134 325 Q195 334 256 325" />
      </g>
      <path d="M176 342 L174 360 M214 342 L216 360" stroke={LINE} strokeWidth="0.8" />
    </g>
  );
}

/** The meditation scene: the monk under an ensō that fills as the session runs */
export function MonkScene({ progress, label }: { progress: number; label: string }) {
  const { ids, defs } = usePaper();
  const filled = Math.max(1, Math.min(100, progress * 100));
  return (
    <svg role="img" aria-label={label} viewBox="0 0 390 560" className="monk-scene">
      {defs}
      <circle cx="195" cy="236" r="138" fill="none" stroke="#8FA58A" strokeWidth="34" opacity="0.16" filter={`url(#${ids.brush})`} />
      <circle
        cx="195" cy="236" r="138" fill="none" stroke="#7F9879" strokeWidth="34" strokeLinecap="round" pathLength={100}
        strokeDasharray={`${filled} 100`} transform="rotate(-96 195 236)" filter={`url(#${ids.brush})`} className="enso-arc"
      />
      <g filter={`url(#${ids.soft})`} opacity="0.9">
        <circle cx="96" cy="318" r="34" fill="#F4EEE1" /><circle cx="132" cy="300" r="40" fill="#F4EEE1" /><circle cx="70" cy="346" r="30" fill="#E7E0D0" />
        <circle cx="296" cy="300" r="40" fill="#F4EEE1" /><circle cx="330" cy="326" r="32" fill="#E7E0D0" /><circle cx="262" cy="330" r="28" fill="#F4EEE1" />
        <circle cx="195" cy="404" r="70" fill="#F1EADB" />
      </g>
      <rect x="0" y="452" width="390" height="108" fill={`url(#${ids.grass})`} />
      <path d="M12 456 l-2 -10 M30 456 l2 -14 M52 456 l-1 -8 M76 456 l3 -12 M98 456 l-2 -9 M286 456 l2 -12 M304 456 l-1 -9 M326 456 l3 -15 M348 456 l-2 -10 M372 456 l1 -12" stroke="#3F5A39" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
      <rect x="0" y="452" width="390" height="108" filter={`url(#${ids.grain})`} />
      <MonkFigure />
    </svg>
  );
}

/** Just the monk, for onboarding */
export function MonkBust({ size = 96 }: { size?: number }) {
  return (
    <svg className="monk-bob" width={size} height={(size * 210) / 190} viewBox="100 270 190 210" role="img" aria-label="Your guide, a monk in a straw hat">
      <MonkFigure />
    </svg>
  );
}

export { KrakenBody, DragonBody, GolemBody };
