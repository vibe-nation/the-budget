# Finding an act in Държавен вестник

The site has no API. `.claude/skills/verify-mandates/scripts/dv_gazette.py` drives it, using only the Python standard library. Run from the project root:

```python
import sys; sys.path.insert(0, '.claude/skills/verify-mandates/scripts')
import dv_gazette as d

op, vs = d.session()                     # a fresh session for each search: a reused one returns nothing
issues, n, html = d.issues(op, vs, keyword='бюджет', frm='20.12.2013', to='20.12.2013')  # dd.mm.yyyy
mats, raw = d.contents(op, vs, issues[0], razdel='1')
text = d.material(op, id_mat)
```

## Act page

- **Search short windows.** A search returns at most 10 issues, and `n` above 10 means it was cut. Ten days at a time is safe. The issues of a year's budget laws cluster around the state budget act's date in the catalogue.
- **`keyword` barely filters.** Treat every issue in the window as a candidate and match titles yourself. A scan of whole years takes hours, so use it last.
- **Pass `razdel='1'`.** The default also pulls the unofficial section's hundreds of notices.
- **Link text is useless.** Every link reads „Преглед на материала“. The title stands before its link, so pair each title with the next `idMat`.
- **Strip `<script>` first.** Some pages end in a long script, and a tail of the page would otherwise be that script.
- **Titles have soft hyphens.** Remove `U+00AD` before matching.
- **Confirm the hit.** The act page's first line gives `брой: N, от дата D`, which must match the expected issue.
- **Acts from before 2004 have no page.** Their issue lists 0 materials.

Act URL: `https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=<id>`

## Full issue

The row's „Изтегли броя“ link is a form post. Find `oamSubmitForm('broi_form','broi_form:dataTable1:<n>:_idJsp109',null,[['id_','<id>']]` in the search result, post it with `_idcl` and `id_` plus the search fields, and read the redirect's final URL, which holds `idFileAtt`.

The first response can be an F5 JavaScript stub instead of a PDF. Keep the cookies and repeat the request, then check that the file starts with `%PDF`.

This returned no file for 2023–2026, or for бр. 99 от 2019 г., so those have `issueUrl: null` or no printed page. Keep them that way.

In a full-issue PDF, the PDF page equals the printed page. Minfin's and НОИ's PDFs are extracts or retyped, so their pages differ. Read the printed page from the `СТР. N` header, or find the figure in the issue. In older issues the headers decode as cp1251.

**The yearly index finds an act before 2004.** Until 2002, the year's last issue ends with „Справочник на „Държавен вестник“ за <year> г.“, which lists each act as `issue/page` under its institution: „Национална здравноосигурителна каса, Закон за бюджета на—за 2001 г. 108/22“. The same entry lists that body's other acts, so a ЗИД of the act would be listed there too. An amendment made inside another law is not, so say so when you rely on the index. An issue's first page lists its contents with pages.

Some pages of old issues use fonts with no text mapping, and `pdftext.py` returns symbols. `бр. 110 от 2001 г.` is one. Render the page with `pdftoppm -f N -l N -r 130 -png` and read the image.

Old issues are set in two columns. Use `pdftotext` without `-layout` to find a phrase: with it, the columns interleave and the phrase breaks. The text layer can space out letters („Национа лна“), so search for the digits. In `zsh`, a line starting `===` fails, and `pkill -f <name>` can kill its own shell.

## lex.bg

[lex.bg](https://lex.bg) publishes acts with their history, which makes it a quick place to look things up. It is never the source a value cites.

- **Amendment history.** An act's page starts with „Обн. ДВ. бр. …“, followed by every „изм.“, „доп.“ and „попр. ДВ. бр. …“. This includes amendments made by other laws. Use it to list what step 5 has to read, then read each one in the gazette.
- **The text is consolidated.** The page shows the act as it stands now, with amendments folded in, so its figures may not be the adopted ones. Read the figure from the gazette.
- **Fetching.** The pages are cp1251. Act pages are at `https://lex.bg/laws/ldoc/<id>` and open with `curl -A research-client`. The site search needs a browser session: a plain POST returns „Няма резултати“, which says nothing about whether the act exists. In a browser, fill `#search2_txt` on the home page and press Enter. The result links hold the `ldoc` id. The search doesn't find state budget acts before 2010, or the 2018, 2024–2026 ones, and an empty result proves nothing.
- **State budget acts on lex.bg (`ldoc` ids).** 2010 2135654585, 2011 2135708982, 2012 2135764986, 2013 2135829969, 2014 2136003154, 2015 2136410750, 2016 2136700906, 2017 2136949161, 2018 2137178752, 2019 2137189074, 2020 2137198498, 2021 2137207657, 2022 2137220490, 2023 2137235202, 2024 2137238807. To check for amendments, compare the row with the figure on the act's page. The first line lists the amending issues.

## Polite use

Pause about half a second between requests, and use the `research-client` User-Agent the reader already sets.
