# Project Title

## Overview

This is a static website built with HTML, CSS, and JavaScript featuring a retro DOS/CRT aesthetic. The website serves as a portfolio and playground for software development projects, showcasing whatever the heck comes to my mind.

## How to Run Locally for Development

- Open `index.html` directly in your browser.
- For proper ES6 module resolution in some browsers, consider using a local HTTP server:
  - You can use any static file server, e.g., `npx serve .` or the VS Code Live Server extension.

## Key Files

- **index.html**: Homepage displaying hero section, projects grid, and blog list.
- **style.css**: Global styles and CSS variables for theme management.
- **main.js**: Renders project cards and blog post lists from `data.js`.
- **footer.js**: Interactive terminal footer handling hover and selection behavior.
- **data.js**: Content source used to manage projects and blog posts.
- **projects/**: Directory containing individual project detail pages.
- **posts/**: Directory containing individual blog post pages.

## Architecture

Multi-page layout with each project and blog post in their own respective HTML files. The homepage serves as the main interface, presenting a grid of project cards alongside a list of blog posts. All styling is handled via CSS, and JavaScript is used for dynamic content rendering and interactions.

## Tech Stack

(If you can call it that)

- **HTML**: Structure of the website.
- **CSS**: Styling and layout, following a retro aesthetic.
- **JavaScript**: Dynamic behavior and rendering of portfolio content using ES6 modules.

## Adding a New Project

1. Create a new file in the `projects/` directory, e.g., `your-project.html`, using `_template.html` as a template (duh).
2. Update the `PROJECTS` array in `data.js` to include:

   ```javascript
   { file: "projects/your-project.html", title: "Your Project Title", description: "Brief description of your project." }
   ```

## Adding a New Post

1. Create a new file in the `posts/` directory, e.g., `your-post.html`, using `hello-world.html` as a template.
2. Update the `POSTS` array in `data.js`:

   ```javascript
   { file: "posts/your-post.html", title: "Your Post Title", date: "YYYY-MM-DD", excerpt: "A short excerpt from your post." }
   ```
