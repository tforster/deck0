#!/usr/bin/env node
/* eslint-disable no-console */
// deck0.js — DECK0 markdown slide presenter
//
// Usage: deck0 <file.md>
//        npx @tforster/deck0 <file.md>
//
// One H1 at the top acts as the title/cover slide; each H2 thereafter starts a new slide. Serves via Node http with keyboard
// navigation. Raw HTML in markdown is passed through — authors can use inline styles for custom treatments (e.g. branded title
// blocks).
//
// Dependencies: marked (Markdown → HTML), highlight.js (syntax highlighting), mermaid (diagrams, loaded on demand)

// System dependencies
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { createRequire } from "module";

// Third-party dependencies
import { marked } from "marked";
import hljs from "highlight.js";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 33000);

const mdArg = process.argv[2];
if (!mdArg) {
  console.error("Usage: deck0 <file.md|url>");
  process.exit(1);
}

const isRemote = /^https?:\/\//i.test(mdArg);

/** @type {string} */
let mdContent;
/** @type {string|null} Base URL for rewriting relative image paths in remote files. */
let mdBaseUrl = null;
/** @type {string|null} Local directory for serving relative image assets. */
let mdDir = null;

if (isRemote) {
  let res;
  try {
    res = await fetch(mdArg);
  } catch (err) {
    console.error(`deck0: failed to fetch ${mdArg}: ${/** @type {Error} */ (err).message}`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`deck0: HTTP ${res.status} fetching ${mdArg}`);
    process.exit(1);
  }
  mdContent = await res.text();
  // Base URL is everything up to and including the last slash
  mdBaseUrl = mdArg.replace(/\/[^/]*$/, "/");
} else {
  mdContent = readFileSync(resolve(mdArg), "utf8");
  mdDir = dirname(resolve(mdArg));
}

const css = readFileSync(resolve(__dirname, "deck0.css"), "utf8");

// Resolve highlight.js package root via require so this works with npx and global installs
const _require = createRequire(import.meta.url);
const hljsRoot = dirname(_require.resolve("highlight.js/package.json"));
const hlCss = readFileSync(resolve(hljsRoot, "styles/github-dark.min.css"), "utf8");

// ---------------------------------------------------------------------------
// Markdown → HTML
// ---------------------------------------------------------------------------

marked.use({
  gfm: true,
  breaks: false,
  html: true,
  renderer: {
    /**
     * Renders an image, rewriting relative src paths to absolute URLs when the source
     * markdown was loaded from a remote URL.
     *
     * @param {{ href: string, title: string|null, text: string }} token
     * @returns {string} HTML string.
     */
    image({ href, title, text }) {
      let src = href ?? "";
      // Relative paths (no scheme, not root-relative) get the remote base URL prepended
      if (mdBaseUrl && src && !/^https?:\/\//i.test(src) && !src.startsWith("/")) {
        src = mdBaseUrl + src;
      }
      return `<img src="${src}" alt="${text ?? ""}"${title ? ` title="${title}"` : ""}>`;
    },

    /**
     * Renders a fenced code block with highlight.js token colouring.
     * Falls back to HTML-escaped plain text for unrecognised languages.
     *
     * @param {{ text: string, lang: string }} token
     * @returns {string} HTML string.
     */
    code({ text, lang }) {
      // Mermaid blocks are left as-is for client-side rendering
      if (lang === "mermaid") {
        return `<pre class="mermaid">${text}</pre>\n`;
      }
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(text, { language: lang }).value;
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>\n`;
      }
      const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre><code class="hljs">${escaped}</code></pre>\n`;
    },
  },
});

/**
 * Post-processes parsed HTML to convert GitHub-style blockquote alerts (> [!NOTE], > [!TIP], etc.) into semantic callout divs.
 *
 * @param {string} html - Raw HTML from marked.
 * @returns {string} HTML with callout divs substituted.
 */
