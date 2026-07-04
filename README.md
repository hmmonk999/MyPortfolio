# Portfolio site

A plain HTML/CSS/JS portfolio site — no build step, no framework. Designed
to be easy to reskin and extend as you add real projects.

## How it's organized

```
index.html                 Home page — hero, selected work, and the
                            "About Me" section (#about-me)
projects.html               All projects, with tag filtering
case-study-template.html    Duplicate this per project (see comment inside)
styleguide.html             Every component in one place — your reference,
                             not linked from the public nav
partials/
  header.html                Shared nav, injected into every page by js/include.js
  footer.html                Shared footer
css/
  tokens.css                 Colors, type scale, spacing, radius — change
                              values here to reskin the whole site
  base.css                   Reset + default element styles
  layout.css                 Nav (side rail / bottom tab bar), footer, hero,
                              grid structure
  components.css             Buttons, cards, tags, forms, filter chips —
                              the "component library"
  utilities.css               Small helper classes (text-muted, mt-lg, etc.)
js/
  include.js                  Loads partials/header.html and footer.html into
                              every page
  main.js                     Active nav link, footer year, project tag filter
assets/img/                   Images, favicon
```

## Navigation

The nav only has three primary items: **Home** (`index.html`), **Projects**
(`projects.html`), and **About Me** (`index.html#about-me`, a section on the
home page rather than its own file). It's responsive without a hamburger
menu:

- **Mobile:** fixed tab bar along the bottom of the screen.
- **Tablet and desktop (≥700px):** fixed rail along the left side.

Both are the same `.site-nav` markup in `partials/header.html` — the layout
switch happens entirely in the `@media (min-width: 700px)` block in
`css/layout.css`. `body` has matching padding (`--tabbar-height` on mobile,
`--nav-width` on desktop, both defined in `css/tokens.css`) so page content
never sits underneath the fixed nav. To add another primary nav item, add a
matching `<li>` in both places; to link to a secondary page instead (like
`case-study-template.html` or `styleguide.html`), keep it out of the nav and
link to it from within a page instead, the way project cards link to case
studies.

## Editing

- **Colors, fonts, spacing:** edit `css/tokens.css`. Every component
  references these variables, so a change there cascades everywhere.
- **A component's look (buttons, cards, tags...):** edit `css/components.css`.
  Open `styleguide.html` while you work — it renders every component so you
  can see the effect immediately without hunting through real pages.
- **Nav links or footer:** edit `partials/header.html` / `partials/footer.html`
  once; every page picks up the change automatically.
- **Adding a new project:**
  1. Duplicate `case-study-template.html`, rename it (e.g.
     `case-study-fintech-onboarding.html`).
  2. Follow the instructions in the HTML comment near the top of that file.
  3. Add a matching `<article class="card card--project">` block to
     `projects.html` (and `index.html` if it should be featured), linking to
     your new file.

## Previewing locally

Because the header/footer are loaded via `fetch()`, opening `index.html`
directly (`file://...`) will fail silently (browsers block `fetch` for local
files). Run a tiny local server instead, from this folder:

```bash
# Python (usually preinstalled)
python -m http.server 8000

# or, if you have Node
npx serve .
```

Then open `http://localhost:8000`.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial portfolio site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Source**, choose the `main` branch and
   `/ (root)` folder, then save.
3. Your site will be live at `https://<your-username>.github.io/<repo-name>/`
   within a minute or two.

No build step is required — GitHub Pages serves these static files directly.
