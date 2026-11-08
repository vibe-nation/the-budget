---
name: budget-chart
description: Use when adding or refreshing a line on the timeline from a Bulgarian budget law: an institution's budget over the years (бюджет на МВР, съдебна власт, прокуратура, НСО, министерство, агенция), a body inside one, or a figure a budget law sets, such as НЗОК's budget or the максимален осигурителен доход. Also use when the user asks where a chart figure stands in the law or says a budget line is wrong, or has open items on a budget line to settle with the user, or wants a planned or forecast figure on the chart from a document that is not law yet: a законопроект, проектобюджет, проект на бюджетен план, средносрочна бюджетна прогноза, for any chart line including Eurostat's. For Eurostat data use eurostat-extract.
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
| A planned or forecast figure | A draft: законопроект before Държавен вестник, Проект на бюджетен план, средносрочна бюджетна прогноза | `public/budget/`, listed in its `README.md` as „Проект“. See **Draft figures** below |
| Осигурителен доход | Закон за бюджета на ДОО, from 2002. For 2000–2001, КСО чл. 9, ал. 2: 10 × минимална работна заплата | Държавен вестник; [kik-info](https://kik-info.com/spravochnik/maksimalen-osiguritelen-dohod.php) lists every period with its ДВ issue, for a cross-check |

Existing extractions of the same figures, in this repo or elsewhere, are leads to check, never a source. [lex.bg](https://lex.bg) is a lead too: it lists every amendment of an act, and `references/gazette.md` explains how to use it. A reference table is a cross-check for dates and amounts. An amount no law prints may come from it, with a `note` on the value saying so.

Before 2014 an institution usually has only a row in the roster (`чл. 4–6, ал. 1`). From 2014 it has its own article, whose number moves. Use the row as printed for `label`, such as „24. Национална служба за охрана“, with `column` „Разходи“. For a sentence with no table, use `column` „текст“.

## Steps

1. **Read the table in the law, for every year.** Take the exact amount, unit and row name as printed. Read the unit each year: a table can be in `млн. лв.`, and 2026 is in `хил. евро`.
2. **Prefer the exact row.** When two tables give a figure, take the one with more digits and cite the other as a second location with its own `amount` and `unit`. The 2002 judiciary table says „121,9“ млн. лв., while `II. РАЗХОДИ` says 121 873,7 хил. лв.
3. **Run the arithmetic.** Use every identity the table has, including reserve rows, which can be labelled differently across years. Parts must sum to the total. Lines starting `в т.ч.` are not parts.
4. **Confirm in the gazette.** Check the figure in the act's text (`gazette.actUrl`) or the full issue (`gazette.issueUrl`). Act pages can omit tables, and acts before 2004 have no page, so use the issue PDF. Older issues decode as cp1251. A failed text search on a scan is not evidence: read the page image.
5. **Read every amendment of those years** with your own eyes. The ЗИД files in `public/budget` are only some of them. The heading of a year's latest ЗИД lists the earlier ones („изм., бр. 66 и 68 от 2013 г.“), and so does the act's page on lex.bg. Amendments also sit in other laws, above all the ЗИД of the НЗОК and ДОО budget acts: the one in ДВ, бр. 67 от 2014 г. rewrites `чл. 55` of the state budget act and withholds 10% under `чл. 4–46`. The next year's budget act can amend this one in its преходни и заключителни разпоредби: § 17 of the 2019 act rewrites `чл. 12` for МВР 2018, +100 000,0 хил. лв. Compare each figure with the consolidated text on lex.bg (`references/gazette.md`). A difference means an amendment you haven't read, so go and read it. Record what changes the figure. Money added or withheld without changing it goes in the row's `note`. Report what you searched and what you read, and say so if a title search is all you did.
6. **Build with the script, dry run first.** `node .claude/skills/budget-chart/scripts/budget-series.mjs <input.json>`. It refuses a value lacking a location, a gazette link or a gazette check. Add `--write --after <id>`, then run prettier on `charts.json`. To change values of a series already on the chart, use `--update` (see **Input**).
7. **Finish the line.** For a draft's figure, follow **Draft figures** instead. Name it plainly, like „Бюджет на МВР“, with no suffix such as „(по закон)“. A line shows the final figure of each year, so an amendment that changes it is the value. The „Обяснение“ text says the figures are the amounts adopted in the annual law and, for a year with a changed amount, the amended one. Add a colour to `LINE_COLORS` so no two lines share one. A part of a total gets `meta: { startsOff: true }`. A line of yearly amounts gets `meta: { wholeYear: true }`, which holds it flat across each year, and the input's `meta` has to carry both or a rebuild drops them. Load `describe-metric` for its text. Run the tests, the build and open the app. A global ignore rule hides `.claude`, so a new file in this skill needs `git add -f` when committing.

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
      "comment": "Optional: the details of an amendment that changed the value, or of a jump",
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

- **To change values of an existing series,** run the script with `--update`, dry run first. The input is `{ "id": "mvr-budget-eur", "rows": [...] }` and lists only the values that change. A row with `sources` is checked like any other and replaces that value. `"keepSources": true` keeps the old citations after the new ones, which is how an adopted figure stays as the second location. A row with only `year` and `comment` or `note` leaves the figure alone. Every other value stays as it is, and the next year's change is recalculated.
- `page` is the page printed in the gazette, `filePage` the page of the PDF. They differ.
- A location may add `annex`, or its own `amount` and `unit`.
- An amendment that changes the figure is the row's `amount` and its first location, which carries the ЗИД as its own `act`. The adopted figure stays as the second location, citing the law with its own `amount`. The row's `comment` gives the details: both amounts, the provision that changed the figure and its gazette issue and page, and what moved.
- A law outside the catalogue needs `act` on the row and `source` on the input, in the catalogue's shape.
- A figure that changes mid-year sets `"dated": true` and a `date` per row, the day it took effect, with `acts` on the input keyed by that date.
- A list with no paragraphs uses `point`, and `letter` where it has them, in place of `paragraph`.
- An act whose only article is printed „Член единствен“, as in most decrees, has `article: "единствен"`, which the card shows as „чл. единствен“. An article with neither paragraphs nor points has `paragraph: null`.
- When no copy of the issue shows the printed page, set `page: null` and `actPage`, where the act starts. Don't estimate it. `filePage` is the 1-based page of `fileUrl`.
- In a full issue the PDF page is the printed page, so that's the cheapest way to get `page`.
- `checks.arithmetic` is a short formula. `institution.code` is a short uppercase name of your choice.

## Decisions by what you find

- **A row disappears:** end the line there and find out why in the law. Say so in its text, without claiming how money moved. Investigators' rows end in 2009, and the Judiciary Act places those bodies inside the prosecution.
- **A row is renamed:** keep one line and cite each year's printed name.
- **An institution is absent:** it gets no value, never `0`.
- **Two rows the law keeps apart:** two lines. A sum is your calculation, not a published figure.
- **An amount per person:** `meta: { "axis": "monthly", "style": { "step": "end" } }`, not the money axis.
- **A jump in the line:** check it in the law, then look for a change in what the row covers. Put the law's own facts in the value's `comment`, such as how much of the rise is staff costs. Add a cause only when a law or the draft's мотиви states it, with the source. Otherwise write that the cause is unconfirmed. A politician's or union's statement shows what was said, not why the money moved.

## Draft figures

A draft has no gazette, so `budget-series.mjs` refuses its figures, as it should. They go on the chart as a **plan**: a series whose `meta.planOf` names the line it continues. The app hangs it on that line. It is drawn dashed in the line's colour, on its axis, and is switched by the line's legend entry. It has no entry or colour of its own.

1. **Read the figure in the draft** as in steps 1–3, and note the PDF page of each value.
2. **Match the line's measure.** A plan of a Eurostat line takes the draft's figure on the same definition, not a national figure with the same name. For example, the ESA general government deficit, not the cash-basis КФП. Another example is December's annual HICP rate, not the yearly average. Where the draft prints the last reported year, check that its figure equals the line's.
3. **Take only what the draft prints.** Where it prints an estimate for the current year, take that too, since the planned year starts from it. A draft law prints only the coming year, so its plan holds that one value. A value you computed, such as a % of GDP times GDP, does not belong.
4. **Build with `plan-series.mjs`, dry run first.** Run `node .claude/skills/budget-chart/scripts/plan-series.mjs <input.json>`, then add `--write` and run prettier on `charts.json`. The script takes the unit from the line and dashes it. It refuses a value without its page, and a law citation on a value.
5. **Finish the plan.** Name it after the line and the document: „Дълг по проектобюджета“ for the Проект на бюджетен план, „Бюджет на МВР по законопроекта“ for a draft law. Its text in `public/data/metrics/` says the figures are planned, not adopted or reported, and may change (load `describe-metric`). Add the PDF to `public/budget/README.md` and leave `state-budget-acts.json` alone.
6. **When the law is in Държавен вестник:** add the year to the line with `budget-series.mjs` and drop that year from the plan. Delete the plan once it holds no future year.

```json
{
  "id": "budget-plan-mvr-eur",
  "name": "Бюджет на МВР по законопроекта",
  "planOf": "mvr-budget-eur",
  "document": {
    "bg": "Законопроект за държавния бюджет на Република България за 2027 г. (Министерство на финансите, 6.11.2026 г.)",
    "en": "Draft State Budget Act of the Republic of Bulgaria for 2027 (Ministry of Finance, 6 Nov 2026)",
    "code": "ZDBRB-2027-DRAFT",
    "url": "https://www.minfin.bg/upload/.../draft.pdf"
  },
  "rows": [{ "date": "2027-12-31", "value": 2200000000, "at": { "bg": "чл. 12, ал. 1, ред „II. РАЗХОДИ“, колона „Сума“, стр. 9", "en": "Art. 12(1), row II. Expenditure, column Amount, p. 9", "pages": [9] } }]
}
```

`at` names the row and column as printed. `url` is the link where you found the draft, and a draft without one stays off the chart. A line takes one plan, and the script refuses a second. `value` is in the line's unit: whole euros for money, so хил. евро × 1000. A percentage is as printed. Dates follow the line: the year's last day for a yearly figure, the month's last day for a monthly rate, and the day it takes effect for an amount set from a date.

## Open items, one at a time

When the work leaves things for the user to decide, such as a gap in the checks, two lines treated differently or a figure nobody can explain, don't send them as one list of questions. Walk through them with the user in order:

1. **Name them all once,** in order. Then number each one as it comes up: „Отворена точка 1 от 4“.
2. **Check before you describe.** Run the read-only comparison that could change the options. If it shows something you said earlier was wrong, correct it in the same message.
3. **Write one item per message, in Bulgarian:**
   - **Какъв е проблемът:** one or two plain sentences.
   - **Какво намерих:** the facts, in a table when they compare, each with its law, issue and page.
   - **Варианти:** А, Б, В. Say what each one does, then *Плюс* and *Минус*, and what it costs. Include leaving things as they are, when that is a real choice. Mark one „(препоръчвам)“.
   - End by asking which one.
4. **Wait for the choice,** then carry it out in full: the data, the texts, the skill rules, the tests and the build.
5. **Report in a few lines,** saying what is confirmed and what is not, then give the next item in the same message.
6. **A choice put off for later** goes in the backlog with what to do, how, and why it waits. Don't start it.
7. **Close with a table** of every item and how it ended.

## Red flags

- An article number taken from the nearest heading. Quote the sentence that introduces the table.
- A gazette link you constructed rather than found. Leave it `null`.
- A figure copied because an existing file already has it.
- „No amendment changes it“ from a search rather than a reading.
- Something unverified described as done. Report which checks ran and which didn't.
- A draft's figure added to the line itself, or given a gazette check so a script accepts it. It belongs in a plan.
- A value of an existing series changed by hand or by a one-off script. Use `--update`.

Lookup help: `.claude/skills/budget-chart/references/gazette.md`.
