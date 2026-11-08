# Reading the budget-law PDFs

Each annual **Закон за държавния бюджет на Република България** (ЗДБРБ) states, in law, what every first-level spending unit gets. The PDFs are in `public/budget/`, described in its `README.md` and catalogued in `references/state-budget-acts.json`.

## The core principle

**Every failure mode in this corpus is silent.** A scanned page, a mojibake encoding, a two-column layout, a units change: none of them raise an error. They hand you a plausible-looking number that is wrong by a factor of 1000, or belongs to the institution in the next column.

> **No figure ships until it satisfies an arithmetic identity taken from the law itself.**

The law is internally redundant on purpose. Use that redundancy as your test. A figure you cannot check is a figure you must read again, from the page image if necessary.

## Which years the institution exists

An institution absent from a year's law is **not zero**. It either did not exist or was not a first-level spending unit yet. Record that as an absence with a reason, never as `0`.

Confirm absence by reading that year's full roster of spending units, not by a failed grep. A failed grep is far more often an encoding or layout problem than a real absence.

*Worked case: ДАНС was created effective 1 Jan 2008, but the roster in ЗДБРБ 2008 has no line for it. Its first appearance is the 2009 law.*

## Getting readable text

Use `scripts/pdftext.py` in this skill. It needs `pdftotext` and `pdfinfo` from poppler-utils, and it undoes the three things `pdftotext -layout` gets wrong here.

```bash
P=.claude/skills/budget-chart/scripts/pdftext.py

python3 $P public/budget/ZDBRB-2019.pdf --find "Прокуратура"                    # which pages
python3 $P public/budget/ZDBRB-2019.pdf --pages 2 --col right --find "Прокуратура" --context 4
python3 $P public/budget/ZDBRB-2009.pdf --pages 3                               # whole page
```

- `--find` matches through inserted OCR spaces (`П рокуратура`), soft hyphens and line-break hyphens (`Нацио-\nнална`). **A literal grep will miss these and read as "not in this law".**
- `--col left|right` crops one column. ДВ sets running text in two columns, so a table row and an unrelated column's numbers land on the same output line.
- Mojibake (`ÄÚÐÆÀÂÅÍ`, cp1251 rendered as Latin-1) is repaired automatically.
- Exit status 1 plus a warning means **no text layer**: the page is a scan.

**When the page is a scan, or when columns are still interleaved after cropping, read the page image** with `Read` on the PDF and the `pages` parameter. It is faster and safer than fighting the extractor, and it is how the 2007, 2008 and 2009 judiciary tables were resolved.

## Locating the figures

Three shapes, depending on year and institution:

| Where | Which years | What you get |
|---|---|---|
| Summary roster of all spending units, `чл. 4` / `чл. 5` / `чл. 6, ал. 1` | ~2000–2013 | one row: приходи, разходи, субсидия |
| The institution's own article | 2014– | full table I–V, policies/functional areas, max commitments |
| `чл. 2`, съдебна власт | every year | aggregate, plus a table by орган from 2002 |

**The article number moves every year.** НСО ran чл. 30 → 31 → 32 → 33 → 34 → 32 across 2014–2026. Never carry last year's number forward. Locate it each time.

## Units

Read the column header every year, without exception:

- `(хил. лв.)`: thousands of leva, the usual case
- `(хил. евро)`: **2026 onward**, after Bulgaria adopted the euro
- `(млн. лв.)`: the judiciary table in the **2002** law only

Getting this wrong is a 1000× error that still looks like a budget figure. Keep each figure in the unit the law prints; the build script and the app convert (1 EUR = 1.95583 BGN).

## The law's own arithmetic

Run every identity the year's table supports. All are exact.

```
I − II + III                 = IV        (приходи − разходи + взаимоотношения = салдо)
IV + V                       = 0         (салдото се покрива от финансирането)
взаимоотношение с ЦБ + трансфери с ЕС = III
текущи + капиталови          = разходи (II)
Σ(bodies)                    = "Всичко"  = II. РАЗХОДИ
```

**Use the full form, not `разходи − приходи = III`.** That shortcut holds only when the balance is zero, which is the common case and therefore the trap. МВР 2014 has IV = 8 433,8 covered by finance-lease payments in V, so the shortcut is off by exactly that and a correct extraction looks broken.

A mismatch is information, not noise:

