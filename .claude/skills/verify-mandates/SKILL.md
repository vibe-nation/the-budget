---
name: verify-mandates
description: Research, add, or verify person/role/mandate entries (office-holders, chairs, presidents, ministers, CEOs, etc.) in a project's structured data file — find mandate dates, cross-check names and dates against authoritative sources, and add new roles. Use when the user asks to verify, audit, fact-check, add, or research any role or office-holder mandate.
---

# Research and verify mandate data

A **mandate** here means one person's tenure in one role, bounded by a start and (usually) an end date. This skill researches, validates, and maintains entries of that shape.

## In this project

- **The file is `public/data/roles.json`**: an array of roles (`name`, `description`, `tag`, `index`, `mandate`, `items`). Each item has `name`, `value: [from, to | null]` and optional `title`, `status`, `comment`, `color` and `sources`. A source has `name`, `link` (an array), `quote`, `date`, `media` and the precision objects `from` / `to`. The TypeScript shapes are `GanttGroup`, `GanttItem` and `Source` in `src/app/charts/timeline/timeline.model.ts`. Step 0 below is already answered by this.
- **Bulgarian sources first.** Search in Bulgarian and prefer bta.bg, bnr.bg and bntnews.bg / bnt.bg among the media. Link the Bulgarian version of a page where one exists.
- **Tools beside this skill:** `scripts/dv_gazette.py` reads Държавен вестник, and `references/parliament-bg.md` describes the parliament.bg JSON API, which gives dated committee chairs and transcripts back to 1879.
- **lex.bg for the law behind an office.** [lex.bg](https://lex.bg) has the current text of an act and its amendment history („изм. ДВ. бр. …“). Use it to find when a mandate's length, an appointing body or an office's name changed, then cite the gazette issue itself. The text there is consolidated, and its pages are cp1251.
- After changing `roles.json`, run the tests and open the app: `adjustImpreciseOverlaps` moves uncited colliding dates, and the chart has to show the new bars.

The guidance below is written for any mandate file. Its example field names are illustrative, so translate them to the shape above.

## High-confidence rule (overrides everything below)

**Only write a person's name or a mandate date when you have high confidence in it. Under-claim rather than over-claim.** Leaving a field empty (or omitting an item entirely) and asking the user is always preferable to writing a plausible-looking value that hasn't been verified.

The bar:

- **Names** — copy the spelling **character-for-character from the source's own text, in the source's own language**. Open the source page and read the name in its original context; do not retype from memory, and do not trust a WebFetch summary for name spelling (summaries paraphrase, romanise, and silently "correct" names). If you cannot see the exact spelling in the source's original-language text, the name is unverified — flag it and ask the user. Single-character typos in non-Latin scripts (e.g. Bulgarian `Сърафов` vs `Сарафов`, Russian `е` vs `ё`, Greek diacritics) survive review because they look right at a glance and break nothing at runtime.
- **Dates** — each date must be defensible from the cited source's own text, at the precision the source actually states. Encode the source's native precision in `from`/`to` (year-only, year+month, full date) rather than silently resolving to a specific day. If a date is inferred ("appointed in late 2023", "the article implies summer 2024"), it is unverified — flag it.
- **A WebFetch summary is not the source.** It is a derivative artefact that omits and rewrites. For names and dates, the binding text is the source page itself.

Past sessions have introduced single-character typos (`Сърафов` vs `Сарафов`) and off-by-days dates by retyping from memory or from summaries. Both look correct on review. The pre-report validation in Step 7 includes an automated name-spelling check specifically because this class of error is invisible to visual review.

## Source classes: what a source is evidence *of*

Not every "official" source is evidence of the same thing. Classify each one before weighing it:

| Class | Example | Evidence for |
|---|---|---|
| **Artifact from inside the office** | An act, decree, protocol, minutes or gazette issue **signed by the holder in that role**, on a dated document | That person held that role **on that date** — the strongest evidence available |
| **Appointment instrument** | The decree/order/decision appointing or dismissing them | The exact boundary date |
| **Registry / database** | State administrative register, personnel roster, an "office-holders" table | What someone *entered* about the period — a claim, not an observation |
| **Biography** | Encyclopedia article, CV, press profile | Usually right to the year; routinely rounded to a government's term |

**A registry is not a primary source.** It looks authoritative — official domain, exact days, machine-readable — and that appearance is what makes its errors dangerous. Registry rows are typed in after the fact, opened and closed late, silently merge namesakes, and sometimes carry a date from an unrelated event (a re-registration, a new set of by-laws). Treat a registry date as a strong hypothesis to be confirmed, never as the last word.

### The conflict rule

**When a registry conflicts with two or more independent sources, you have not found the answer — you have found the question.**

Do not settle such a conflict by picking the more official-looking source and writing the disagreement into a `comment`. A comment saying "source A says X, source B says Y, we used X" is not verification; it ships a coin flip dressed as a citation. Either find a class-1 artifact that settles it, or drop to a precision you can defend (year/month) and tell the user what is unresolved.

**The rule fires per endpoint, not per entry.** Widen only the boundary that is actually contradicted. A registry endpoint no other source disputes keeps the registry's precision — losing a defensible exact date because the *other* end of the same mandate is in dispute is its own over-claim, in the opposite direction.

### Test the boundaries, not the middle

A registry period is two claims — a start and an end — and nearly all registry errors sit at the boundaries. For each endpoint, find a dated artifact **just inside** and **just outside** it. If someone is still signing as the office-holder months after the registry closes their term, the registry is wrong, not the document.

### Finding artifacts from inside the office

Institutions publish the acts their officers sign, and those acts carry a signature block:

```
PRIME MINISTER: /signed/ <name>
SECRETARY GENERAL OF THE COUNCIL OF MINISTERS: /signed/ <name>
```

Sampling one document per month across a period reconstructs an office's occupancy **independently of any registry**. Look for the institution's legal-information system or act repository, the official gazette, published minutes, decision archives, annual reports with signature pages. Two things these blocks give you that a registry usually does not:

- **Capacity markers.** The block often distinguishes the titular holder from a stand-in — an explicit *acting* prefix versus a *for / on behalf of* prefix. These are different states: *acting* means appointed to perform the duties; *on behalf of* may just mean the holder was away that day. Prefer these over a registry's flag when setting `status`/`kind`, and never infer a vacancy from one *on behalf of* signature — sample several distinct dates before concluding anything.
- **A per-document citation.** Cite the act itself (`[Decision No 748 of 28.11.2008]`), not the search that surfaced it.

Institutional archives are rarely designed to be queried — expect a JSF/ASP.NET app with a session token, an anti-forgery field and an `<input type="image">` submit that silently returns an empty result set if posted as a named value. Budget for cracking it once, then keep the reader: `scripts/dv_gazette.py` in this skill drives the Bulgarian State Gazette (search by keyword + date window → issue → material full text) and documents the traps that cost time to find.

### Red flags — stop and go find an artifact

| Rationalization | Reality |
|---|---|
| "It's the official state register — it outranks an encyclopedia" | The register holds someone's data entry; the biographies may all descend from the appointment act itself. Officialness of the *host* is not authority over the *fact*. |
| "Two sources disagree, so I'll cite both and explain in a comment" | You just published an unresolved conflict as a fact. |
| "The register's dates dovetail exactly with the neighbouring entry" | Internal consistency is free in a database. It is not external corroboration. |
| "The biographies only give a year, so they're less precise" | Less precise is not less correct. A year that contradicts your exact date means your exact date is suspect. |
| "I'll keep the exact date and note the discrepancy" | Under-claim instead: use the precision you can defend and flag what is open. |

All of these mean: find a document signed from inside the office, or don't write the date.

## Step 0: Discover the target file and schema

Before any research or edits:

1. **Locate the data file.** Ask the user if not specified. Common patterns: `data/roles.json`, `public/data/roles.json`, `content/mandates.yaml`, etc.
2. **Read a representative slice** of the file and identify:
   - Top-level shape (flat array vs. grouped by role).
   - Field names for role, person, start/end dates, sources, comments.
   - Whether `value`/`dates` is an `[start, end]` array or separate fields.
   - Date format (ISO `YYYY-MM-DD`? something else? how is "ongoing" encoded — `null`, empty string, missing field?).
   - Source object shape: name/title, url/link (string vs. array), quote/excerpt, separate precision fields (`from`/`to` with nested `date`/`dateYear`/`dateMonth`), etc.
   - Whether the project distinguishes source-native precision from the chart-resolved value (see **Handling imprecise mandate dates** below). If it does, follow that convention exactly.
3. **Preserve the existing convention.** Do not invent new fields or reshape the schema. Legacy entries may be sparser than new ones — match the **current** convention for anything you add or touch, while leaving untouched legacy entries alone.

The example shapes and field names below (`title`, `name`, `value`, `items`, `sources`, `from`/`to`/`quote`) are illustrative. Translate them to the project's actual field names before use.

## Step 1: Scope the work before starting

Mandate files can have many person × term entries across many roles. Never try to verify the whole file at once. Always ask:

- **Which roles?** If unspecified, list the roles currently in the file and ask.
- **Depth?** — (a) sanity-check only (overlaps, gaps, name consistency, source-link plausibility) or (b) also cross-check dates against cited authoritative sources via WebFetch.
- **Output?** — pass/fail table vs. flagged-only list. Flagged-only is the better default; passed entries are noise.

If the user says "verify role X", default to depth (b) + flagged-only + include line numbers.

When the user asks to **add** a new role or person, research it via WebFetch **before** writing any data — verify names, exact dates, and sources first.

## Step 2: Extract target entries

Use a short script (Python, Node, `jq`) to read the file and print a compact `[i] name | start → end | sources`. Don't dump the raw JSON — it's too noisy. Example:

```python
import json
data = json.load(open('PATH/TO/FILE.json'))
for role in data:
    if role['<role-key>'] not in TARGETS: continue
    for i, item in enumerate(role['<items-key>'], 1):
        print(i, item['<name-key>'], item['<value-key>'])
```

For YAML, use `yq` or `PyYAML`. For grouped-by-role files, filter first by role.

## Step 3: Static integrity scan

Before any web fetches, look for issues that show up from structure alone:

1. **Overlaps** — consecutive items where item[n].end > item[n+1].start (with caveat below).
2. **Gaps** — item[n+1].start > item[n].end. Many gaps are historically real (interregna, direct rule, vacant offices). Don't call these bugs — flag them and let the user decide.
3. **Partial names** — entries where the `name` is a surname only while peer entries use full names. Compare against neighbors in the same role.
4. **Source-link plausibility** — the source's title or URL references a completely different topic/institution from the role being cited.
5. **Stale tail** — the sitting person's end is `null`/empty. Check against today's date; if the person's term should have ended, flag as stale.
6. **Precision/structure mismatch** — any of: (a) the `comment` mentions imprecise dates ("approximate", "month unknown", "only the year is given", etc.) but the source object doesn't encode that precision; (b) the chart-resolved start is a non-first-of-month day while the source-side precision is month-only (or vice versa); (c) a source has only `name` + `url` with no quote/precision fields when the project convention requires them. These are detectable without any web fetching and are frequently the first tell that a prior pass skipped the precision step.

**Short transitional "overlaps"** between successors (a few days where old-end > new-start) often exist **in the source** — they reflect gaps between appointment and oath-of-office, or acting vs. confirmed. Don't "fix" the data if the overlap matches the cited source.

**Legitimate multi-mandate** patterns: the same person holding a role twice in non-contiguous terms is correct, not a duplicate. Caretaker / interim governments, re-elected officials, and returning CEOs all produce this shape.

## Step 4: Cross-check dates and names (depth b)

For each role, the primary authoritative source is usually already cited inside the entry — fetch it and compare. If no source is cited, start with the role's own encyclopedia page (Wikipedia in the project's primary language first, then English), then individual person pages, then official institutional pages.

