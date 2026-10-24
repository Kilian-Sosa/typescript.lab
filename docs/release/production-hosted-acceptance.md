# Production hosted acceptance — NOT RUN

**Decision:** NO-GO for public exposure until this record is completed and the owner explicitly approves the exact release identities. No hosted check or mutation is performed by PR 2.

Use the [runbook](../release-checklist.md). This is separate from [synthetic local evidence](2026-10-24-production-local-acceptance.md).

## Identity record (operator must fill from independent readback)

| Field | Verified value |
| --- | --- |
| Operator / date / owner authorization | Pending |
| Clean reviewed source SHA; all five check URLs | Pending |
| Build source-tree fingerprint and retained manifest/hash location | Pending |
| Exact app alias | `https://typescript-lab-app-preview.vercel.app` |
| Exact runner alias | `https://typescript-lab-runner-preview.vercel.app` |
| Verified team and app/runner project IDs/names | Pending |
| App candidate deployment ID / immutable URL / platform target / linked Git SHA | Pending |
| Runner candidate deployment ID / immutable URL / platform target / linked Git SHA | Pending |
| Independently verified app rollback deployment ID and inert/protected evidence | Pending — blocks release |
| Independently verified runner rollback deployment ID and inert/protected evidence | Pending — blocks release |
| Supabase environment and exact callback approval | Pending; no keys or private project reference in public evidence |

## Acceptance evidence

| Gate | State | Evidence |
| --- | --- | --- |
| Staged pair protected; contents and deployment file inventory match reviewed artifacts | NOT RUN | Pending |
| Platform target/SHA/team/project/alias identity, manifest hashes and headers | NOT RUN | Pending delivery-verifier result and independent readback |
| Exact app alias authenticated; exact runner alias public static | NOT RUN | Pending anonymous/authenticated probes |
| Generated, extra Production and all Preview domains protected/canonicalized | NOT RUN | Pending complete domain inventory |
| Real GitHub OAuth, callback cleanup/return, sign-out and session recovery | NOT RUN | Disposable accounts only |
| Real database RLS, cross-user denial and immutable history | NOT RUN | Disposable accounts/data only |
| Real HTTPS QuickJS, console/errors/timeout/cancel/retry and privacy isolation | NOT RUN | Pending browser/network evidence |
| Run → Save → Notebook/export for passed/failed/untested and failed-save recovery | NOT RUN | Disposable data only |
| Supported browsers, restricted third-party cookies, responsive/keyboard/themes/reflow/reduced motion | NOT RUN | Pending live matrix |
| Native screen reader / manual accessibility acceptance | NOT RUN | Pending |
| Independent Production security approval | Pending | Review must identify delivered IDs/SHA |
| Owner final go decision | Pending | Must identify delivered IDs/SHA |
| Public release readback and monitoring | NOT RUN | Pending |
| Rollback validation / restored protection / disposable cleanup | NOT RUN | Pending |

`scope: delivery-only` from the verifier proves only its selected delivery assertions. Do not mark OAuth, RLS, live browser isolation, complete historical-domain inventory or release approval passed from that output. Keep sensitive operational IDs/evidence in the approved private release workspace where needed; public summaries must not contain credentials, callback parameters or private learner work.
