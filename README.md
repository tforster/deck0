# DECK0 <!-- omit in toc -->

DECK0 is a lean markdown-to-slides presenter. Write your talk in a single `.md` file,
run one command, and you are presenting. No build step. No config file. No framework.

**Try it out**: Copy and paste this into your terminal — no installation required:

```bash
npx @tforster/deck0 https://raw.githubusercontent.com/tforster/deck0/main/demo/presentation.md
```

## Table of Contents <!-- omit in toc -->

- [1. Features](#1-features)
- [2. Usage](#2-usage)
- [3. Writing Slides](#3-writing-slides)
- [4. Keyboard and Mouse Controls](#4-keyboard-and-mouse-controls)
- [5. Supported Markdown](#5-supported-markdown)
- [6. Policies and Procedures](#6-policies-and-procedures)
- [7. Author](#7-author)

## 1. Features

- **One command** — `npx @tforster/deck0 presentation.md` is all it takes
- **Pure Markdown** — slides are plain `.md` files; they diff, PR, and version-control cleanly
- **Syntax highlighting** — 190+ languages via [highlight.js](https://github.com/highlightjs/highlight.js)
- **Mermaid diagrams** — loaded from CDN on first use; falls back to the vendored runtime offline
- **GFM tables** — pipe-syntax tables rendered with column alignment
- **Callouts** — `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`
- **Inline HTML** — raw HTML in markdown is passed through for custom styling if you really want it
- **Keyboard and click navigation** — arrow keys, space, backspace, left and right click
- **Tiny footprint** — ~17 KB of authored code; zero config. Minified and gzipped coming soon.

## 2. Usage

```bash
npx @tforster/deck0 your-presentation.md
```

Your default browser opens automatically. Press `Esc` to quit.

For local development you can also install globally:

```bash
npm install -g @tforster/deck0
deck0 your-presentation.md
```

## 3. Writing Slides

Use a single `#` heading as the title slide, then start each subsequent slide with a `##` heading:

```markdown
# My Talk Title

Subtitle or opening line here.

## First Slide

Content goes here.

## Second Slide

More content.
```

- Everything between two `##` headings is one slide
- The `#` title block is slide zero (the cover)
- Use `###` and `####` for section headings *within* a slide

## 4. Keyboard and Mouse Controls

| Action         | Keys / Input                |
| :------------- | :-------------------------- |
| Next slide     | `→` `Space` Left click      |
| Previous slide | `←` `Backspace` Right click |
| Quit           | `Esc`                       |

## 5. Supported Markdown

| Feature         | Syntax                                                                                   |
| :-------------- | :--------------------------------------------------------------------------------------- |
| Slide title     | `## Slide Title`                                                                         |
| Section heading | `### Heading`                                                                            |
| Images          | `![alt text](./local-image.png)` and `![alt text](https://example.com/remote-image.png)` |
| Code block      | ` ```js … ``` ` (190+ languages)                                                         |
| Mermaid diagram | ` ```mermaid … ``` `                                                                     |
| Table           | GFM pipe syntax                                                                          |
| Callout         | `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!CAUTION]`                |
| Inline HTML     | Passed through as-is                                                                     |

See `demo/presentation.md` for a complete working example.

## 6. Policies and Procedures

- [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.
- [Code of Conduct](./CODE_OF_CONDUCT.md) to learn more about how we foster an open and welcoming environment.
- [LICENSE](./LICENSE.md) for details on the legal terms governing the use and distribution of this project.

## 7. Author

Troy Forster
<https://www.tforster.com>
