# UI design system and screen contracts

**Status:** Approved visual direction, 2026-10-16; final accessibility and screenshot QA pending implementation.

**Source preview:** [Interactive three-screen mockup](mockups/index.html).
**Authoritative behaviours:** [Product specification](../superpowers/specs/2026-10-16-typescript-lab-design.md).

## Direction

**A focused developer workspace, not a gamified coding site.** A calm, light app shell keeps information easy to scan, with a dark code editor as the focal point. Contrast, typography and state clarity should feel closer to a professional IDE / Linear-style productivity UI than a marketing landing page.

These reference values are approved visual starting points; contrast and responsive fidelity still require implementation QA:

| Token | Light | Dark / purpose |
| --- | --- | --- |
| `--canvas` | `#f7f8fc` | Background |
| `--surface` | `#ffffff` | Cards, header and sidebar |
| `--text` | `#20263b` | Primary typography |
| `--muted` | `#8991a4` | Secondary typography; verify contrast in final UI |
| `--accent` | `#7865e9` | Primary interactions and active navigation |
| `--accent-soft` | `#f1edff` | Selected items |
| `--success` | `#24966e` | Passing evaluations |
| `--warning` | `#b17e2d` | Warnings, review cues |
| `--editor` | `#191e2c` | Editor canvas |
| `--editor-line` | `#252d3e` | Editor gutter/borders |

- **Fonts:** system sans UI; later evaluate Inter with fallbacks. Monospace for source code and input/output examples.
- **Radius:** approximately 10–16px for cards, 8px for controls. Use restrained borders and minimal shadow.
- **Spacing:** 4px base unit; sections typically 16–24px apart.
- **Iconography:** one consistent thin-line family, no competing emoji/icon packs in the final UI.
- **Density:** concise metadata; generous whitespace around comprehension-heavy text; comfortable code line height.

## Layout anatomy

### 1. Explore

- Small persistent navigation (Explore / Practice / My Notebook); secondary Patterns/Review Queue are deferred and should not masquerade as active MVP routes.
- Welcome / resume hero: a strong next action, not an empty motivational headline.
- Small progress summary only for authenticated users with real activity. Empty account state suggests first exercise.
- Search, difficulty filters and challenge list with actual state: Not started / In progress / Attempted / Passed.
- Cards prioritize title, one-line description, difficulty, time and personal state. Pattern tags are only visible in Learning context.

### 2. Solve — product centerpiece

- Header: breadcrumbs, title, difficulty, optional timer and a mode switch.
- Desktop: a resizable split pane with problem statement / examples / constraints on the left and editor / test feedback on the right. Avoid nested scrolling traps.
- Statement contains precise return contract, tie-breaking semantics, at least one example, editable example explorer and clear expected output.
- Editor includes TypeScript file name, visible persistence status, syntax support, run tests and save submission.
- Results state distinguishes not-run / running / passed / failed / compilation failure / timeout / infrastructure error. Do not populate green results before a test has run.
- Three progressive hints and algorithm visualizer belong to Learning Mode; both are hidden until deliberately opened.
- Interview Mode hides answer leakage including pattern taxonomy and previous solutions. Switching to Learning Mode should warn about spoilers without losing work.

### 3. My Notebook

- List of attempted challenges, dates and personal review state.
- Per-challenge detail: immutable versions, timestamp, submitted source, original challenge version, evaluation status, personal notes, claimed complexity.
- Side-by-side or inline code diff for two attempts, with accessible non-color change indicators.
- `Retry from scratch` starts from the starter and hides old code, preserving every previous attempt.
- Export actions are visible and use portable filenames/formats; do not require a subscription.

## Responsive contracts

| Viewport | Navigation | Solve arrangement | Notebook |
| --- | --- | --- | --- |
| Desktop ≥ 1100px | Sidebar 190–228px | Draggable side-by-side pane, content min-widths | Side history and code/notes |
| Tablet 700–1099px | Compact rail/collapsible | Stacked or switchable problem/editor depending on width | Stacked history/details |
| Mobile < 700px | Compact navigation/menu | Problem / Code / Tests tabs; fixed usable Run and Save access | Full-width history then details |

No primary interaction should require hover; focus rings should be visually obvious, and side-by-side layouts must never cause document-wide horizontal scrolling.

### Application header (issues #12 and #13, owner request 2026-10-24)

- Authenticated accounts show **Sign out** without the redundant `Private account connected` label. Account privacy remains explicit in the workspace and saving feedback.
- Account, repository and theme actions share a 40px minimum height and align in one action row when space permits. Reserve the account-action width across checking, guest and signed-in states to avoid shifting adjacent controls.
- At constrained widths, deliberately wrap the header into compact rows; preserve visible account actions, complete accessible names and keyboard access to the brand, repository and theme switch. Error/status messages wrap without horizontal overflow; pending actions are disabled and failed sign-out remains retryable.
- Verify 100%, 125%, 150% and 200% zoom reflow plus 390px mobile. Automated coverage models a 1280px browser content area as effective CSS widths 1280, 1024, 853 and 640px respectively. This tests responsive reflow, not actual browser zoom; neither CSS `zoom` nor device pixel scaling substitutes for browser zoom.

## Components and states to implement later

- `AppShell`, `SideNav`, `SearchInput`, `ChallengeListItem`, `ProgressSummary`
- `ChallengeHeader`, `ProblemPane`, `ExampleExplorer`, `LearningHint`
- `CodeEditor`, `EditorSaveStatus`, `RunTestsAction`, `TestResults`
- `NotebookList`, `AttemptTimeline`, `AttemptCode`, `AttemptComparison`, `RetryAction`
- `AuthGate`, `OfflineState`, `ErrorState`, `EmptyState`

Each interactive component must document at least loading, success, empty and error states where applicable. Long-lived editor state must survive pane resizing or switching between presentation tabs.

## Accessibility and content

- Comply with WCAG 2.2 AA where applicable; validate contrast, especially muted labels and small badges.
- Mark code regions with informative labels and accessible help; provide keyboard shortcuts as enhancements, not requirements.
- Test results should update an accessible live region without stealing focus.
- Algorithm visualizations must be understandable through text descriptions and step tables, not color/motion alone.
- Respect reduced motion, generous touch targets and zoom to 200%.
- Never use success colors alone as proof of passed tests, and never show illustrative progress as a real authenticated state.

## Console output (issue #14)

Solve places a labelled Console region below Test feedback in the editor panel. It uses existing typography, border and editor tokens. Messages show level and case identity as plain text in a wrapping, keyboard-focusable scroll region; a polite summary announces count without reading the whole transcript. Run ID, source revision, status and truncation remain visible. Empty/running/unavailable/cleared states are distinct, and run diagnostics stay in Test feedback. The [console design](../superpowers/specs/2026-10-24-learner-console-design.md) governs bounds and lifecycle. The original mockup predates this additive panel; it does not supply executable console semantics.

## Mockup fidelity contract

The prototype uses example identities, timestamps, challenge data and solution history solely to demonstrate composition. Its interactions intentionally do not access GitHub, user accounts, production databases, an arbitrary code runner or Vercel.

Reviewers should assess visual hierarchy, content density, responsive states and the three primary journeys. Passing these screenshots does not imply acceptance of backend, security or execution semantics.
