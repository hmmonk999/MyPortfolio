# Card thumbnail videos

Motion thumbnails for the project cards. Each clip plays on hover/focus
and otherwise shows its poster frame, so it reads as a still image until
a visitor engages with the card. See `setupHoverVideos()` in
`js/main.js` and `.card__media--video` in `css/components.css`.

One card uses this: the volleyball playback panel, whose subject is a
rally and so cannot be drawn. Everything that was product UI is drawn in
CSS instead — see "AI COMMAND BAR DEMO" and "VOLLEYBALL PRODUCT DEMOS"
in `css/components.css`. That is the line worth holding: film the thing
that is genuinely photographic, draw the interface over it.

`volleyball-rally.mp4` is the exception, and it is prepared differently
from the recipe below. Its source had the product's chrome and its
ball-trajectory overlay burnt into the pixels, which pinned the panel to
one crop and one size. Both were taken back off — the chrome cropped
away, the overlay painted out — so the page can draw them at whatever
shape the card gives it, and so the trace can be driven off the video's
own clock (`setupBallTracks` in `js/main.js`) instead of being baked in
a dozen frames behind the ball.

`_demo.mp4` / `_demo-poster.jpg` are placeholders — replace them with
real clips.

## Adding a clip to a card

Swap the card's `<img>` for this block:

```html
<div class="card__media card__media--video">
  <video
    data-hover-video
    muted
    loop
    playsinline
    preload="none"
    poster="assets/video/<name>-poster.jpg"
  >
    <source src="assets/video/<name>.mp4" type="video/mp4" />
  </video>
</div>
```

- `poster` is required — it's the thumbnail before hover, on touch
  devices, and when the visitor prefers reduced motion.
- `preload="none"` keeps the mp4 bytes unfetched until first hover, so
  the page stays light no matter how many cards carry video.
- A card with no clip keeps its plain `<img>`; convert cards one at a
  time.

## Encoding specs

Keep clips short, silent, and small — they loop and there may be several
on a page.

- **Length:** 3–6s, designed to loop cleanly (start ≈ end).
- **Size:** ~1280px on the long edge is plenty at card size.
- **Codec:** H.264, `yuv420p` (widest browser support), no audio.
- **Web-optimized:** faststart so playback can begin before the full
  file downloads.
- **Weight:** aim for well under ~1.5 MB per clip.

Poster = the first frame, so the still and the loop's start match.

Example with ffmpeg (from a source clip):

```bash
# Encode
ffmpeg -i source.mov -t 5 -an -c:v libx264 -profile:v high \
  -pix_fmt yuv420p -movflags +faststart -vf "scale=1280:-2" \
  assets/video/my-clip.mp4

# Poster from the first frame
ffmpeg -i assets/video/my-clip.mp4 -frames:v 1 -q:v 3 \
  assets/video/my-clip-poster.jpg
```