- Off by one plausible row: you swallowed a sub-row. Lines beginning `в т.ч.` are *breakdowns of the row above*, not separate entities. Counting `Съдебна палата – гр. София` as a body broke 2004 and 2005 by exactly 7 500,0.
- Off by a whole entity: a wrapped label lost its number (`зирани съдилища)` and `дени разходи` are line-break fragments of longer names).
- Off by ~1000×: units.
- Wildly off: you read across a column boundary. Go back to `--col` or the page image.

## Amendments

An amendment (ЗИД) does one of two things, and conflating them misstates the year:

- **It amends the article.** ЗИД 2010 cut ДАНС from 96 675,0 to 77 340,0. That changes the figure, with its own citation.
- **It leaves the article alone and votes extra money.** ЗИД 2021 (+2 121,0) and ЗИД 2022 (+3 200,0) for ДАНС. The adopted figure does not change; say so in the value's `note` instead of folding the money in.

State which amendments were checked, so an unchecked amendment never reads as an absent one.

## Citing the page

A page qualifies as a citation only if it contains **both**:

1. the figure, matched with digit boundaries, and
2. the institution's name, matched OCR-tolerantly.

Both halves are load-bearing:

- **Boundaries.** `18 500,0` occurs inside `218500,0`. НСО 2005 was once cited to a page reading „за структурни реформи 218500,0“, which has nothing to do with НСО. Use `(?<![\d.,])…(?![\d])`.
- **Name, but a fragment.** Table labels wrap across lines with a neighbouring column's digits in between (`Национална служба ⏎ за охрана`), so a full-name match fails on pages that are correct. Match a distinctive fragment (`охрана`, `вътрешн`, `сигурност`) through `fuzzy()` in `pdftext.py`, which also survives OCR spacing (`о х р ан а`).

Two pages is normal: the article or roster table, plus the annex that repeats the sum by policy or programme.

**Scanned years have no searchable page.** Derive the page from the printed `СТР. N` header instead. Read page 1 of the scan to get its offset (`ZDBRB-2008.pdf` page 1 is СТР. 28, so PDF page = printed page − 27; the 2007 and 2010 files start at СТР. 1 and need no offset), map the ДВ issue's page onto it, then **open that page and confirm the row is there**.

## Fetching a law that isn't in `public/budget`

`minfin.bg` sits behind Cloudflare, so plain `curl` gets a challenge page, not a PDF. Load a minfin page in Playwright, wait for the challenge to clear, read `cf_clearance` and the browser's exact User-Agent from the context, then pass both to `curl`.

`dv.parliament.bg` needs no cookie and is the fallback whenever a minfin PDF is scanned or corrupt. See `gazette.md`. `showMaterialDV.jsp?idMat=…` returns a single act as HTML.

Minfin's *Справка по години с броевете на „Държавен вестник“* maps every year 1945–2014 to its ДВ issue; the link is in `public/budget/README.md`.

## Traps

| Trap | How it shows up | Fix |
|---|---|---|
| No text layer | `pdftotext` returns ~45 chars | ДВ issue, or read the page image |
| Mojibake | `ÄÚÐÆÀÂÅÍ`; greps find nothing | handled by `pdftext.py` |
| Two-column ДВ page | foreign numbers on the row | `--col left/right`, or page image |
| OCR spacing / hyphenation | `П рокуратура`, `Наци-\nонална` | `--find`, never literal grep |
| Units switch | figure off by 1000× | read the header each year |
| `в т.ч.` sub-rows | checksum off by one row | exclude; they are breakdowns |
| Article number moved | you read a neighbouring institution | locate per year |
| Corrupt source PDF | table truncates mid-way | ДВ issue (minfin 2004 stops at row 17) |
| Thousands separators | `1 234,5` with U+00A0/U+2009/U+202F, or `.` for decimals in 2006–2007 | strip all space classes; accept `,` and `.` |
| Institution absent | grep finds nothing | prove it from the roster; record absence, not `0` |
| Figure matched as a substring | a page citation points somewhere unrelated | require digit boundaries around the number |
| Balance not zero | `разходи − приходи ≠ III` on a correct table | use `I − II + III = IV`, `IV + V = 0` |

## Red flags

- You wrote a figure you could not check against any identity in the law.
- A checksum failed and you adjusted the total to match your rows.
- You concluded "not in the budget" from a single literal grep.
- You copied an article number from the previous year.
- You compared a 2026 figure with a 2025 figure without converting currency.
- You cited a page without confirming it holds both the figure and the institution.
- A checksum failed and your first move was to doubt the number rather than the identity you used.