function applyCallouts(html) {
  // marked renders > [!NOTE]\n> text as <blockquote><p>[!NOTE]\ntext</p></blockquote>
  return html.replace(
    /<blockquote>\s*<p>\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\n?([\s\S]*?)<\/blockquote>/gi,
    (_, type, inner) => {
      const label = type.charAt(0) + type.slice(1).toLowerCase();
      const body = inner.replace(/<\/p>\s*$/, "").trim();
      return `<div class="callout callout-${type.toLowerCase()}"><strong class="callout-label">${label}</strong><p>${body}</p></div>`;
    }
  );
}

// Parse the entire document first, then split on <h2> in HTML.
// Splitting markdown directly would incorrectly match `## ` inside fenced code blocks.
const fullHtml = applyCallouts(marked.parse(mdContent));

// Split at each <h2> boundary (zero-width lookahead keeps the tag with its content). Content before the first <h2> (the single 
// <h1> title slide) becomes slide 0. Filter strips chunks whose only content is HTML comments or whitespace — this prevents
// markdown linter directives (<!-- markdownlint-disable -->) at the top of the file from creating a spurious blank first slide.
const slideHtmls = fullHtml
  .split(/(?=<h2[\s>])/i)
  .filter((s) => s.replace(/<!--[\s\S]*?-->/g, "").trim());

const sections = slideHtmls
  .map((html, i) => `    <section class="slide" data-index="${i}">\n      <div class="slide-content">\n${html}      </div>\n    </section>`)
  .join("\n");

// ---------------------------------------------------------------------------
// Client-side script (inlined — no external JS file needed)
// ---------------------------------------------------------------------------

const clientJs = /* js */ `
(function () {
  "use strict";

  const slides = document.querySelectorAll(".slide");
  const counter = document.getElementById("counter");
  const n = slides.length;
  let cur = 0;
  let mermaidReady = false;

  /**
   * Renders any un-rendered Mermaid blocks inside a slide element using mermaid.render(),
   * which works in a detached off-screen element and returns a complete SVG string.
   * This avoids the label-clipping caused by mermaid.run() measuring an off-screen container.
   *
   * @param {Element} slide - The slide section element.
   */
  async function renderMermaidInSlide(slide) {
    if (!mermaidReady) return;
    const pending = [...slide.querySelectorAll("pre.mermaid:not([data-rendered])")];
    for (const el of pending) {
      el.setAttribute("data-rendered", "1");
      try {
        const id = "mermaid-" + Math.random().toString(36).slice(2, 9);
        const { svg } = await mermaid.render(id, el.textContent.trim());
        // Mermaid injects inline style="max-width: Xpx" which overrides CSS.
        // Strip it and set width="100%" so the diagram fills the column and
        // scales correctly via the viewBox that Mermaid already provides.
        const tmp = document.createElement("div");
        tmp.innerHTML = svg;
        const svgEl = tmp.querySelector("svg");
        if (svgEl) {
          svgEl.removeAttribute("width");
          svgEl.removeAttribute("height");
          svgEl.style.maxWidth = "";
          svgEl.style.width = "100%";
          svgEl.style.height = "auto";
        }
        el.innerHTML = tmp.innerHTML;
      } catch (err) {
        console.warn("deck0: Mermaid render failed", err);
      }
    }
  }

  /**
   * Transitions to slide index i, clamped within bounds.
   * @param {number} i - Target slide index.
   */
  function show(i) {
    cur = Math.max(0, Math.min(i, n - 1));
    slides.forEach((s, j) => {
      s.dataset.state = j < cur ? "prev" : j > cur ? "next" : "active";
    });
    counter.textContent = \`\${cur + 1} / \${n}\`;
    renderMermaidInSlide(slides[cur]);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ")             { e.preventDefault(); show(cur + 1); }
    else if (e.key === "ArrowLeft" || e.key === "Backspace") { e.preventDefault(); show(cur - 1); }
    else if (e.key === "Escape") {
      // keepalive ensures the request reaches the server even if the browser begins unloading
      fetch("/quit", { keepalive: true })
        .then(() => {
          window.close();
          // Fallback: if the browser blocked window.close() (tab not opened by script), show a prompt
          setTimeout(() => {
            document.body.innerHTML = "<p style='color:#8b949e;font-family:monospace;padding:2rem'>bye — you can close this tab</p>";
          }, 300);
        })
        .catch(() => {});
    }
  });

  // Left click → forward, right click → backward
  document.addEventListener("click", (e) => { e.preventDefault(); show(cur + 1); });
  document.addEventListener("contextmenu", (e) => { e.preventDefault(); show(cur - 1); });

  show(0);

  // ---------------------------------------------------------------------------
  // Mermaid — load only if the deck contains mermaid blocks
  // ---------------------------------------------------------------------------

  /**
   * Loads a script by URL, falling back to a second URL on failure.
   *
   * @param {string} primary - Preferred script URL (CDN).
   * @param {string} fallback - Local fallback URL served by deck0.
   * @param {() => void} onload - Called once the script is ready.
   */
  function loadScript(primary, fallback, onload) {
    const s = document.createElement("script");
    s.src = primary;
    s.onload = onload;
    s.onerror = () => {
      const f = document.createElement("script");
      f.src = fallback;
      f.onload = onload;
      f.onerror = () => console.warn("deck0: Mermaid unavailable (offline and not yet cached)");
      document.head.appendChild(f);
    };
    document.head.appendChild(s);
  }

  if (document.querySelector("pre.mermaid")) {
    const CDN = "https://cdn.jsdelivr.net/npm/mermaid@11.13.0/dist/mermaid.min.js";
    loadScript(CDN, "/mermaid.min.js", () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        flowchart: { useMaxWidth: false, htmlLabels: true },
        sequence:  { useMaxWidth: false },
        gantt:     { useMaxWidth: false },
      });
      // Mark ready then render the current slide — diagrams are rendered on-demand per slide
      // so Mermaid always measures a visible, correctly-sized container.
      mermaidReady = true;
      renderMermaidInSlide(slides[cur]);
    });
  }

}());
`;

