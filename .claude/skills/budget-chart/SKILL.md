---
name: budget-chart
description: Use when adding or refreshing a line on the timeline from a Bulgarian budget law: an institution's budget over the years (бюджет на МВР, съдебна власт, прокуратура, НСО, министерство, агенция), a body inside one, or a figure a budget law sets, such as НЗОК's budget or the максимален осигурителен доход. Also use when the user asks where a chart figure stands in the law or says a budget line is wrong. For Eurostat data use eurostat-extract.
---

# Budget chart

Turn figures from Bulgarian budget laws into series of `public/data/charts.json`, each value traceable to its place in the law.

**REQUIRED BACKGROUND:** read `references/reading-pdfs.md` before reading any PDF. It covers `scripts/pdftext.py`, scans, mojibake, two-column pages, units and the law's arithmetic.

**Every failure here is silent.** A figure from a rounded table or the next column looks right. So nothing goes on the chart until the law's own text confirms it.

## Sources

| Figure | Law | Where |
|---|---|---|
| Institution's budget | ЗДБРБ, the state budget act | `public/budget/`, catalogued in `references/state-budget-acts.json` |
| НЗОК's budget | Закон за бюджета на НЗОК | Държавен вестник. The state budget shows only a transfer to it, which is not its budget |
| Осигурителен доход | Закон за бюджета на ДОО, from 2002. For 2000–2001, КСО чл. 9, ал. 2: 10 × минимална работна заплата | Държавен вестник; [kik-info](https://kik-info.com/spravochnik/maksimalen-osiguritelen-dohod.php) lists every period with its ДВ issue, for a cross-check |

Existing extractions of the same figures, in this repo or elsewhere, are leads to check, never a source. A reference table is a cross-check for dates and amounts. An amount no law prints may come from it, with a `note` on the value saying so.

Before 2014 an institution usually has only a row in the roster (`чл. 4–6, ал. 1`). From 2014 it has its own article, whose number moves. Use the row as printed for `label`, such as „24. Национална служба за охрана“, with `column` „Разходи“. For a sentence with no table, use `column` „текст“.

## Steps

1. **Read the table in the law, for every year.** Take the exact amount, unit and row name as printed. Read the unit each year: a table can be in `млн. лв.`, and 2026 is in `хил. евро`.
2. **Prefer the exact row.** When two tables give a figure, take the one with more digits and cite the other as a second location with its own `amount` and `unit`. The 2002 judiciary table says „121,9“ млн. лв., while `II. РАЗХОДИ` says 121 873,7 хил. лв.
3. **Run the arithmetic.** Use every identity the table has, including reserve rows, which can be labelled differently across years. Parts must sum to the total. Lines starting `в т.ч.` are not parts.
4. **Confirm in the gazette.** Check the figure in the act's text (`gazette.actUrl`) or the full issue (`gazette.issueUrl`). Act pages can omit tables, and acts before 2004 have no page, so use the issue PDF. Older issues decode as cp1251. A failed text search on a scan is not evidence: read the page image.
5. **Read every amendment of those years** with your own eyes. The ЗИД files in `public/budget` are only some of them. The heading of a year's latest ЗИД lists the earlier ones („изм., бр. 66 и 68 от 2013 г.“). Amendments also sit in other laws, above all the ЗИД of the НЗОК and ДОО budget acts: the one in ДВ, бр. 67 от 2014 г. rewrites `чл. 55` of the state budget act and withholds 10% under `чл. 4–46`. Record what changes the figure. Money added or withheld without changing it goes in the row's `note`. Report what you searched and what you read, and say so if a title search is all you did.
6. **Build with the script, dry run first.** `node .claude/skills/budget-chart/scripts/budget-series.mjs <input.json>`. It refuses a value lacking a location, a gazette link or a gazette check. Add `--write --after <id>`, then run prettier on `charts.json`.
7. **Finish the line.** Name it plainly, like „Бюджет на МВР“, with no suffix such as „(по закон)“. The „Обяснение“ text says the figures are adopted amounts. Add a colour to `LINE_COLORS` so no two lines share one. A part of a total gets `meta: { startsOff: true }`. A line of yearly amounts gets `meta: { wholeYear: true }`, which holds it flat across each year, and the input's `meta` has to carry both or a rebuild drops them. Load `describe-metric` for its text. Run the tests, the build and open the app. A global ignore rule hides `.claude`, so a new file in this skill needs `git add -f` when committing.

## Input

```json
{
  "id": "mvr-budget-eur",
  "name": "Бюджет на МВР",
  "institution": { "code": "MVR", "label": { "en": "Ministry of Interior", "bg": "Министерство на вътрешните работи" } },
  "rows": [
    {
      "year": 2014,
      "amount": 999556.0,
      "unit": "хил. лв.",
      "note": "Optional, on the value",
      "sources": [
        {
          "article": 12,
          "paragraph": 1,
          "label": "II. РАЗХОДИ",
          "column": "Сума",
          "page": 19,
          "filePage": 12,
          "checks": { "file": true, "gazetteAct": true, "gazetteIssue": false, "arithmetic": "I − II + III = IV" }
        }
      ]
    }
  ]
}
```

- `page` is the page printed in the gazette, `filePage` the page of the PDF. They differ.
- A location may add `annex`, or its own `amount` and `unit`.
- A law outside the catalogue needs `act` on the row and `source` on the input, in the catalogue's shape.
- A figure that changes mid-year sets `"dated": true` and a `date` per row, the day it took effect, with `acts` on the input keyed by that date.
- A list with no paragraphs uses `point`, and `letter` where it has them, in place of `paragraph`.
- When no copy of the issue shows the printed page, set `page: null` and `actPage`, where the act starts. Don't estimate it. `filePage` is the 1-based page of `fileUrl`.
- In a full issue the PDF page is the printed page, so that's the cheapest way to get `page`.
- `checks.arithmetic` is a short formula. `institution.code` is a short uppercase name of your choice.

## Decisions by what you find

- **A row disappears:** end the line there and find out why in the law. Say so in its text, without claiming how money moved. Investigators' rows end in 2009, and the Judiciary Act places those bodies inside the prosecution.
- **A row is renamed:** keep one line and cite each year's printed name.
- **An institution is absent:** it gets no value, never `0`.
- **Two rows the law keeps apart:** two lines. A sum is your calculation, not a published figure.
- **An amount per person:** `meta: { "axis": "monthly", "style": { "step": "end" } }`, not the money axis.
- **A jump in the line:** check it in the law, then look for a change in what the row covers. Report causes you couldn't confirm as unexplained.

## Red flags

- An article number taken from the nearest heading. Quote the sentence that introduces the table.
- A gazette link you constructed rather than found. Leave it `null`.
- A figure copied because an existing file already has it.
- „No amendment changes it“ from a search rather than a reading.
- Something unverified described as done. Report which checks ran and which didn't.

Lookup help: `.claude/skills/budget-chart/references/gazette.md`.
