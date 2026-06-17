import React from "react";

interface EasyRiggingLogoProps {
  className?: string;
  size?: number; // width and height in px
}

export default function EasyRiggingLogo({ className = "", size = 160 }: EasyRiggingLogoProps) {
  return (
    <svg
      id="easy-rigging-logo-svg"
      width={size}
      height={size}
      viewBox="0 0 500 500"
      className={`select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Ball shading radial gradient */}
        <radialGradient id="ball-grad" cx="42%" cy="42%" r="58%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="25%" stopColor="#ef4444" />
          <stop offset="70%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>

        {/* Double outline outer ring gradient */}
        <radialGradient id="outer-glow" cx="50%" cy="50%" r="50%">
          <stop offset="90%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.15" />
        </radialGradient>

        {/* Clip path to restrict ball pattern strictly within the sphere */}
        <clipPath id="ball-clip">
          <circle cx="250" cy="250" r="126" />
        </clipPath>

        {/* Circle paths for curved text */}
        {/* Top arc path: curves clockwise around the top */}
        <path
          id="text-path-top"
          d="M 68,250 A 182,182 0 0,1 432,250"
          fill="none"
        />
        {/* Bottom arc path: curves clockwise around the bottom but right-to-left so text flows upright */}
        <path
          id="text-path-bottom"
          d="M 432,250 A 182,182 0 0,1 68,250"
          fill="none"
        />
      </defs>

      {/* Main black background circular badge */}
      <circle cx="250" cy="250" r="236" fill="#0c0a09" stroke="#ef4444" strokeWidth="3" />
      <circle cx="250" cy="250" r="236" fill="url(#outer-glow)" />

      {/* Red Futsal Ball Sphere */}
      <g clipPath="url(#ball-clip)">
        <circle cx="250" cy="250" r="126" fill="url(#ball-grad)" />

        {/* Dark Red Seams - Hand-stitched Futsal mesh look */}
        <polygon
          points="250,222 276,240 266,272 234,272 224,240"
          fill="#450a0a"
          fillOpacity="0.25"
          stroke="#450a0a"
          strokeWidth="3.5"
        />
        {/* Spokes radiating from center pentagon to next panels */}
        <line x1="250" y1="222" x2="250" y2="178" stroke="#450a0a" strokeWidth="4.5" />
        <line x1="276" y1="240" x2="318" y2="252" stroke="#450a0a" strokeWidth="4.5" />
        <line x1="266" y1="272" x2="291" y2="315" stroke="#450a0a" strokeWidth="4.5" />
        <line x1="234" y1="272" x2="209" y2="315" stroke="#450a0a" strokeWidth="4.5" />
        <line x1="224" y1="240" x2="182" y2="252" stroke="#450a0a" strokeWidth="4.5" />

        {/* Surrounding hexagonal panels */}
        <polygon points="250,178 296,155 318,202 276,240" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="318,202 355,225 318,252" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="318,252 332,305 291,315" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="291,315 250,338 209,315" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="209,315 168,305 182,252" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="182,252 145,225 182,202" fill="none" stroke="#450a0a" strokeWidth="4.2" />
        <polygon points="182,202 204,155 250,178" fill="none" stroke="#450a0a" strokeWidth="4.2" />
      </g>

      {/* Styled Slanted Capital 'E' in the center of the ball */}
      {/* Formula applied: X_new = X + (250 - Y) * 0.23 */}
      <path
        d="M 203,170 L 348,170 L 341,201 L 236,201 L 231,226 L 296,226 L 289,255 L 224,255 L 218,280 L 303,280 L 296,310 L 171,310 Z"
        fill="#ffffff"
        filter="drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.4))"
      />

      {/* Circular Text Arches */}
      {/* Top curved text: "EASY RIGGING" */}
      <text fill="#ffffff" fontSize="33" fontWeight="900" letterSpacing="14" fontFamily="system-ui, -apple-system, sans-serif">
        <textPath href="#text-path-top" startOffset="50%" textAnchor="middle">
          EASY RIGGING
        </textPath>
      </text>

      {/* Bottom curved text: "FUTSAL TEAM" */}
      <text fill="#ffffff" fontSize="33" fontWeight="900" letterSpacing="14" fontFamily="system-ui, -apple-system, sans-serif">
        <textPath href="#text-path-bottom" startOffset="50%" textAnchor="middle">
          FUTSAL TEAM
        </textPath>
      </text>
    </svg>
  );
}
