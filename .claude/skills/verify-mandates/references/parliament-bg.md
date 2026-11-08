# parliament.bg JSON API

parliament.bg is a single-page app over a JSON API at `https://www.parliament.bg/api/v1/`. The routes below were worked out from its `app.js` in November 2026. The API is undocumented, so a route can change without notice.

- `archive/bg` lists parliaments from the 39th. `archive/bg/{nsId}` lists each one's committees: `cm` standing, `cm_v` temporary, `cm_u` sub-committees. Ids: 1 = 39th, 2 = 40th, 7 = 41st, 50 = 42nd, 51 = 43rd, 52 = 44th, 55…61 = 45th…51st.
- `coll-list-mp/bg/{committeeId}/3?date=YYYY-MM-DD` gives the committee's members on that date. **Sample it by date.** With `date=9999-12-31`, a person who stopped being chair shows only in a later position, or not at all, so the chair looks missing.
- `archive-period/bg/{model}/{year}/{month}/{index}/{index2}` lists documents. Year and month come first. Models: `A_Cm_Steno` (index2 0), `A_Cm_Stan` (index2 1), `Pl_StenV` (index and index2 0).
- `com-steno/bg/{t_id}` and `com-stan/bg/{t_id}` give committee transcripts and reports. `pl-sten/{id}` gives plenary transcripts, available back to 1879. They cover the years when Държавен вестник has no online full text.
- Page links for citations: `/bg/plenaryst/ns/55/ID/{id}` (the site always uses ns 55) and `/bg/parliamentarycommittees/{id}/reports/{stanId}`.

## Why it matters

Държавен вестник has no full text before the mid-2000s, and the registry alone hid real facts: a chair dated a day late, and a two-month stretch in 2023 with no elected chair.

## With the gazette reader

Use it alongside `../scripts/dv_gazette.py`. That reader needs a fresh `session()` for each search, because a reused session silently returns zero issues. Ministers' ordinances in the gazette carry a `Министър:` signature, which tests whether someone was still in office on a date.
