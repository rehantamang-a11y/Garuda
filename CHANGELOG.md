# Changelog

All changes to EyEagle v2 are documented here. Newest entries first.

---

## [2026-06-04] — Surface Drive upload configuration failures

**Agent:** Hermes_{Submission}

**Files changed:**
- src/services/sheetsService.js
- src/screens/ReviewScreen/ReviewScreen.jsx
- src/screens/AuditListScreen/AuditListScreen.jsx
- src/screens/AuditListScreen/AuditListScreen.css
- .env.example

**What changed:**
Fixed a silent failure path in the Google Sheets + Drive submission flow. The live GitHub Pages bundle did not contain a literal Apps Script `/exec` URL, which means `REACT_APP_APPS_SCRIPT_URL` was missing when the deployed app was built. Previously `submitToSheets()` returned early and ReviewScreen still marked the audit as submitted, making it look successful even though no photos or metadata were sent to Drive. The upload service now throws a clear configuration error when the Apps Script URL is missing or when the restricted `/a/macros/...` URL is used. ReviewScreen now stays on the review step and shows the upload error instead of marking the audit submitted. Resubmit failures are also surfaced on AuditListScreen. Added `REACT_APP_APPS_SCRIPT_URL` to `.env.example` so future deploys include the required Drive upload endpoint.

---

## [2026-03-03] — Fix Drive photo labeling and bake annotations into submitted images

**Agent:** Hermes_{Submission}

**Files changed:**
- src/services/sheetsService.js

**What changed:**
Two bugs fixed in the submission pipeline. First, Drive photos were being labeled with raw area IDs (e.g. `floor-surface`) instead of human-readable names. Fixed by importing `getArea()` from `areas.js` and using `getArea(areaId).label` (e.g. "Floor Surface") as the label sent to the Apps Script. Second, annotations drawn by technicians were not appearing on Drive photos — the raw compressed image was being sent rather than the annotated composite. Fixed by importing `renderAnnotatedImage()` from `imageUtils.js` and calling it for any photo that has annotation marks; photos without annotations continue to use the raw `dataUrl` to avoid unnecessary processing. Also added `photoIndex` (1-based, per area) and `comment` to each photo object in the payload so the Apps Script can name Drive files clearly (e.g. "Floor Surface — 1.jpg") and store per-photo comments as file descriptions.

**Note for Rey:** The Apps Script controls the actual Drive filename. It should use `areaLabel` + `photoIndex` from the payload for naming, e.g. `areaLabel + " — " + photoIndex + ".jpg"`. If filenames in Drive still look wrong after this deploy, the Apps Script file-saving block will need a small update to use those fields.

---

## [2026-02-27] — Remove WhatsApp; fix blank screen after Firebase Auth

**Agent:** Finn_{UI} / Hermes_{Submission}

**Files changed:**
- src/screens/ReviewScreen/ReviewScreen.jsx
- src/screens/AuditListScreen/AuditListScreen.jsx
- src/App.jsx

**What changed:**
Removed WhatsApp entirely from the submission flow. Submit now only uploads to Google Sheets + Drive and navigates to the success screen. Resubmit button on submitted cards also no longer opens WhatsApp. Fixed a blank screen crash caused by `App.jsx` checking `user.loggedIn` — the new Firebase AuthContext sets `user` to `null` when logged out (not `{ loggedIn: false }`), so the check was updated to `user ? AUDIT_LIST : LOGIN`.

---

## [2026-02-27] — Firebase Auth employee login

**Agent:** Rex_{Architect} / Finn_{UI}

**Files changed:**
- src/services/firebaseService.js (created)
- src/context/AuthContext.jsx
- src/screens/LoginScreen/LoginScreen.jsx
- .env (not committed — gitignored)

**What changed:**
Replaced the localStorage self-registration system with Firebase Email/Password authentication. Employees can no longer create their own accounts — accounts are created by the admin in the Firebase Console. `firebaseService.js` initialises the Firebase app and exports the Auth instance. `AuthContext` now uses `signInWithEmailAndPassword` and `onAuthStateChanged` so sessions persist across page reloads automatically. `LoginScreen` now takes an email field instead of a name field, shows a loading state while Firebase resolves, and surfaces specific error messages for wrong credentials, missing account, and too many attempts. Firebase project: `eyeagle-assessment`.

---

## [2026-02-27] — Fix Apps Script URL (401 → public endpoint)

**Agent:** Ellis_{Docs}

**Files changed:**
- .env (not committed — gitignored)

**What changed:**
Apps Script deployment was using the Google Workspace domain-scoped URL (`/a/macros/ipsator.com/s/...`) which requires Google account authentication, causing every POST from the app to return 401. Redeployed the Apps Script with "Who has access: Anyone" which produced the public URL (`/macros/s/...`). Updated `REACT_APP_APPS_SCRIPT_URL` in `.env` and redeployed to GitHub Pages. Sheets and Drive confirmed working after fix.

---

## [2026-02-27] — Add Resubmit button to submitted audit cards

**Agent:** Finn_{UI} / Hermes_{Submission}

**Files changed:**
- src/screens/AuditListScreen/AuditListScreen.jsx
- src/screens/AuditListScreen/AuditListScreen.css

**What changed:**
Added a ↺ Resend button to each submitted audit card in AuditListScreen. Tapping it re-POSTs the full audit (metadata + base64 photos) to the Apps Script Web App via `submitToSheets`, then reopens WhatsApp with the pre-filled summary message. While the upload is in flight the button shows `…` and is disabled to prevent double-sends. Failure is non-blocking — a console warning is logged but the WhatsApp step still runs. All photo/annotation/area/comment metadata is derived from the stored audit object so no AuditContext load is required.

