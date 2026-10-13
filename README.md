# Isopod

My cybersecurity and software engineering blog: projects, posts and HackTheBox writeups.
Built with [Astro](https://astro.build), with a theme based on [Milky-Way](https://github.com/ttomczak3/Milky-Way) by Tristen Tomczak (MIT).

## Commands

| Command           | Action                                                     |
| :---------------- | :--------------------------------------------------------- |
| `npm install`     | Install dependencies                                       |
| `npm run dev`     | Dev server at `localhost:4321` (drafts visible, no search) |
| `npm run build`   | Build to `./dist/` and build the Pagefind search index     |
| `npm run preview` | Serve the built site locally (search works here)           |

## Writing

Copy the `_template.md` in the right folder and rename it. The file name becomes the URL.
Files starting with `_` are never published.

| Folder                  | URL               |
| :---------------------- | :---------------- |
| `src/content/posts`     | `/posts/<file>/`    |
| `src/content/writeups`  | `/writeups/<file>/` |
| `src/content/projects`  | `/projects/<file>/` |

- `draft: true` shows the entry in `npm run dev` only.
- Writeups also need `retired: true` before they're built. HTB only allows public writeups for retired content.
- Images go in `public/images/` and are referenced as `/images/name.webp`.

## Configuration

Site title, author, URL, social links and mascot images live in `src/consts.ts`.
Colors and fonts are CSS variables at the top of `src/styles/global.css`.

## Features

Tags, pagination, RSS (`/rss.xml`), sitemap, Pagefind search, table of contents,
reading time, prev/next links, Shiki syntax highlighting (Catppuccin, follows the theme toggle)
with copy buttons, Open Graph meta, light/dark mode.
