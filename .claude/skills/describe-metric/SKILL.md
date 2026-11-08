---
name: describe-metric
description: Use when a series is added to public/data/charts.json, when a line on the timeline has no explanation in its side panel, or when asked to write, update or check what a metric, indicator or institution means — какво е, как се измерва, по-добре ли е да расте или да пада, какво прави МВР, какви са отговорностите на дадена институция, „обяснение“ на линия от графиката, файл в public/data/metrics.
---

# Describe a metric

Write the Bulgarian text a reader sees below the sources, under the chart's name, when they click a line on the timeline. It tells them what the line is about, so it should stay true for years without anyone touching it.

## The file

`public/data/metrics/<name>.md`, one file per metric.

`<name>` is the series `id` in `public/data/charts.json` without a trailing `-eur`, `-bgn` or `-percent`. The app makes the link from that name alone, so nothing else needs registering, and a series in two units shares one file.

| Series `id` | File |
|---|---|
| `government-debt-eur`, `government-debt-percent` | `government-debt.md` |
| `gini-coefficient` | `gini-coefficient.md` |

A series with no file shows no section. Check that the file is there before writing a new one, and update it instead.

## The text

Write under 150 words of plain Bulgarian, for a reader with no economics. Spell out an abbreviation the first time it appears, and use the terms the chart uses. Refer to the chart as „графиката“, never „линията“. Build it from paragraphs, with a bullet list when there are several parallel items and bold for a list item's label. Leave out headings and links: the card prints the chart's name as the title, and the sources.

For an **indicator**, in this order:

1. What it is, in one or two sentences.
2. How it is measured: what goes in, and the scale or unit as published.
3. Whether higher or lower is better, when an official source or a stated policy goal points that way. If it depends, say on what. If nothing points either way, leave this part out.
4. Any fixed threshold in law or treaty, and who set it.

For an **institution**, in this order:

1. What it is and who runs it.
2. What it is responsible for, as a short list.
3. For a budget line, what the amount is, such as the expenses adopted in the annual budget law.

Say only what the line includes. Everything in the text describes what the metric or institution is and does, so a reader never meets a list of what falls outside it.

Each statement should hold next year too. Describe rules, scales and responsibilities, because the line itself carries the yearly numbers. A figure belongs in the text only when a law, treaty or definition fixes it, such as the 3% deficit limit. If the line reaches back to years when the remit was different, say so in one general sentence, without dates.

Keep a published unit as it is published: a coefficient stays a coefficient, never a percent. Stick to what the metric means, and leave judging governments or periods to the reader.

## Checking the facts

Every fact rests on one source you have read: the law for an institution, the dataset's own methodology or glossary for an indicator. Look in Bulgarian first, and at the official source before any media, in English where no Bulgarian one exists. Once each fact has its source, stop researching.

A claim you could not confirm stays out of the file. Remove it or reword it to what you did confirm, because a reader sees the file and never your notes.

Your reply to the user lists the sources, anything you left out and why, and any sentence that rests on your own reading of a source, so they can review it.
