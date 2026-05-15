# iDotDot
> By Anthony Liparulo

## Overview

This is a static website built with HTML, CSS, and JavaScript featuring a retro DOS/CRT aesthetic. The website serves as a portfolio and playground for software development projects, showcasing whatever the heck comes to my mind.

## Run Locally

- Open `index.html` directly in your browser.
- For proper ES6 module resolution in some browsers, consider using a local HTTP server:
  - You can use any static file server, e.g., `npx serve .` or the VS Code Live Server extension.
  - Or run `dev.ps1` via PowerShell on Windows.
  
## Deploy

Zero-dependency static site — just upload the project root to any static host:

- **GitHub Pages**: push to `main`, enable Pages in repo settings (root or `docs/` source).
- **Netlify / Cloudflare Pages**: connect the repo, set publish directory to `/`, no build command needed.
- **Manual**: copy all files except `.kilo/` and `.claude/` to your web server root.

## Key Files

- **index.html**: Homepage displaying hero section, projects grid, and blog list.
- **style.css**: Global styles and CSS variables for theme management.
- **js/main.js**: Renders project cards and blog post lists from `js/data.js`.
- **js/footer.js**: Interactive terminal footer handling hover and selection behavior.
- **js/data.js**: Content source used to manage projects and blog posts.
- **projects/**: Directory containing individual project detail pages.
- **posts/**: Directory containing individual blog post pages.

## Architecture

Multi-page layout with each project and blog post in their own respective HTML files. The homepage serves as the main interface, presenting a grid of project cards alongside a list of blog posts. All styling is handled via CSS, and JavaScript is used for dynamic content rendering and interactions.

## Tech Stack

(If you can call it that)

- **HTML**: Structure of the website.
- **CSS**: Styling and layout, following a retro aesthetic.
- **JavaScript**: Dynamic behavior and rendering of portfolio content using ES6 modules.