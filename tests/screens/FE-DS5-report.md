# FE-DS5 screenshot review

Captured with `npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs --tag FE-DS5`. Fixtures are synthetic. Every state is a viewport capture at desktop (1440×900), tablet (1100×800), and mobile (390×844), in light and dark themes.

## Captures

- `datasets-cards-desktop-light.png`, `datasets-cards-desktop-dark.png`
- `datasets-table-desktop-light.png`, `datasets-table-desktop-dark.png`
- `datasets-empty-desktop-light.png`, `datasets-empty-desktop-dark.png`
- `datasets-cards-tablet-light.png`, `datasets-cards-tablet-dark.png`
- `datasets-table-tablet-light.png`, `datasets-table-tablet-dark.png`
- `datasets-empty-tablet-light.png`, `datasets-empty-tablet-dark.png`
- `datasets-cards-mobile-light.png`, `datasets-cards-mobile-dark.png`
- `datasets-table-mobile-light.png`, `datasets-table-mobile-dark.png`
- `datasets-empty-mobile-light.png`, `datasets-empty-mobile-dark.png`

All PNGs are under `test-results/screens/FE-DS5/`.

## Comparison with `plans/report/ref/grid1.png`

The Datasets screen now follows the reference's source-tile entry point and dataset gallery pattern. Dataset cards include a compact column-type/missingness strip when a Local Node data card supplies those values; remote cards show a neutral source icon because the current remote dataset contract has no profile to render. The screenshot also shows the responsive source tiles and the empty state with those tiles centered below its copy.

Remaining differences: this screen keeps the existing project shell instead of Data Formulator's rail and connector tree; it has three available source tiles because the existing upload flow has no paste/link support; and there is no Demos gallery or remote profile thumbnail source in the current API. The Local Node thumbnail uses reported variable types and missing counts only.
