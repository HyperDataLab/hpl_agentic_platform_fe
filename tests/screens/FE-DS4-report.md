# FE-DS4 screenshot review

Captured by `npx --yes --package=playwright@1.56.1 -- node tests/screens/capture.mjs --tag FE-DS4`.
The mock records are synthetic. Remote versions are ordered v1 (October 12), v2 (October 25), then v3 (November 13); local versions use October 30, November 5 and November 13.
FE-DS4 images use the requested viewport dimensions rather than full-page height, and the capture script compares PNG hashes for each remote workspace/selected-column pair.

## Captures

Each state was captured at desktop (1440×900), tablet (1100×800) and mobile (390×844), in light and dark themes.

- `test-results/screens/FE-DS4/dataset-remote-workspace-desktop-light.png`
- `test-results/screens/FE-DS4/dataset-remote-workspace-desktop-dark.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-desktop-light.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-desktop-dark.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-desktop-light.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-desktop-dark.png`
- `test-results/screens/FE-DS4/dataset-remote-workspace-tablet-light.png`
- `test-results/screens/FE-DS4/dataset-remote-workspace-tablet-dark.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-tablet-light.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-tablet-dark.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-tablet-light.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-tablet-dark.png`
- `test-results/screens/FE-DS4/dataset-remote-workspace-mobile-light.png`
- `test-results/screens/FE-DS4/dataset-remote-workspace-mobile-dark.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-mobile-light.png`
- `test-results/screens/FE-DS4/dataset-remote-selected-column-mobile-dark.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-mobile-light.png`
- `test-results/screens/FE-DS4/dataset-local-workspace-mobile-dark.png`

## Comparison with data-formulator grid2/grid3

The detail page now carries over the connected vertical thread, version and release cards, a central column profile, a right inspector, and a data table below the profile. The thread visibly runs from v1 to v3, and v1 is oldest in both the mock dates and timeline. The desktop view uses three columns; at 1100 px it uses profile plus inspector drawer, and on mobile thread history and inspector use sheets.

Remaining differences: the reference has a large chart canvas with chart thumbnails in the thread, while this Platform page has column cards and a tabular preview. Current remote APIs expose preview rows but no full remote column profile or distribution statistics, so cards correctly say “Distribution not computed”; preview rows are not used to derive charts. Local versions expose the released `local_card` counts and bands, but no histogram values. The reference also includes an agent chat, which is outside this page's scope and absent from this implementation.
