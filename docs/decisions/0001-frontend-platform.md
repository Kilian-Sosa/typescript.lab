# ADR-0001: Application frontend, documentation and deployment

**Status:** Accepted by owner, 2026-10-16
**Date:** 2026-10-16

## Context

The product began as a markdown-first challenge collection with interactive examples, but now requires a persistent solving IDE, authentication, private drafts and an attempt-history notebook. Its primary interface behaves like an application, not a conventional documentation site. A static challenge library must remain portable.

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| VitePress + embedded Vue | Excellent markdown docs, fast static pages | IDE/account routing and client state become awkward embedded app islands |
| Vue 3 + Vite + Vue Router | Simple, focused SPA, predictable client-side editor state, portable hosting | No first-class SSR; author SEO/metadata strategy explicitly |
| Nuxt + Vue 3 | File routes, hybrid rendering, SEO options, integrated server capabilities | More abstraction and conventions before server rendering proves necessary |

## Decision

Use **Vue 3 + TypeScript + Vite + Vue Router** for the app shell, with typed challenge modules and rendered Markdown. Introduce **Nuxt** if public content discoverability, route-level SSR or server-rendering requirements justify it after the first vertical slice.

Use Monaco for the solving editor if accessible performance and bundle measurements validate it; evaluate CodeMirror as an alternative if mobile, accessibility or size concerns dominate. Avoid implementing a custom code editor.

Keep **GitHub** as source of truth and **Vercel** as initial website host; use GitHub Actions for CI. The app must not require Vercel-specific APIs for challenge content, runner logic or notebook models. Preview deployments are a practical reason to choose Vercel over GitHub Pages.

Use an HTML/CSS/JS standalone mockup *only as an interim visual specification*, not the production frontend.

## Consequences

- Core challenge files live in a framework-independent package/directory.
- The solving surface is a first-class application route, not an embedded documentation widget.
- Authentication and storage can be introduced separately from guest/local practice.
- Select current compatible versions and install dependencies during the foundation implementation milestone; design approval has been granted.

## Revisit when

Public challenge SEO demonstrably needs SSR, user flows require backend-generated pages, or the team chooses a full-stack framework for operational reasons.
