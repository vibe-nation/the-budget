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

Old issues are set in two columns. Use `pdftotext` without `-layout` to find a phrase: with it, the columns interleave and the phrase breaks. The text layer can space out letters („Национа лна“), so search for the digits. In `zsh`, a line starting `===` fails, and `pkill -f <name>` can kill its own shell.

## Polite use

Pause about half a second between requests, and use the `research-client` User-Agent the reader already sets.
