/** Original Brclio character: a rounded blue explorer with a visible orange direction marker. */
export function RobotGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="40" cy="67" rx="27" ry="7" fill="#163c78" opacity=".13" />
      <rect x="9" y="29" width="12" height="28" rx="6" fill="#3071d7" />
      <rect x="59" y="29" width="12" height="28" rx="6" fill="#3071d7" />
      <rect x="20" y="55" width="13" height="13" rx="5" fill="#245cae" />
      <rect x="47" y="55" width="13" height="13" rx="5" fill="#245cae" />
      <rect
        x="16"
        y="18"
        width="48"
        height="44"
        rx="16"
        fill="#62a4ff"
        stroke="#2f75d9"
        strokeWidth="2"
      />
      <path d="M40 3 48 13H32L40 3Z" fill="#ffbf48" stroke="#efa82b" strokeWidth="1.5" />
      <rect x="21" y="26" width="38" height="25" rx="10" fill="#f2fbff" />
      <rect x="27" y="32" width="5" height="9" rx="2.5" fill="#163b6a" />
      <rect x="48" y="32" width="5" height="9" rx="2.5" fill="#163b6a" />
      <path d="M36 43Q40 47 44 43" stroke="#163b6a" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="56" r="3" fill="#d8f0ff" />
    </svg>
  );
}