// ---------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------

/**
 * Builds the full HTML document string.
 *
 * @param {string} body - Pre-rendered section elements.
 * @returns {string} Complete HTML document.
 */
function buildHtml(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DECK0</title>
  <style>
${hlCss}
${css}
  </style>
</head>
<body>
  <div id="deck">
${body}
  </div>
  <div id="counter"></div>
  <div id="nav-hint">&#8592; &#8594; &nbsp;·&nbsp; Space &nbsp;·&nbsp; Backspace &nbsp;·&nbsp; Click &nbsp;·&nbsp; Right-click &nbsp;·&nbsp; Esc to quit</div>
  <script>${clientJs}</script>
</body>
</html>`;
}

const html = buildHtml(sections);

/** @type {Record<string, string>} */
const MIME = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  if (req.url === "/quit") {
    res.writeHead(200);
    res.end("bye");
    // Allow the response to flush before exiting; server.close() hangs on keep-alive connections
    setTimeout(() => process.exit(0), 100);
    return;
  }

  // Serve vendored mermaid as a local fallback when CDN is unreachable
  if (req.url === "/mermaid.min.js") {
    const vendorPath = resolve(__dirname, "../vendor/mermaid.min.js");
    if (existsSync(vendorPath)) {
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(readFileSync(vendorPath));
    } else {
      res.writeHead(404);
      res.end("not found");
    }
    return;
  }

  // Serve static assets (images etc.) relative to the md file's directory — local files only
  const ext = extname(req.url ?? "").toLowerCase();
  if (mdDir && ext && MIME[ext]) {
    // Strip leading slash and resolve safely within mdDir
    const safePath = resolve(mdDir, (req.url ?? "").replace(/^\/+/, ""));
    if (safePath.startsWith(mdDir) && existsSync(safePath)) {
      res.writeHead(200, { "Content-Type": MIME[ext] });
      res.end(readFileSync(safePath));
      return;
    }
    res.writeHead(404);
    res.end("not found");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🃏  DECK0 is live → ${url}`);
  console.log(`   ${slideHtmls.length} slides loaded from ${isRemote ? mdArg : resolve(mdArg)}`);
  console.log("   ← → navigate · Esc quits\n");

  // Auto-open in default browser (cross-platform)
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${opener} ${url}`);
});
