// The Apertis mark alone, as a monochrome inline SVG (openspec docs-shell-interfaces Palette, brand teal
// removed on 2026-10-02; operator review 2026-10-03: no tile behind it): the "A" of static/img/logo.svg in
// the current text colour, black on light and white on dark; its crossbar notch is cut out, so the page
// shows through. Used by the header, the footer and the navigation sheet; the legacy /img/logo.svg stays
// served at its inventory path.
export default function Logo() {
  return (
    <svg className="brand__mark" viewBox="100 100 320 320" width="24" height="24" aria-hidden="true" fill="currentColor">
      <path d="M298 108 L412 412 L350 412 L298 300 L232 300 L152 412 Z" opacity="0.45" />
      <path fillRule="evenodd" d="M244 108 L366 412 L300 412 L256 308 L190 308 L108 412 Z M190 308 L206 266 L318 266 L300 308 Z" />
    </svg>
  );
}
