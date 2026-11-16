# Local font assets

`merriweather-latin.woff2` is the normal Latin Merriweather font served by Google
Fonts for weights 400 and 700. Both requested weights use this same variable file.
It retains the existing `--font-merriweather` variable and font-picker entry.

The file is loaded with `next/font/local` to avoid the Turbopack Google font URL
parsing error (`next/font/google queries have exactly one entry`).

- Stylesheet: https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap
- Font: https://fonts.gstatic.com/s/merriweather/v33/u-4e0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiSeqqJ-k.woff2
- License: `Merriweather-OFL.txt` (SIL Open Font License 1.1), from
  https://github.com/google/fonts/tree/main/ofl/merriweather
- Upstream issue: https://github.com/vercel/next.js/issues/99114
