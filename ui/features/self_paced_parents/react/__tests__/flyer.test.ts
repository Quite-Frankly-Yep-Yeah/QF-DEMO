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

import {escapeHtml, flyerHtml, printHtml, type FlyerData, type FlyerText} from '../flyer'

const text: FlyerText = {
  documentTitle: 'Parent sign-up flyer',
  title: "Follow your student's progress",
  lead: 'See how your student is doing.',
  scan: 'Scan this code',
  howItWorks: 'How it works',
  steps: ['Open the link.', 'Make an account.'],
  orOpen: "Can't scan? Open this address:",
}

const data: FlyerData = {
  schoolName: 'Northside High',
  url: 'https://lms.school.example/parents/signup/abc123def456',
  qrSvg: '<svg role="img" aria-label="QR code"><path d="M0 0"/></svg>',
  contact: '',
}

describe('escapeHtml', () => {
  it('makes text safe to put in a page', () => {
    expect(escapeHtml(`<b onclick="x()">Tom & 'Jerry'</b>`)).toBe(
      '&#60;b onclick=&#34;x()&#34;&#62;Tom &#38; &#39;Jerry&#39;&#60;/b&#62;',
    )
  })
})

describe('flyerHtml', () => {
  it('has the school, the title, the QR code, every step and the address', () => {
    const html = flyerHtml(text, data)
    const doc = new DOMParser().parseFromString(html, 'text/html')

    expect(doc.title).toBe('Parent sign-up flyer')
    expect(doc.querySelector('.school')?.textContent).toBe('Northside High')
    expect(doc.querySelector('h1')?.textContent).toBe("Follow your student's progress")
    expect(doc.querySelector('.qr svg')).not.toBeNull()
    expect([...doc.querySelectorAll('li')].map(li => li.textContent)).toEqual([
      'Open the link.',
      'Make an account.',
    ])
    expect(doc.querySelector('.url')?.textContent).toBe(data.url)
  })

  it('lays the page out as Material cards: a hero, a QR card, a steps card and the address', () => {
    const doc = new DOMParser().parseFromString(flyerHtml(text, data), 'text/html')

    expect(doc.querySelector('header.card.hero h1')).not.toBeNull()
    expect(doc.querySelector('.card.qr-card .qr svg')).not.toBeNull()
    expect(doc.querySelector('.card.steps h2')?.textContent).toBe('How it works')
    expect(doc.querySelectorAll('.card.steps li')).toHaveLength(2)
    expect(doc.querySelector('.card.url-card .label')?.textContent).toBe(
      "Can't scan? Open this address:",
    )
    expect(doc.querySelectorAll('.card').length).toBeGreaterThanOrEqual(4)
  })

  it("sets the page in Roboto, with the site's own font files as well as any installed copy", () => {
    const html = flyerHtml(text, data)

    expect(html).toMatch(/font-family:\s*Roboto,/)
    for (const [weight, file] of [
      [300, 'Roboto-Light'],
      [400, 'Roboto-Regular'],
      [500, 'Roboto-Medium'],
      [700, 'Roboto-Bold'],
    ] as const) {
      expect(html).toContain(`font-weight:${weight};src:local("`)
      expect(html).toContain(`url("/fonts/roboto/${file}.woff2")`)
    }
  })

  it('lets a long address wrap after a slash, not in the middle of the code', () => {
    const html = flyerHtml(text, data)

    expect(html).toContain('parents/<wbr>signup/<wbr>abc123def456')
    // never inside the code itself
    expect(html).not.toMatch(/abc<wbr>|c123<wbr>|<wbr>def/)
  })

  it('only has a contact line when the school wrote one', () => {
    const without = new DOMParser().parseFromString(flyerHtml(text, data), 'text/html')
    expect(without.querySelector('.contact')).toBeNull()

    const blank = new DOMParser().parseFromString(
      flyerHtml(text, {...data, contact: '   '}),
      'text/html',
    )
    expect(blank.querySelector('.contact')).toBeNull()

    const withLine = new DOMParser().parseFromString(
      flyerHtml(text, {...data, contact: ' Call 555-0100 '}),
      'text/html',
    )
    expect(withLine.querySelector('.contact')?.textContent).toBe('Call 555-0100')
  })

  it("can't be broken by what the school types", () => {
    const html = flyerHtml(text, {
      ...data,
      schoolName: '<img src=x onerror=alert(1)>',
      contact: '</p><script>alert(1)</script>',
    })
    const doc = new DOMParser().parseFromString(html, 'text/html')

    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('img')).toBeNull()
    expect(doc.querySelector('.school')?.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('fits on one page: a single sheet, no forced breaks, no page margin of its own', () => {
    const html = flyerHtml(text, data)

    expect(html.match(/class="sheet"/g)).toHaveLength(1)
    expect(html).not.toMatch(/page-break|break-(before|after)/)
    expect(html).toContain('@page { size: auto; margin: 0; }')
  })

  it('keeps the shadows and colours when printed', () => {
    const html = flyerHtml(text, data)

    expect(html).toContain('print-color-adjust: exact')
    expect(html).toMatch(/box-shadow:\s*0 3px 6px rgba\(0, 0, 0, 0\.16\)/)
  })
})

describe('printHtml', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('prints from a hidden frame and cleans it up afterwards', () => {
    printHtml('<p>hello</p>')
    const frame = document.querySelector('iframe') as HTMLIFrameElement

    expect(frame).not.toBeNull()
    expect(frame.getAttribute('aria-hidden')).toBe('true')
    expect(frame.srcdoc).toBe('<p>hello</p>')

    const win = frame.contentWindow as Window
    const print = vi.fn()
    win.print = print
    win.focus = vi.fn()
    frame.dispatchEvent(new Event('load'))
    expect(print).toHaveBeenCalledTimes(1)

    win.dispatchEvent(new Event('afterprint'))
    expect(document.querySelector('iframe')).toBeNull()
  })

  // a frame whose document can load fonts, like a real browser's
  function frameWithFonts(load: (font: string) => Promise<unknown>) {
    printHtml('<p>hello</p>')
    const frame = document.querySelector('iframe') as HTMLIFrameElement
    const win = frame.contentWindow as Window
    Object.defineProperty(win.document, 'fonts', {value: {load}, configurable: true})
    const print = vi.fn()
    win.print = print
    win.focus = vi.fn()
    frame.dispatchEvent(new Event('load'))
    return print
  }

  it('waits for Roboto to load before printing, or the paper comes out in a stand-in font', async () => {
    // one pending promise per weight, all settled together when the fonts arrive
    const arrivals: (() => void)[] = []
    const load = vi.fn((_font: string) => new Promise<void>(resolve => arrivals.push(resolve)))
    const print = frameWithFonts(load)

    expect(load.mock.calls.map(call => call[0])).toEqual([
      '300 1em Roboto',
      '400 1em Roboto',
      '500 1em Roboto',
    ])
    await Promise.resolve()
    expect(print).not.toHaveBeenCalled()

    arrivals.forEach(arrive => arrive())
    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it("prints anyway when a font never arrives, so a missing file can't block the flyer", async () => {
    vi.useFakeTimers()
    try {
      const print = frameWithFonts(() => new Promise(() => {}))
      await vi.advanceTimersByTimeAsync(2000)
      expect(print).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1500)
      expect(print).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('prints anyway when loading a font fails', async () => {
    const print = frameWithFonts(() => Promise.reject(new Error('404')))

    await vi.waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })
})
