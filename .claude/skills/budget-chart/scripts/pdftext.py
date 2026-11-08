#!/usr/bin/env python3
"""Text out of Bulgarian State Gazette / Ministry of Finance budget PDFs.

Handles the three things plain `pdftotext -layout` gets wrong on this corpus:
  * mojibake — older DV issues encode Cyrillic so pdftotext emits Latin-1
    glyphs ("ÄÚÐÆÀÂÅÍ"); re-decoded here as cp1251.
  * two-column pages — DV sets running text in two columns, so a table row and
    an unrelated column's numbers land on the same output line. --col crops.
  * OCR spacing / hyphenation — "П рокуратура", "Наци-\nонална"; --find matches
    through inserted whitespace, soft hyphens and line-break hyphens.

Usage:
  pdftext.py FILE.pdf --find "Прокуратура"              # which pages mention it
  pdftext.py FILE.pdf --find "Прокуратура" --context 6  # + surrounding lines
  pdftext.py FILE.pdf --pages 23                        # one page, full width
  pdftext.py FILE.pdf --pages 23 --col left             # left column only
  pdftext.py FILE.pdf                                   # whole document

Exit status 1 and a warning on stderr when a page yields almost no text —
that means a scanned PDF with no text layer; go to the DV issue instead.

Some issues (DV 2001) set pages in a font whose codes map to no characters, so
pdftotext emits control codes that no re-decoding repairs. --find names those
pages on stderr instead of reporting a silent "no match": read their images.
"""
import argparse, re, subprocess, sys

SOFT_HYPHEN = '­'


def _fix(text):
    """Undo cp1251-as-Latin-1 mojibake and drop soft hyphens.

    Detected by comparing real Cyrillic against Latin-1 high-range characters,
    not by counting a few specific glyphs: a page that is mostly a numeric
    table carries very little text, so glyph-count thresholds miss it and the
    page silently stays unreadable.
    """
    cyrillic = sum('\u0400' <= c <= '\u04ff' for c in text)
    latin_high = sum('\u00c0' <= c <= '\u00ff' for c in text)
    if latin_high > 20 and latin_high > cyrillic:
        text = text.encode('latin1', 'replace').decode('cp1251', errors='replace')
    return text.replace(SOFT_HYPHEN, '')


def garbled(text):
    """True when the text layer is control codes rather than letters.

    Control codes against Cyrillic letters, not a lack of Cyrillic alone: a page
    of a numeric table has few letters and is still perfectly readable, and a
    repaired cp1251 page keeps a little noise.
    """
    control = sum(c < ' ' and not c.isspace() for c in text)
    cyrillic = sum('Ѐ' <= c <= 'ӿ' for c in text)
    return control >= 100 and control > cyrillic


def unreadable_warning(pdf, pages):
    return (f'pdftext: {pdf} has an undecodable text layer on '
            f'{"page" if len(pages) == 1 else "pages"} {_ranges(pages)} (a font with its own '
            f'glyph codes): its text there is unreadable and a search finds nothing. Read those '
            f'pages as images.')


def _ranges(pages):
    """1 2 3 7 9 10 → "1–3, 7, 9–10"."""
    out, start = [], None
    for i, pg in enumerate(pages):
        start = pg if start is None else start
        if i + 1 == len(pages) or pages[i + 1] != pg + 1:
            out.append(str(pg) if pg == start else f'{start}–{pg}')
            start = None
    return ', '.join(out)


def page_size(pdf):
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    m = re.search(r'Page size:\s+([\d.]+) x ([\d.]+)', info)
    if not m:
        sys.exit(f'pdftext: cannot read page size of {pdf}')
    return float(m.group(1)), float(m.group(2))


def n_pages(pdf):
    info = subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout
    m = re.search(r'Pages:\s+(\d+)', info)
    return int(m.group(1)) if m else 0


def extract(pdf, first=None, last=None, col='full'):
    cmd = ['pdftotext', '-layout']
    if first:
        cmd += ['-f', str(first), '-l', str(last or first)]
    if col != 'full':
        w, h = page_size(pdf)
        x = 0 if col == 'left' else int(w * 0.5)
        cmd += ['-x', str(x), '-y', '0', '-W', str(int(w * 0.5)), '-H', str(int(h))]
    cmd += [pdf, '-']
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    return _fix(out)


def fuzzy(phrase):
    """Match through inserted whitespace, soft hyphens and line-break hyphens."""
    gap = r'[\s­\-]*'
    return re.compile(''.join(
        (gap if ch == ' ' else re.escape(ch) + gap) for ch in phrase))


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('pdf')
    p.add_argument('--pages', help='N or N-M (1-based, inclusive)')
    p.add_argument('--col', choices=['left', 'right', 'full'], default='full')
    p.add_argument('--find', help='phrase to locate (whitespace/hyphen tolerant)')
    p.add_argument('--context', type=int, default=0,
                   help='with --find: print this many lines around each hit')
    a = p.parse_args()

    first = last = None
    if a.pages:
        first, _, rest = a.pages.partition('-')
        first = int(first)
        last = int(rest) if rest else first

    if a.find and not a.pages:
        pat = fuzzy(a.find)
        hits = []
        unreadable = []
        chars = 0
        for pg in range(1, n_pages(a.pdf) + 1):
            text = extract(a.pdf, pg, pg, a.col)
            chars += len(text.strip())
            if garbled(text):
                unreadable.append(pg)
                continue
            if pat.search(text):
                hits.append(pg)
                if a.context:
                    lines = text.split('\n')
                    for i, line in enumerate(lines):
                        if pat.search(line):
                            lo, hi = max(0, i - a.context), i + a.context + 1
                            print(f'--- {a.pdf} p.{pg}')
                            print('\n'.join(lines[lo:hi]))
        if not hits and chars < 100 * max(1, n_pages(a.pdf)) // 100:
            print(f'pdftext: {a.pdf} has almost no text layer — this is a scan, '
                  f'so "not found" here means nothing. Fetch the same law from '
                  f'dv.parliament.bg instead.', file=sys.stderr)
            return 1
        if unreadable:
            print(unreadable_warning(a.pdf, unreadable), file=sys.stderr)
        if not a.context:
            print(' '.join(map(str, hits)) if hits else '(no pages match)')
        if not hits:
            return 1
        return 0

    text = extract(a.pdf, first, last, a.col)
    if len(text.strip()) < 100:
        where = f'pages {a.pages}' if a.pages else 'the document'
        print(f'pdftext: {where} of {a.pdf} has almost no text layer — this is a '
              f'scan. Fetch the same law from dv.parliament.bg instead.',
              file=sys.stderr)
        return 1
    pages = range(first, (last or first) + 1) if first else range(1, n_pages(a.pdf) + 1)
    unreadable = [pg for pg in pages if garbled(extract(a.pdf, pg, pg, a.col))]
    if unreadable:
        print(unreadable_warning(a.pdf, unreadable), file=sys.stderr)
        if len(unreadable) == len(pages):
            return 1
    if a.find:
        pat = fuzzy(a.find)
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if pat.search(line):
                lo, hi = max(0, i - a.context), i + a.context + 1
                print('\n'.join(lines[lo:hi]))
        return 0
    print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
