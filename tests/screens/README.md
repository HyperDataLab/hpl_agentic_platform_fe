# FE-S0 route captures

From the repository root, run the capture twice with the pinned Playwright version:

```powershell
npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs
npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs
```

The script uses installed Chrome (`channel: "chrome"`) and writes 20 full-page images under `test-results/screens/FE-S0/`: five real project routes across desktop (1440×900) and mobile (390×844), each in light and dark mode. It sets the app's `theme_mode` cookie before navigation; browser API requests are fulfilled by `page.route`, and a short-lived local API stub supplies mock auth/project data to Next.js server rendering. The script starts `npm run dev` on port 3000 when needed and stops it only when it started it. No project dependency is added.

The data is synthetic and covers remote versions, an older superseded version, a Local Node data card with D2 flags, vN aliases, rounded counts and fixed gaps, capability families and a stale signed release. Screenshots are ignored by Git through `/test-results/`.