---

## [2026-02-27] — Remove email; replace with Google Sheets + Drive submission

**Agent:** Rex_{Architect}

**Files changed:**
- src/services/sheetsService.js (created)
- src/screens/ReviewScreen/ReviewScreen.jsx
- .env

**What changed:**
Removed EmailJS email submission entirely — it required third-party credentials, added a 200/month send cap, and sent no photos. Replaced with a Google Apps Script Web App as a free serverless backend. On submit, the app POSTs the full audit (metadata + base64 photos) to the Apps Script URL. The script appends a row to a Google Sheet (submitted time, date, technician, client, bathroom type, areas, photo count, annotation count, comments, Drive folder link, audit ID) and saves each photo as a JPEG into a per-audit Drive subfolder named `Audit – {client} – {date}`. Upload is non-blocking on failure — if the POST fails (offline, misconfigured URL), the app still completes the WhatsApp step and shows the success screen; a console warning is logged. Added `REACT_APP_APPS_SCRIPT_URL` to `.env`. Removed all `REACT_APP_EMAILJS_*` vars from `.env`. Updated the submit explainer text to reflect Sheets + Drive instead of email.

---

## [2026-02-26] — Vera QA pass — fix touch target violations

**Agent:** Vera_{QA} / Finn_{UI}

**Files changed:**
- src/components/PhotoCard/PhotoCard.css
- src/screens/AnnotateScreen/AnnotateScreen.css

**What changed:**
Full 17-item QA pass run against all screens and components. Two touch target violations found and fixed. PhotoCard Edit/Delete pill buttons were 34px tall — 14px below the 48px minimum required for mobile touch targets. AnnotateScreen Circle/Draw tool buttons were 40px. Both updated to `min-height: var(--touch-min)` (48px). All 17 checklist items passed after fixes. Core functionality (state logic, canvas tools, submission flow, undo, reset, error handling) verified correct.

---

## [2026-02-26] — Build shared Header component

**Agent:** Finn_{UI}

**Files changed:**
- src/components/Header/Header.jsx (created)
- src/components/Header/Header.css (created)
- src/screens/HomeScreen/HomeScreen.jsx
- src/screens/HomeScreen/HomeScreen.css
- src/screens/ReviewScreen/ReviewScreen.jsx
- src/screens/ReviewScreen/ReviewScreen.css

**What changed:**
Built the Header component that had been reserved as an empty directory since project setup. Component supports two modes: logo-only (no `onBack` prop) for HomeScreen, and back button + title (with `onBack` and `title` props) for inner screens. Replaced the inline `<header>` block in HomeScreen with `<Header />` and in ReviewScreen with `<Header title="Review & Submit" onBack={onBack} backLabel="‹ Back to Edit" />`. Removed now-redundant `.home-header`, `.home-logo`, `.review-header`, and `.review-title` CSS rules from both screen stylesheets. AreaScreen and AnnotateScreen retain their own custom headers as they contain screen-specific content (area label + hint, canvas toolbar).

---

## [2026-02-26] — Fix ESLint compile error on startup

**Agent:** Finn_{UI}

**Files changed:**
- package.json
- src/screens/AnnotateScreen/AnnotateScreen.jsx

**What changed:**
App failed to compile on first run due to an ESLint error: the `react-hooks/exhaustive-deps` rule was referenced in an `eslint-disable-line` comment in AnnotateScreen.jsx but the plugin wasn't loaded. Root cause was a missing `eslintConfig` field in package.json — standard Create React App projects require `"eslintConfig": {"extends": ["react-app", "react-app/jest"]}` to load the react-hooks plugin. Added the field to package.json and changed the disable comment on line 90 of AnnotateScreen.jsx from `// eslint-disable-line react-hooks/exhaustive-deps` to `// eslint-disable-line` to avoid referencing a named rule before the plugin resolves on first load.

---

## [2026-02-26] — Integrate useCamera hook into AreaScreen

**Agent:** Sketch_{Canvas}

**Files changed:**
- src/screens/AreaScreen/AreaScreen.jsx

**What changed:**
AreaScreen was using a raw FileReader to read camera captures directly into context without any compression. This meant full-size camera images (potentially 5–10MB) were being stored as base64 in React state, which could cause memory issues on phones with multiple photos per audit. Replaced the inline ref + FileReader approach with the existing `useCamera` hook, which runs `compressImage()` (max 1200px, quality 0.82) before storing. Handles cancel gracefully.

---

## [2026-02-26] — Update area list to match PRD

**Agent:** Rex_{Architect}

**Files changed:**
- src/data/areas.js

**What changed:**
The previous area list diverged from the PRD. Required areas 6 and 7 were "Walls" and "Grab Bars" — the PRD defines these as "Overall — Lit" and "Overall — Dark" (baseline spatial shots of the room with lights on and off). Optional areas were also misaligned: Mirror, Accessories, Ventilation, and Storage replaced with Walls & Corners, Drainage, Door, and Other per the PRD. Labels, IDs, icons, and hints updated across all 13 areas to match PRD definitions exactly.

---

## [2026-02-26] — Fix EyEagle branding (IGEL → EyEagle)

**Agent:** Ellis_{Docs}

**Files changed:**
- README.md
- AGENTS.md

**What changed:**
Three instances of "IGEL technicians" were found in README.md and AGENTS.md. IGEL is not the brand name — EyEagle is. Replaced all three occurrences with "EyEagle technicians".
