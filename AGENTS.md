# AGENTS.md

This file provides guidance to agentic coding agents (codex) when working with code in this repository.

## PROJECT OVERVIEW

This is a static website built with HTML, CSS, and JavaScript.
It features a retro DOS/CRT aesthetic with a modern twist.
The purpose of this site is to act as a portfolio and playground for software development projects, showcasing creativity and technical skills while feeling unique.

## KEY REQUIREMENTS

- Load quickly
- Be immediately responsive
- Work on mobile and desktop
- Work with Safari, Firefox, and Chromium browsers
- Prioritize accessibility and usability over flashy features if necessary
- Be simple to understand with minimal text and clear navigation
- Minimize dependencies and use vanilla JavaScript where possible
- Maintain a consistent visual style with a focus on typography and color
- Break from DOS/CRT style if it impacts readability, then make that break consistent

## PORTFOLIO SHOWCASE

Projects must be easily added, removed, and updated from being shown.
These can include links to GitHub repos, live web demos, downloadable files, or just webpages with images and paragraphs in a "blog post" style.

## RUNNING LOCALLY

Open `index.html` directly in a browser — no build step or server required.
All imports use ES6 modules (`type="module"`), so a local HTTP server is needed for
module resolution in some browsers. Use any static file server, e.g.:
`npx serve .` or VS Code Live Server.

## DEPLOYING

tbd

## PROJECT STRUCTURE

```cs
index.html          Homepage — hero + projects grid + blog list
style.css           Global styles and CSS variables (theme)
main.js             Renders project cards and blog post list from data.js
footer.js           Interactive terminal footer (hover/selection behavior)
data.js             Content source — edit this to add/remove projects and posts

projects/           One HTML file per project detail page
  project-alpha.html

posts/              One HTML file per blog post
  hello-world.html
```

### Adding a project

1. Create `projects/your-project.html` (copy `project-alpha.html` as a template).
2. Add an entry to the `PROJECTS` array in `data.js` with `file: "projects/your-project.html"`.
   Set `file: null` to show a card without a detail page.

### Adding a blog post

1. Create `posts/your-post.html` (copy `hello-world.html` as a template).
2. Add an entry to the `POSTS` array in `data.js` with the matching `file` path.

## UI

The UI uses custom CSS to create a DOS aesthetic with a monospace font.
It uses CRT scanlines via CSS and a phthalo green color palette.
It uses subtle animations and glow effects for a modern CRT feel.
All colors are defined as CSS variables on `:root` in `style.css` for easy adjustments.

## CODE STYLE

Follows the [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html). Key rules:

### HTML

- `<!doctype html>` and `charset="utf-8"` — always lowercase
- No inline styles — all styling in `style.css` or a page-level `<style>` block
- No `type` attribute on `<link>` or `<script>` tags (exception: `type="module"` is required for ES modules)
- No unnecessary entity references — use literal characters except where `<` or `&` must be escaped
- Double quotes for all HTML attribute values

### CSS

- Class selectors only — no ID selectors (e.g. `.nav`, not `#nav`)
- Declarations sorted alphabetically within each rule block
- Hyphen-delimited class names (`kebab-case`)
- No type+class selectors (use `.nav-title`, not `a.nav-title`)
- Omit units on zero values (`margin: 0`, not `margin: 0px`)
- Include leading zeros for decimals (`0.5rem`, not `.5rem`)
- Use 3-character hex where possible (`#abc`, not `#aabbcc`)
- Single quotes for CSS string values; no quotes in `url()`

## LAYOUT

The layout is a multi-page design with a homepage that serves as a portfolio showcase and separate pages for each project.
The homepage features a grid of project cards with images and brief descriptions.
Each project page includes more detailed information, screenshots, and links to the code or live demos.
The bottom of each page includes a consistent footer that looks like a terminal command line.
Hovering over buttons, selecting text, or clicking links triggers the command line to update with relevant messages, appearing as if the user is typing commands in a terminal.
