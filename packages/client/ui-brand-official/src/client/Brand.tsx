import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type CurupiraBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the CurupiraCode trail-circuit C and its reversed footprints.
 * @param props - Host-supplied mark presentation.
 * @returns the CurupiraCode mark.
 */
export function CurupiraBrandMark({ size, className }: CurupiraBrandMarkProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`curupira-trail-${size}`} x1="10" y1="9" x2="53" y2="55" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6AC587" />
          <stop offset="1" stopColor="#2F7D4C" />
        </linearGradient>
      </defs>
      <path
        d="M49 13C43 7 35 5 27 7 16 9 8 19 8 32s8 23 19 25c8 2 16 0 22-6"
        stroke={`url(#curupira-trail-${size})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M48 13h7v7" stroke="#6AC587" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="52.5" cy="48.5" r="3.5" fill="#2F7D4C" />
      <g fill="#D6A04A">
        <ellipse cx="27" cy="27" rx="3.4" ry="5.7" transform="rotate(-28 27 27)" />
        <circle cx="30.7" cy="33" r="1.55" />
        <circle cx="27.6" cy="33.7" r="1.35" />
        <circle cx="24.8" cy="32.7" r="1.2" />
        <ellipse cx="38" cy="39" rx="3.4" ry="5.7" transform="rotate(152 38 39)" />
        <circle cx="34.3" cy="33" r="1.55" />
        <circle cx="37.4" cy="32.3" r="1.35" />
        <circle cx="40.2" cy="33.3" r="1.2" />
      </g>
    </svg>
  )
}

/**
 * Render the CurupiraCode name independently from the mark.
 * @returns the CurupiraCode wordmark.
 */
export function CurupiraBrandName() {
  return (
    <svg width="148" height="28" viewBox="0 0 148 28" role="img" aria-label="CurupiraCode">
      <text x="0" y="20" fill="currentColor" fontFamily="Inter, ui-sans-serif, system-ui" fontSize="18" fontWeight="750" letterSpacing="-0.5">Curupira</text>
      <text x="75" y="20" fill="#D6A04A" fontFamily="Inter, ui-sans-serif, system-ui" fontSize="18" fontWeight="750" letterSpacing="-0.5">Code</text>
    </svg>
  )
}