**Dates that only a registry supports are not verified yet.** Before accepting a registry period, run the boundary test from **Source classes** above: an artifact signed from inside the office just inside each endpoint, and one just outside it. Budget the effort there — the middle of a tenure is rarely where a registry is wrong.

**Verify the person's `name` spelling against the cited source, character by character.** Single-character typos (especially in non-Latin scripts or between visually similar letters) are easy to miss on visual review and have slipped through before. Treat a name-vs-source mismatch with the same weight as a date mismatch.

**Watch-outs on WebFetch:**

- The summarizer sometimes invents recent events or picks up draft/speculative content. Be skeptical of any claim about events in the current year — cross-verify with a second source (or the person's own Wikipedia page) before reporting it as a correction.
- Non-ASCII URL path segments (Cyrillic, CJK, etc.) usually work directly; you don't need to URL-encode them before passing to WebFetch.
- Sources frequently give imprecise dates (year only, or month + year). See **Handling imprecise mandate dates** for how to resolve these into concrete values without losing the source's native precision.

## Step 5: Report flagged-only

Group findings by role. For each flag, include:

- Issue category (overlap / gap / partial name / wrong source / stale / precision mismatch / …)
- File line number (use `grep -n` or a script to locate)
- Current value → suggested value
- Confidence level (clear-cut vs. needs-user-judgment)

Separate clear-cut fixes from judgment calls. Ask the user which to apply.

## Step 6: Apply fixes safely

When the user approves edits:

- **When writing a person's `name`, copy it verbatim from the cited source** — don't retype from memory or from a WebFetch summary. Summaries occasionally rewrite names; if in doubt, open the source URL and read the name in its original context. Re-transcription introduces plausible-looking typos that are hard to catch later.
- **Comments describe the mandate, not the person.** The data file tracks one specific role; everything in `comment` should be about *that* mandate — how it began (decree number, appointing authority, transition circumstances), how it ended (resignation, dismissal, replacement, term expiry), why a chart value was widened beyond source precision, calendar/jurisdictional caveats. Do **not** include pre-role career ("previously deputy director", "before that, served as MP") or post-role career ("later became deputy minister"), even when sources volunteer those details — they're biographical, not mandate-defining, and they smuggle a different role's data into this role's row. Test: if a sentence about the person could equally apply if they had held a totally different role, it doesn't belong. The same goes for research itself — when fetching sources, look for facts about the role you're tracking, not the holder's CV. (Someone serving as deputy before becoming titular is two distinct things; if the deputy period matters, it belongs as its own item under the deputy role, not as comment text on the titular item.)
- Prefer the `Edit` tool with enough surrounding context to make `old_string` unique (person names repeat across mandates — include a distinguishing adjacent line).
- If the file is JSON, **do not let Edit silently convert ASCII `"` to curly quotes** — this has corrupted JSON in prior runs. For any non-trivial rewrite, use a script that parses and re-serializes:
  ```bash
  node -e "var fs=require('fs'); var p='FILE'; var d=JSON.parse(fs.readFileSync(p,'utf8')); /* mutate */ fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');"
  ```
- After edits, validate:
  ```bash
  python3 -c "import json; json.load(open('FILE')); print('OK')"
  # or: node -e "JSON.parse(require('fs').readFileSync('FILE','utf8')); console.log('OK')"
  ```
- If you bulk-remove role groups, preserve the file's existing formatting (some arrays inline, some multi-line). A naive `json.dump(indent=2)` reformats everything and creates an enormous diff. Splice entries out by brace-matched character range instead of round-tripping the whole file.

## Step 7: Pre-report validation — MANDATORY

Before reporting the task done, run a check against the project's own conventions and fix anything it flags. Skipping this is the single most common way mandate-verification work regresses.

Template (adapt field names to the project's schema):

```python
python3 - <<'PY'
import json
data = json.load(open('PATH/TO/FILE.json'))
TOUCHED_ROLES = {...}  # roles you added to or modified this run
REQUIRED_SOURCE_FIELDS = {'from', 'quote'}  # whatever the project requires
missing = []
for role in data:
    if role.get('<role-key>') not in TOUCHED_ROLES: continue
    for item in role['<items-key>']:
        for s in item.get('sources', []):
            for f in REQUIRED_SOURCE_FIELDS:
                if f not in s:
                    missing.append((role['<role-key>'], item['<name-key>'], f'missing {f}'))
            if item['<value-key>'][1] is not None and 'to' not in s:
                missing.append((role['<role-key>'], item['<name-key>'], 'has end but source lacks `to`'))
        # NAME-SPELLING CHECK — catches retype-from-memory typos like Сърафов vs Сарафов.
        # The holder's surname (or full name) must appear verbatim in at least one source's
        # `quote` / `quoteOriginal` / source `name`. If it doesn't, the name was not copied
        # from the source — re-verify against the original-language page before reporting done.
        nm = item.get('<name-key>') or ''
        haystack = ' '.join(
            (s.get('quote') or '') + ' ' + (s.get('quoteOriginal') or '') + ' ' + (s.get('name') or '')
            for s in item.get('sources', [])
        )
        if nm and haystack.strip():
            parts = nm.split()
            surname = parts[-1] if parts else ''
            if surname and surname not in haystack and nm not in haystack:
                missing.append((role['<role-key>'], nm, f'surname "{surname}" not found verbatim in any source quote — likely typo'))
for m in missing: print(m)
print('OK' if not missing else f'{len(missing)} issues — fix before reporting done')
PY
```

Add a **boundary-evidence check**: for every mandate you added or re-dated this run, confirm at least one cited source is a class-1 artifact (something signed from inside the office, or the appointment instrument) dated within the mandate, and that no endpoint rests on a registry row alone when another source disagrees with it. If an endpoint has only registry support and a known conflict, it is not ready to report.

Add a **re-findability check** to the same pass: every source whose `link` points at a PDF must have a `[PDF стр. N]`-style locator on its `quote`, and no non-PDF source should carry one (a stray marker means a quote was copied between records).

```python
import re
for s in item.get('sources', []):
    is_pdf = s['link'][0].lower().endswith('.pdf')
    has_loc = bool(re.search(r'\[PDF (стр\.|p\.) \d+\]$', s.get('quote', '')))
    if is_pdf and not has_loc:
        missing.append((role_name, nm, 'PDF source without page locator'))
    if not is_pdf and has_loc:
        missing.append((role_name, nm, 'non-PDF source carries a page locator'))
```

If the script prints anything other than `OK`, fix the flagged entries before the end-of-turn summary. The name-spelling check has false positives only when *all* of an item's sources are non-name-bearing (rare) — in that case, add at least one source whose quote contains the holder's name, since that's the easiest way for future sessions to re-verify the spelling.

**The script catches name typos, not quote synthesis.** Surname-in-quote passing means the surname literally appears somewhere in the `quote` field — it does *not* prove the surrounding text is verbatim from the source. A common failure mode: the WebFetch summary returns two adjacent sentences from the page, you collapse them into a single quote ("Министерският съвет освободи X и назначи Y") that looks like one sentence on review, both surnames check out, but the connecting "...и назначи Y" half was your stitching, not the source's. This is invisible to the script and to visual review — the only way to catch it is to re-fetch one or two sources after writing and confirm each `quote` appears as a single contiguous sentence on the page. For multi-event claims (X dismissed, Y appointed in same Council session), prefer two separate source records — one quote per sentence — over one merged quote. When in doubt, ask WebFetch with a prompt like "quote verbatim, do not paraphrase, do not concatenate sentences" and copy what it returns unchanged.

## Step 8: Respect the project's intended scope

Mandate data is usually narrow by design — it exists to support a specific feature or event. Ask the user about scope boundaries before proposing to fill in decades of predecessors. Flag gaps once and move on; don't propose filling N years of history without the user asking for it.

---

## Handling imprecise mandate dates

Many historical mandates — especially older ones — are documented only at year or month precision. If the project uses a chart or timeline renderer, it likely needs fully-resolved dates for the axis, while the source only gives a looser bound. The typical project convention is:

- The chart-facing value (`value`, `start`/`end`, etc.) holds **fully-resolved ISO strings**.
- The source object preserves the **native precision** of what each source actually says.
- A `comment` on the item explains when the chart value was widened beyond what the source states.

If the project has no precision-preserving fields at all, skip this section and follow the existing convention.

### Source precision

Record what the source says at its native precision. The three forms are mutually exclusive within a single `from` or `to`:

| Source says | Fields to include | Example |
|---|---|---|
| Only a year ("1920") | `dateYear` | `{ "dateYear": 1920 }` |
| Year + month ("April 1920") | `dateYear`, `dateMonth` | `{ "dateYear": 1920, "dateMonth": 4 }` |
| Full date ("14 April 1920") | `date` | `{ "date": "1920-04-14" }` |

`from` and `to` can have different precisions — e.g. start year-only, end full date. If a source only mentions one endpoint, include only that object.

### Computing the chart-resolved range

Use **asymmetric widening** — start uses the earliest possible day in the window, end uses the latest:

| Known precision | Start | End |
|---|---|---|
| Full date | Exact: `YYYY-MM-DD` | Exact: `YYYY-MM-DD` |
| Year + month | `YYYY-MM-01` | Last day of month (`-28/29/30/31`) |
| Year only | `YYYY-01-01` | `YYYY-12-31` |
| Ongoing | computed start | `null` / project's "open" sentinel |

The asymmetry keeps the chart honest — the bar covers every day the mandate *could have* been in effect, rather than pretending to know a specific day that the source doesn't state.

**Whenever the chart value was widened from an imprecise source, add a `comment`** explaining what the source actually said.

### Date string encoding

- Modern dates: standard ISO — `1914-07-28`.
- CE dates before year 1000: 4-digit zero-padded — `0870-04-22`.
- BCE dates: negative year, 6-digit zero-padded — `-000551-01-01`.
- Ongoing mandate: use the project's "open" sentinel (commonly `null`).

### Calendar systems for old dates

Countries that reformed their calendar (Gregorian adoption, Republican calendar, etc.) have sources that cite Old Style / New Style dates differing by several days — often without labeling which they use. This can affect any mandate dated before the country's reform.

**Rule:** use the date as cited by the primary source, and note both styles in `comment` when the source provides them:

```json
"comment": "Cited in source as DD.MM.YYYY (Old Style); NN.MM.YYYY New Style."
```

If you're unsure which style a source uses, flag it for the user rather than silently guessing.

### Unknown endpoints

If a mandate endpoint is genuinely undocumented:

- **Unknown end:** use the last documented date of activity; explain in `comment`.
- **Unknown start:** use the earliest documented date in office; explain similarly.

Do not fabricate dates. If both endpoints are truly unknown, don't create the entry — raise it with the user.

**Prefer the shortest defensible range, not the widest possible bracket.** When an endpoint is undocumented, widen only to the last day of the *documented precision level* — not to the successor's start date, the end of a containing government, or any other contextual ceiling. Those are liberal bounds that imply a longer tenure than the evidence supports. Apply available constraints (age, predecessor's end, minister's start) to *shrink* the window, not to justify ballooning it. Explain the narrow choice in `comment`. Under-claiming is preferred to over-claiming when the truth is unknown.

### Acting / caretaker / non-titular mandates

When a seat is filled in a non-titular capacity — the official's term has expired and they continue acting, a deputy is filling in, a caretaker government is in place, etc. — model each non-titular period as a **separate item**, not as an extension of the prior titular mandate:

- One item per distinct non-titular period. If three people serve as acting head in succession, that's three items, even if the whole stretch is "between titular chairs".
- A person continuing from titular into acting is **two items**: a titular one ending on the day the term legally expired, and an acting one starting that same day. Don't merge them just because it's the same person.
- **Use a dedicated field** (e.g., `status`, `kind`, `capacity`) for the non-titular marker — don't bake it into the person's `name`. Names should stay clean and identical across capacities so the same person reads as the same person across mandate types. The chart/UI layer reads the field and renders the appropriate label/style.
- Use the project's existing field if one is in place; if introducing a new one, prefer a string enum that captures the legally-distinct capacities in the country's vocabulary (e.g., Bulgarian `"редовен"` / `"служебен"` / `"и.ф."` — caretaker minister appointed by the head of state is constitutionally different from a deputy acting after a term expires). Boolean flags collapse those distinctions and lose information.
- **Default = titular**: omit the field on titular items so existing entries don't need a sweep. Only non-titular items carry the marker.
- The `mandate` array (office-level term) should hold the **last titular mandate**, not the non-titular periods. Caretaker/acting periods are not constitutional mandates, so they don't belong in `mandate`. Leave them as items.
- Sources for a non-titular item should document the **appointment in that capacity** (the council protocol designating an acting head, the presidential decree forming a caretaker government) — not the news of the previous titular term ending.

Example (Bulgarian "Председател на ВАС" pattern using a `status` field):
```jsonc
"items": [
  { "name": "Person A",                  "value": ["2017-11-22", "2024-11-22"], "sources": [/* titular */] },
  { "name": "Person A", "status": "и.ф.", "value": ["2024-11-22", "2025-10-14"], "sources": [/* appointed acting */] },
  { "name": "Person B", "status": "и.ф.", "value": ["2025-10-14", "2026-04-15"], "sources": [/* appointed acting */] },
  { "name": "Person C", "status": "и.ф.", "value": ["2026-04-15", null],         "sources": [/* appointed acting */] }
]
```

If non-titular appointments are capped by law (e.g., 6-month limit per acting head), the resulting churn is real and worth modeling — it's often *the* story the chart needs to show.

### Person names: short form vs. full form

If the project distinguishes a **display name** from a **full legal name**, populate both:

- The display field (e.g. `name`) holds the form most readers will recognise — typically given + family name (`Иван Иванов`, `Boris Johnson`), since that's what news articles, ballots, and chart labels use.
- A separate full-name field (e.g. `fullName`) holds the canonical legal form — for Bulgarian and other patronymic-using cultures, that's three parts: собствено + бащино + фамилно (`Иван Петров Иванов`). For other cultures, follow whatever the official register uses (full middle names, all given names, suffixes like Jr./Sr., etc.).

Rules:

- **Don't fabricate the middle/patronymic from the family name.** Patronymics in Bulgarian, Russian, etc. derive from the *father's* name, not the family name — guessing produces wrong values that look plausible. If you can't find the patronymic in a source, leave `fullName` unset and flag it.
- **Nicknames stay out of `fullName`.** "Борислав Боби Сърафов" → `name: "Борислав Боби Сърафов"` (familiar form), `fullName: "Борислав Любомиров Сарафов"` (canonical). The display field can carry the nickname; the full-name field cannot.
- **Source the full name from the same authority** that documents the role: the person's own Wikipedia page is usually the cleanest, then official institutional pages (court rosters, parliament biographies, government bios). Avoid news articles for the full form — they almost always use the short form.
- **Spelling matters across both fields.** A character-level mismatch between `name` and `fullName` (e.g. `Сарафов` vs. `Сърафов`) means one of them is wrong — verify against the source before saving.
- If the person is a **mononym, royal title, or honorary form** that has no patronymic ("Симеон II", "Папа Франциск"), use the same value in both fields rather than inventing parts.

### Source quotes

For every source you add or verify, extract the **verbatim sentence** from the source that justifies the dates and store it in `quote` (or the project's equivalent field). This makes future re-verification trivial.

If the source is in a language other than the project's primary language, follow the project convention — commonly one field for the original-language text and another for the translation (e.g. `quoteOriginal` + `quote`).

Example (mixed precision, translated quote):
```jsonc
{
  "name": "Example Encyclopedia – <Topic>",
  "link": ["https://..."],
  "from": { "dateYear": 1920, "dateMonth": 4 },
  "to":   { "date": "1921-05-21" },
  "quoteOriginal": "The government was formed in April 1920 and fell on 21 May 1921.",
  "quote": "<translation in project's primary language>"
}
```

### Every quote must be re-findable

Published mandate data is only as trustworthy as a reader's ability to **check it without repeating your research**. A quote that can't be located in its source is an assertion, not a citation — the reader has to take your word for it, which is exactly what the citation was supposed to avoid.

So a URL alone is not enough whenever the source is large enough that "it's in there somewhere" is a real cost. Append the locator to the `quote` in square brackets, after the verbatim text, so the verbatim string stays intact and the locator is unambiguously an editorial addition:

```jsonc
"quote": "Г-н Крум Георгиев Георгиев е избран за председател на Управителния съвет. [PDF стр. 9]"
```

Pick the locator that matches the medium:

| Source type | Locator to append | Note |
|---|---|---|
| PDF | `[PDF стр. N]` / `[PDF p. N]` | **The physical PDF page** — the number a viewer jumps to |
| Long web page / report | `[раздел „<heading>“]` | Section or heading the sentence sits under |
| Table on a page | Quote the row itself, cells joined by ` \| ` | The row *is* the locator |
| Video / audio / podcast | `[HH:MM:SS]` | Timestamp of the statement |
| Registry / official gazette | `[Протокол № 8/14.02.2025 г.]`, decree/issue number | The document's own identifier |
| News article | publication `date` field | Usually sufficient; articles are short |

Two traps worth naming:

- **PDF page ≠ printed page label.** Annual reports routinely carry a footer like `Стр. 64 от 132` on what is physically PDF page 70 — front matter shifts the numbering. Cite the physical page; if both are useful, give the physical one and mention the label in `comment`. Verify by extracting per-page text (`pdftotext` splits pages on `\f`) rather than eyeballing.
- **A quote that appears several times.** Long reports repeat board-composition sentences in the management report, the notes, and the appendices. Cite the occurrence you actually used — normally the first, in the narrative section — not whichever one your search hit last.

The same instinct applies beyond locators: prefer a source that will still be there later. When a page looks fragile (news sites that expire, corporate sites that reshuffle URLs), add an archive mirror alongside the live URL in the `link` array rather than relying on one host staying up.

### Source `name` convention

Follow neighboring sources. A common pattern is en-dash (`–`, U+2013) separators with an optional language tag where ambiguity is possible:

- `Topic – Wikipedia`
- `Topic – Wikipedia (EN)` (when the project's primary language isn't English)
- `Article Title` — a news headline stands on its own

**Never append the URL, domain or hostname.** `Антон Славчев подава оставка – glasnews.bg` should be `Антон Славчев подава оставка`: the link is already in the entry, and the UI prints the publisher — falling back to the host — beside it, so the hostname is the same string twice. What may follow the dash is a *proper* publication or work name (`Wikipedia`, `Държавен вестник`, `Правно-информационна система на Министерския съвет`), never an address. If the project has a publisher field (e.g. `media`), that is where a publisher's name goes.

### JSON safety

Non-ASCII typographic quotes (`„`, `"`, `"`, `"`, etc.) look like ASCII `"` in many editors and can silently break JSON parsing if introduced inside string values. Escape them as Unicode (`„`, `“`, …), rewrite with single quotes, or drop the quotes when meaning is clear. Always validate after edits:

```bash
python3 -c "import json; json.load(open('FILE')); print('OK')"
```

## Known good starting points (for re-use)

**Enumerate, don't guess, when a database is keyed by name.** Registries that only answer name lookups can still be swept: probe the matching behaviour (prefix vs substring, minimum length), then iterate a covering set of name fragments — for a language with regular surname endings, a few dozen fragments plus a set of given-name trigrams reaches most of the population. Guessing candidate names finds the people you already suspected; a sweep finds the ones nobody wrote about.

The sources already in the file are the best starting point — check those first before searching for new ones. After that, start with the role's own encyclopedia page and individual person pages in the project's primary language, then cross-check against English encyclopedias or official institutional sources.
