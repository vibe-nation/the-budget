# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

„Бюджетът“ is a static Angular 22 site (no backend) that charts Bulgaria's state budget since 1989. It shows the deficit, debt, inflation, Gini and budget-law figures next to office-holders, parliaments, elections and budget periods. Reader-facing text is in Bulgarian. Code, comments and commit messages are in English. The site is served from a GitHub Pages sub-path, `vibe-nation.github.io/the-budget/`.

## Commands

```bash
npm start                      # dev server on http://localhost:4200/
npm run build                  # production build to dist/the-budget/browser (baseHref /the-budget/)
npm test                       # all Vitest specs via `ng test` (jsdom)
npx ng test --watch=false --include src/app/charts/timeline/timeline-money.spec.ts   # one spec file
npx ng test --watch=false --filter '^assignLanes'                                    # by suite/test name regex
npx prettier --write public/data/charts.json                                         # after any script writes it

# Skill scripts have their own node:test suites
node --test .claude/skills/budget-chart/scripts/budget-series.test.mjs
node --test .claude/skills/budget-chart/scripts/plan-series.test.mjs
node --test .claude/skills/eurostat-extract/scripts/jsonstat.test.mjs
python3 .claude/skills/budget-chart/scripts/pdftext.py public/budget/ZDBRB-2019.pdf --find "Прокуратура"   # PDF text, see budget-chart/references/reading-pdfs.md
```

The "HTMLCanvasElement's getContext() not implemented" lines in test output are jsdom noise from ECharts, not failures.

## Architecture

**Data-driven, everything fetched at runtime.** The app ships no data in its bundle. `TimelineChart` (`src/app/charts/timeline/timeline-chart.ts`) loads these files from `public/data/` with `forkJoin` and builds one ECharts option from them:

| File | Becomes |
|---|---|
| `roles.json` | Gantt rows of office-holders (`GanttGroup` → `GanttItem` bars, with optional `mandate` terms) |
| `budget-periods.json` | The synthetic „Бюджет в сила“ row (`budget-periods.ts`), own law vs. carried-over regimes |
| `elections.json` | Attached to Народно събрание bars by `assembly` number (`timeline-elections.ts`) |
| `events.json` | Bands and lines across both grids (`timeline-events.ts`) |
| `charts.json` | Line series (`ChartSeries`): Eurostat data and budget-law figures |
| `chart-extras.json` | Merged into series by `chartId`: horizontal reference lines, and `eurostatLinks`, Eurostat saved views with the series' options set, by dataset code. It is kept separate so regenerating `charts.json` leaves it alone |
| `today.json` | Not read by the chart. The `/today` page's table for one year: an institution either names a `charts.json` series or carries its own `value` and `LawCitation`s, for those that have no line |
| `metrics/<name>.md` | The explanation shown when a line is clicked. `<name>` is the series `id` without a `-eur`/`-bgn`/`-percent` suffix. The app derives the URL from that name, so nothing else needs registering |

All types for these files live in `timeline.model.ts`. Read it before touching any data file.

**Chart construction is split into pure modules** that the component calls and the specs test directly, without rendering. `timeline-chart-option.ts` assembles the option. The Gantt is an ECharts `custom` series (`timeline-series.ts`, `timeline-lanes.ts`, `timeline-selection.ts`). Lines, legend and colours are in `timeline-lines.ts`, where `LINE_COLORS` needs a new entry per line (a `planOf` series takes its line's). Value axes are in `timeline-value-axes.ts`.

Several value axes coexist: percent, money, coefficient, inflation and monthly. A series picks its axis from `unit` and `meta.axis` (`valueAxisOf`). Money is stored in the series' unit and converted for display by `timeline-money.ts`, using the reader's currency (EUR/BGN, fixed rate 1.95583) and magnitude. Series `meta` flags matter: `startsOff` hides a part-of-total line at first, `wholeYear` holds a yearly figure flat across its year, and `planOf` makes a series the planned figures of another line (a draft budget's), which `attachPlans` hangs on it: dashed in its colour, on its axis, under its legend entry.

**Chart instance handling:** the `[options]` binding only creates the chart. After that the component updates the ECharts instance directly, because re-binding options would reset the reader's zoom. Selection repaints the cached `bars` without a rebuild. Reader preferences such as row order, hidden events, money view and labels persist in `localStorage` under `the-budget.*` keys. The lines switched on, currency, scale, shown events and the Настройки options also live in the address (`#/?lines=…&currency=…&scale=…&events=…&shape=…`, `timeline-url.ts`), which wins over `localStorage` on load, so a link reproduces the view.

**Shell:** `App` holds a navigation header. A page puts its toolbar into the header through the `NavSlot` service, a signal holding a `TemplateRef`. Routes use hash location (`withHashLocation`) because GitHub Pages returns 404 for unknown paths. `/` is the chart, and `/today` (one year's budgets per institution) and `/documentation` are lazy-loaded. The app is zoneless with OnPush components and signals throughout.

## Conventions and constraints

- **Keep URLs relative** (`data/charts.json`, not `/data/...`). The production `baseHref` is `/the-budget/`.
- **Add and refresh data through the project skills** in `.claude/skills/`, not by hand-editing `charts.json`:
  - `eurostat-extract`: Eurostat JSON-stat export → series, always all years. Raw whole-dataset exports that series use live in `public/data/eurostat/` and are listed in its `README.md`.
  - `budget-chart`: figures from the budget-law PDFs in `public/budget/` (catalogued in `references/state-budget-acts.json`). Every value carries a `LawCitation`: title, ДВ issue, page, член, алинея, row and column. The build script refuses a value without one. Figures from a draft (законопроект, Проект на бюджетен план) go in through its `plan-series.mjs` as a `planOf` series instead.
  - `describe-metric`: writes `public/data/metrics/<name>.md`.
  - `verify-mandates`: adds and checks office-holders in `public/data/roles.json`. It holds `scripts/dv_gazette.py`, the Държавен вестник reader that `budget-chart` uses too, and notes on the parliament.bg API.
- **The project is self-contained.** Everything a skill needs (scripts, references, rules) lives in this repo. Don't refer to skills, files or data outside it; copy what is needed into the skill instead. External tools are `node`, `python3` (standard library) and poppler-utils (`pdftotext`, `pdfinfo`).
- **The repo is public.** Never write machine-specific paths, usernames, emails or other personal details into any committed file. Use repo-relative paths.
- **Trust in the figures comes first.**
  - Eurostat is the primary source for statistics. НСИ is used only for data Eurostat lacks.
  - A metric keeps the unit its source publishes. A coefficient such as Gini stays a coefficient, on its own axis if no existing axis fits.
  - Every value from a budget law carries its full citation.
- **Bulgarian first.** Reader-facing text is in Bulgarian, even when the request is in English; the site's name is „Бюджетът“. Technical ids (repo, package, storage keys) stay in English. Research starts in Bulgarian, preferring bta.bg, bnr.bg and bnt.bg / bntnews.bg, and links the Bulgarian version of a page.
- `.claude` is hidden by a global gitignore, so new files under `.claude/skills` need `git add -f`.
- Prettier: `printWidth` 100, single quotes. HTML uses the `angular` parser.
- `.mcp.json` provides the `angular-cli` and `eurostat` MCP servers.
