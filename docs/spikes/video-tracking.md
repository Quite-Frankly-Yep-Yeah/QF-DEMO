# Spike: tracking full video viewing

Phase 0 of `docs/fork-plan.md` (risk R2). Date: 2026-09-22.

**Question:** can we tell, with no heavy client tracking, that a student watched a video to the end, so a `must_watch` requirement can be met on the server?

**Answer: yes, for YouTube, Vimeo and Canvas-hosted media. Nothing found blocks it.** This was a code-level investigation. No browser was available in this session, so the approach below still needs a live proof before Phase 3 is marked done. The pilot course (Algebra 1) has no video, so nothing depends on this before Phase 3.

## What the code shows

| Question | Finding | Where |
|---|---|---|
| Does the HTML sanitizer keep what the YouTube and Vimeo player APIs need? | Yes. `iframe` keeps `src` with its full query string, so `enablejsapi=1` survives. `allow` and `allowfullscreen` are kept too. | `gems/canvas_sanitize/lib/canvas_sanitize/canvas_sanitize.rb:251` |
| How do videos get into pages? | Two ways. (1) Pasted `<iframe>` embeds, which are kept as they are. (2) YouTube *links*, which the browser turns into a player on click. That player is built with `autoplay=1` and no API flag. | `packages/canvas-rce/src/enhance-user-content/enhance_user_content.js:81` |
| Is anything rewritten on the server for the web? | No. `YoutubeBannerInjectionService` only runs on HTML sent to the mobile apps. | `lib/api/html/content.rb:182-187` |
| Does the security policy block the player APIs? | Not by default: the only header set is `frame-ancestors`. If an admin turns on the account content security policy (`Csp::AccountHelper`), `www.youtube.com` and `player.vimeo.com` must be on the allowlist. | `app/controllers/application_controller.rb:1237-1243`, `app/models/csp/account_helper.rb` |
| Can we observe playback in the Canvas media player? | Yes. `CanvasMediaPlayer` renders `@instructure/ui-media-player` with a `ref` and an `onLoadedMetadata` handler. The event target is the underlying `<video>`, so `timeupdate`/`ended` listeners can be attached there. The player runs in a same-origin iframe, so it can `postMessage` progress to the page. | `ui/shared/canvas-media-player/react/CanvasMediaPlayer.jsx:279-286`, route `media_attachments_iframe` (`config/routes.rb:619`) |

## Approach for Phase 3

1. **Find videos.** In player courses, the player script looks for YouTube/Vimeo iframes inside page content, and for Canvas media iframes. Before the student presses play, it adds `enablejsapi=1` (YouTube) or `api=1` (Vimeo) to each iframe `src`. The YouTube link-to-player code in `enhance_user_content.js` gets the same flag.
2. **Listen.** It uses the official YouTube IFrame API and Vimeo `player.js` (or their documented `postMessage` protocols) and a `postMessage` from our own media player. What it listens for: play, pause, seek, the current time, and the duration.
3. **Measure what was watched, not where the playhead is.** Keep a list of watched intervals, merge overlaps, and compute *covered seconds / duration*. Skipping ahead doesn't count.
4. **Report little.** Post the highest covered fraction for the item every ~15 seconds of new coverage, and on `ended`. Store only `video_progress(user, item, max_fraction, completed_at)`.
5. **Check on the server.** Only raise the stored fraction. Reject a jump that's faster than wall-clock time allows (at most 2× playback speed since the first report). Meet `must_watch` at the configured fraction (default 95%).
6. **Time on task.** While a video is playing, the activity pinger counts the student as active even without mouse or keyboard input (plan R4).

## Limits to accept

- A determined student can fake progress calls from the browser console. The server-side speed check stops casual skipping, not tampering. That's the same level of trust as Canvas's existing "mark as done".
- Videos from other hosts (for example Khan Academy's own player) need their own adapter or a fallback to `must_mark_done`.

## Still to do (Phase 3)

- A live check in a browser, with one YouTube iframe, one YouTube link and one Canvas media file.
- Confirm what `onLoadedMetadata` receives in the version of `@instructure/ui-media-player` in use. It isn't in `node_modules` on the WSL side, so its types weren't checked here.
