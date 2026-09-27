/*
 * Copyright (C) 2026 - present quite frankly an example LMS contributors
 *
 * This file is part of quite frankly an example LMS, a modified version of Canvas.
 *
 * quite frankly an example LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// The printable parent sign-up flyer, in the same Material Design 1 look as the
// rest of the app: Roboto, and white cards with shadows on a light surface. It
// imports nothing on purpose: the page is built as one self-contained document
// (the words come in from the caller, already translated) so it prints the same
// whatever the site around it looks like, and can be rendered on its own to
// check the layout.

export type FlyerText = {
  documentTitle: string
  title: string
  lead: string
  scan: string
  // the heading of the card with the steps
  howItWorks: string
  steps: string[]
  orOpen: string
}

export type FlyerData = {
  schoolName: string
  url: string
  // the server draws this from an address it built itself
  qrSvg: string
  // an optional line the school adds, like a phone number
  contact: string
}

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`)

// A long address wraps after a slash, so the code at the end stays in one piece
// instead of being cut in the middle.
const breakableUrl = (url: string): string => escapeHtml(url).replace(/\//g, '/<wbr>')

// Material 2014 500s, the same colours as the rest of the app
const BAND = ['#F44336', '#FF9800', '#FFC107', '#4CAF50', '#2196F3', '#9C27B0']

// The printed page is its own document, so it doesn't get the site's fonts. The
// same Roboto files the site ships are named here; a copy already installed on
// the computer is used first.
const ROBOTO_FILES: [weight: number, local: string, file: string][] = [
  [300, 'Roboto Light', 'Roboto-Light'],
  [400, 'Roboto', 'Roboto-Regular'],
  [500, 'Roboto Medium', 'Roboto-Medium'],
  [700, 'Roboto Bold', 'Roboto-Bold'],
]

const FONT_FACES = ROBOTO_FILES.map(
  ([weight, local, file]) =>
    `@font-face{font-family:Roboto;font-style:normal;font-weight:${weight};src:local("${local}"),local("${file}"),url("/fonts/roboto/${file}.woff2") format("woff2");}`,
).join('')

// Material paper: shadows for 1dp, 2dp and 4dp
const STYLE = `
@page { size: auto; margin: 0; }
* { box-sizing: border-box; }
html { background: #F5F5F5; }
html, body { margin: 0; padding: 0; }
body {
  font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: rgba(0, 0, 0, 0.87);
  background: #F5F5F5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.sheet { padding: 0.5in 0.5in 0; }
.card {
  background: #fff;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23);
}
.hero {
  background: #1565C0;
  color: #fff;
  border: 0;
  overflow: hidden;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23);
}
.band { display: flex; height: 0.1in; }
.band span { flex: 1; }
.hero-body { padding: 0.32in 0.4in 0.72in; text-align: center; }
.school { margin: 0; font-size: 15px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255, 255, 255, 0.85); overflow-wrap: anywhere; }
h1 { margin: 0.1in 0 0.1in; font-size: 42px; font-weight: 300; line-height: 1.1; letter-spacing: -0.5px; }
.lead { margin: 0 auto; max-width: 5.8in; font-size: 17px; line-height: 1.45; color: rgba(255, 255, 255, 0.92); }
.qr-card { position: relative; width: 4.3in; margin: -0.5in auto 0; padding: 0.25in 0.25in 0.2in; text-align: center; box-shadow: 0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23); }
.qr { width: 3.3in; height: 3.3in; margin: 0 auto; }
.qr svg { display: block; width: 100%; height: 100%; }
.scan { margin: 0.14in 0 0; font-size: 19px; font-weight: 500; }
.steps { margin: 0.22in 0 0; padding: 0.2in 0.35in 0.12in; }
h2 { margin: 0 0 0.1in; font-size: 24px; font-weight: 300; }
ol { margin: 0; padding: 0; list-style: none; counter-reset: step; }
li { position: relative; margin: 0 0 0.1in; padding: 0.03in 0 0 0.5in; min-height: 0.34in; font-size: 17px; line-height: 1.35; counter-increment: step; }
li::before {
  content: counter(step);
  position: absolute; left: 0; top: 0;
  width: 0.34in; height: 0.34in; border-radius: 50%;
  background: #1565C0; color: #fff; font-weight: 500; line-height: 0.34in; text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
}
.row { display: flex; gap: 0.2in; margin: 0.22in 0 0; }
.row .card { flex: 1; padding: 0.16in 0.25in; }
.row .url-card { flex: 1.5; }
.label { margin: 0; font-size: 13px; color: rgba(0, 0, 0, 0.54); }
.url { margin: 0.04in 0 0; font-size: 16px; font-weight: 500; overflow-wrap: anywhere; }
.contact { margin: 0; font-size: 17px; line-height: 1.4; overflow-wrap: anywhere; }
`

// One page of paper, top to bottom: a hero card with the school and what this
// is for, a QR card that overlaps it, a card with the steps, and a row with the
// address for anyone who can't scan and the school's own line.
export function flyerHtml(text: FlyerText, data: FlyerData): string {
  const band = BAND.map(color => `<span style="background:${color}"></span>`).join('')
  const steps = text.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')
  const contact = data.contact.trim()
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    text.documentTitle,
  )}</title><style>${FONT_FACES}${STYLE}</style></head><body><div class="sheet"><header class="card hero"><div class="band" aria-hidden="true">${band}</div><div class="hero-body"><p class="school">${escapeHtml(
    data.schoolName,
  )}</p><h1>${escapeHtml(text.title)}</h1><p class="lead">${escapeHtml(
    text.lead,
  )}</p></div></header><section class="card qr-card"><div class="qr">${
    data.qrSvg
  }</div><p class="scan">${escapeHtml(text.scan)}</p></section><section class="card steps"><h2>${escapeHtml(
    text.howItWorks,
  )}</h2><ol>${steps}</ol></section><div class="row"><section class="card url-card"><p class="label">${escapeHtml(
    text.orOpen,
  )}</p><p class="url">${breakableUrl(data.url)}</p></section>${
    contact
      ? `<section class="card contact-card"><p class="contact">${escapeHtml(contact)}</p></section>`
      : ''
  }</div></div></body></html>`
}

// The weights the flyer uses, in the shorthand document.fonts.load wants
const FONTS_USED = ['300 1em Roboto', '400 1em Roboto', '500 1em Roboto']
// A font that never arrives shouldn't stop the flyer printing
const FONT_WAIT_MS = 3000

// Prints a document from a hidden frame, so there's no pop-up to be blocked
// and nothing left on screen afterwards. Waits for Roboto to load first, or the
// paper comes out in a stand-in font.
export function printHtml(html: string, doc: Document = document): void {
  const frame = doc.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('tabindex', '-1')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  const remove = () => frame.remove()
  frame.addEventListener(
    'load',
    () => {
      const win = frame.contentWindow
      if (!win) return remove()
      const print = () => {
        win.addEventListener('afterprint', remove)
        win.focus()
        win.print()
        // afterprint doesn't fire everywhere
        window.setTimeout(remove, 120_000)
      }
      const fonts = win.document.fonts
      if (!fonts?.load) return print()

      const loaded = Promise.all(FONTS_USED.map(font => fonts.load(font))).catch(() => [])
      const gaveUp = new Promise(resolve => window.setTimeout(resolve, FONT_WAIT_MS))
      Promise.race([loaded, gaveUp]).then(print)
    },
    {once: true},
  )
  frame.srcdoc = html
  doc.body.appendChild(frame)
}
