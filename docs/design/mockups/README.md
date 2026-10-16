# Interactive interface mockups

Open **[index.html](index.html)** in a browser. No Node.js, dev server, install or cloud connection is required.

The mockup mirrors the three product screens from the design discussion:

1. **Explore:** a restrained learning dashboard and challenge browser.
2. **Solve:** a TypeScript editor beside a detailed problem statement, with tabs for examples, hints and a results area.
3. **My Notebook:** historical attempts, personal explanations, complexity tags and compare/retry affordances.

## What you can click

- Navigation between the three screens.
- Light/dark UI toggle.
- Search/filter in Explore and open the featured challenge.
- Learning/Interview mode switch, hint reveal and example presets.
- Select past attempts in Notebook and preview a comparison.
- Resize desktop solving panes, and use smaller-screen tabs.
- Illustrative save/retry affordances and explanatory prototype-only notices.

## What is **not** implemented

- TypeScript compilation / untrusted code execution / real tests.
- Supabase authentication, remote autosave, database history, real export or real community sharing.
- A full challenge database or the actual finished `longest-window` solver.

The prototype may hold temporary UI state in the page, but it does not make backend promises. All personal statistics, test results and attempts are labeled as examples or demo content, not actual user data.

## Source structure

| File | Ownership |
| --- | --- |
| `index.html` | Semantic screen markup and design-only interactive affordances |
| `styles.css` | Design tokens, responsive layouts, editor mock and dark theme |
| `app.js` | Local demo navigation, filters, mode switching and visual interactions |

**Do not ship the mockup as production code.** Reimplement approved interaction contracts with accessible Vue components and a real editor/runner once the specification is approved.
