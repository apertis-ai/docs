// The Apertis mark as a monochrome inline SVG (openspec docs-shell-interfaces Palette, brand teal removed on
// 2026-10-02): the shapes of static/img/logo.svg, painted in the current theme's ink and page colours. Used
// by the header, the footer and the navigation sheet; the legacy /img/logo.svg stays served at its
// inventory path but the shell no longer shows it.
export default function Logo() {
  return (
    <svg className="brand__mark" viewBox="0 0 512 512" width="24" height="24" aria-hidden="true">
      <rect width="512" height="512" rx="108" style={{ fill: 'var(--ink)' }} />
      <path d="M298 108 L412 412 L350 412 L298 300 L232 300 L152 412 Z" style={{ fill: 'var(--bg)' }} opacity="0.45" />
      <path d="M244 108 L366 412 L300 412 L256 308 L190 308 L108 412 Z" style={{ fill: 'var(--bg)' }} />
      <polygon points="190,308 206,266 318,266 300,308" style={{ fill: 'var(--ink)' }} />
    </svg>
  );
}
