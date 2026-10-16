/** Original decorative line work; not an official flag or a geographic map. */
export function PhilippineSun({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true" focusable="false">
    <circle cx="50" cy="50" r="16" fill="currentColor" />
    {Array.from({ length: 8 }, (_, i) => <g key={i} transform={`rotate(${i * 45} 50 50)`} fill="currentColor">
      <path d="m48 9 2-5 2 5-1 20h-2L48 9Z" /><path d="m42 14 2-3 2 18h-2l-2-15ZM54 29l2-18 2 3-2 15h-2Z" />
    </g>)}
  </svg>;
}

export function IslandWaves({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 280 95" fill="none" aria-hidden="true" focusable="false">
    <path d="m30 54 24-28 18 22 13-13 20 20M59 49l5-14 8 13M122 53c17-21 29-32 40-32 17 0 21 31 37 31M207 53c9-19 19-29 29-29s17 11 24 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 66c16-9 29-9 45 0s28 9 44 0 28-9 44 0 28 9 44 0 28-9 44 0 28 9 39 1M21 80c16-9 29-9 45 0s28 9 44 0 28-9 44 0 28 9 44 0 28-9 44 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="112" cy="22" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M112 8V4m0 36v-4m-14-14h-4m36 0h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>;
}
