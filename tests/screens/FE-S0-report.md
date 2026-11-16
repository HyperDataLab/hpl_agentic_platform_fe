# FE-S0 capture report

## Reproduction

Run twice from the repository root; both invocations completed with exit code 0 and produced all 20 PNGs:

```powershell
npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs
npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs
```

The script uses Chrome (`channel: "chrome"`), desktop 1440×900 and mobile 390×844; it sets the app's `theme_mode` cookie before each navigation, then checks `data-theme-mode` and the `dark` class. It started and stopped its own `npm run dev`; a local API stub supplies server-rendered auth/project data while `page.route` fulfills browser API requests. The output directory is `test-results/screens/FE-S0/` and is ignored by `.gitignore`.

## Component wiring observed

| Component | Parent-to-child chain | Real route/state captured |
|---|---|---|
| `LocalDataCard` (`local-data-card.tsx`) | `datasets/[datasetId]/page.tsx` → `WorkspaceSection` → `DatasetDetails` → `LocalVersionNotice` → `LocalDataCard` | `/projects/<project>/datasets/local-dataset` |
| `LocalVersionNotice` (`local-version-notice.tsx`) | `datasets/[datasetId]/page.tsx` → `WorkspaceSection` → `DatasetDetails` → `LocalVersionNotice` | `/projects/<project>/datasets/local-dataset` |
| Superseded version badge (`SupersededVersionBadge` in `dataset-versions.tsx`) | `datasets/[datasetId]/page.tsx` → `WorkspaceSection` → `DatasetDetails` → `DatasetPreview` → `SupersededVersionBadge`; the history sheet also renders it | `/projects/<project>/datasets/remote-dataset`, History opened and v1 selected |
| Capabilities (`NodeCapabilities` in `project-local-nodes/node-capabilities.tsx`) | `[section]/page.tsx` → `WorkspaceSection` → `SettingsSection` → `SettingsLocalNodes` → `NodeRow` → `NodeCapabilities` | `/projects/<project>/settings?tab=local-nodes` |
| Stale release badge (`StaleReleaseBadge` in `settings-local-nodes.tsx`) | `[section]/page.tsx` → `WorkspaceSection` → `SettingsSection` → `SettingsLocalNodes` → `NodeRow` → `ReleaseLog` → `StaleReleaseBadge` | Same settings route, Release log expanded |

All requested components are wired to real project routes in this checkout. No app files were changed by FE-S0. The local fixture now uses vN aliases for two of three variables, one already-shared name, only D2 allowlisted flags, count values rounded down to tens, and the fixed D2 gaps; the Local Node row count in the library is 1,840.

## PNGs

Each route below was captured in all four combinations: `desktop-light`, `desktop-dark`, `mobile-light`, and `mobile-dark`.

- `dataset-library`
- `dataset-remote-version`
- `dataset-local-data-card`
- `dataset-superseded-version`
- `settings-local-nodes-stale-release`

This gives the 20 files matching `<route>-<size>-<theme>.png` in `test-results/screens/FE-S0/`.
