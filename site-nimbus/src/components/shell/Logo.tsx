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

// The "APERTIS" wordmark of the apertis.ai header (operator 2026-11-14): Geist (SIL OFL) outlines as one
// path, viewBox cropped to the cap box; the stylesheet lets the S overshoot it (an attribute here would
// make Tailwind emit a utility from the word). It replaces the
// set text beside the mark in the header and the navigation sheet, in the current text colour.
export function Wordmark() {
  return (
    <svg className="brand__wordmark" viewBox="0 6.25 583.875 88.75" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M2 95l32-89h16l32 89h-13l-27-79-27 79zm28-26h24l-3-9h-18zm78 26v-89h32q15 0 23 8 9 7 9 19 0 9-4 15-4 6-11 10-7 3-17 3h-21v34zm11-45h21q10 0 15-4 5-4 5-13 0-8-5-12-5-4-15-4h-21zm83 45v-89h56v11h-45v28h43v11h-43v28h46v11zm88 0v-89h34q9 0 16 4 7 3 10 9 4 6 4 14 0 6-3 11-3 4-7 7-4 3-9 3l-1-1q8 0 13 4 5 4 5 12l3 26h-11l-3-25q0-5-4-8-3-2-11-2h-25v35zm11-46h24q8 0 13-5 4-4 4-11 0-8-4-12-5-4-14-4h-23zm103 46v-78h-27v-11h66v11h-27v78zm64 0v-89h12v89zm78 2q-11 0-18-4-8-4-12-11-5-6-6-15l12-1q1 6 4 11 3 5 8 7 5 2 12 2 6 0 10-2 5-1 7-4 2-3 2-8 0-4-2-7-2-3-7-5-5-3-16-6-10-2-16-6-6-3-9-7-3-5-3-11 0-8 4-14 3-5 10-8 7-4 16-4 10 0 17 4 7 4 11 10 4 6 5 15h-12q0-5-3-9-3-4-7-6-5-3-11-3-8 0-13 4-5 4-5 10 0 4 2 7 2 2 7 4 5 2 14 5 11 3 18 7 6 3 9 8 3 5 3 12 0 7-4 13-4 6-11 9-7 3-16 3z" />
    </svg>
  );
}
