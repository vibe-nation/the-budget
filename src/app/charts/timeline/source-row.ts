import { Source } from './timeline.model';

/** What kind of document a source is. The entry's icon names it, so a reader can
    tell a decree from an encyclopedia before reading the title. */
export type SourceKind = 'official' | 'video' | 'reference' | 'pdf' | 'document';

/** A quote split into what the source says and where in it to look. */
export interface Excerpt {
  readonly text: string;
  readonly locator?: string;
}

/** Another copy of a source. The card numbers the copies and shows `label` on hover. */
export interface Mirror {
  readonly url: string;
  readonly label: string;
}

export interface SourceRow {
  readonly name: string;
  /** Empty when the source has no link. */
  readonly url: string;
  readonly kind: SourceKind;
  /** Publisher label: the source's own `media`, else its hostname. */
  readonly media: string;
  readonly date?: string;
  readonly excerpt: Excerpt | null;
  readonly comment?: string;
  readonly mirrors: readonly Mirror[];
}

const MEDIA_ALIASES: Readonly<Record<string, string>> = {
  'bntnews.bg': 'БНТ',
  'bg.wikipedia.org': 'wikipedia',
  'btvnovinite.bg': 'btv',
  'svobodnaevropa.bg': 'Свободна Европа',
  'capital.bg': 'Капитал',
  'bnr.bg': 'БНР',
  'ec.europa.eu': 'Евростат',
};

/* Institutions whose own publications are primary acts, matched as hostname
   suffixes on a label boundary: `dv.parliament.bg` falls in with its parent while
   `notgov.bg` does not. */
const OFFICIAL_HOST_SUFFIXES = ['government.bg', 'parliament.bg', 'president.bg', 'justice.bg', 'gov.bg', 'europa.eu', 'bnb.bg'];

/* The data ends a quote with a bracketed locator („… [ДВ, бр. 48 от 31 май 2013 г.]“).
   That is citation apparatus, not speech, so the card prints it after the closing
   quote mark. Only the trailing bracket is split off. */
const TRAILING_LOCATOR = /\s*\[([^[\]]+)\]\s*$/;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function mediaLabel(url: string): string {
  if (!url) return '';
  const host = hostnameOf(url);
  return MEDIA_ALIASES[host] ?? host;
}

/** Only the path counts, so a viewer page taking a file as a query stays a web page. */
function isPdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

const hasSuffix = (host: string, suffix: string) => host === suffix || host.endsWith(`.${suffix}`);

export function sourceKind(url: string): SourceKind {
  if (!url) return 'document';
  if (isPdf(url)) return 'pdf';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  const host = hostnameOf(url);
  if (hasSuffix(host, 'wikipedia.org')) return 'reference';
  return OFFICIAL_HOST_SUFFIXES.some((suffix) => hasSuffix(host, suffix)) ? 'official' : 'document';
}

/** Null for an empty quote, and for one that merely repeats the source's title. */
export function toExcerpt(quote: string | undefined, title?: string): Excerpt | null {
  const text = quote?.trim();
  if (!text || text === title?.trim()) return null;
  const match = TRAILING_LOCATOR.exec(text);
  if (!match) return { text };
  const body = text.slice(0, match.index).trim();
  return body ? { text: body, locator: match[1].trim() } : { text };
}

/** Links after the first, in order, without exact duplicates. */
export function mirrorLinks(links: readonly string[]): Mirror[] {
  return [...new Set(links.slice(1))].filter((url) => url !== links[0]).map((url) => ({ url, label: mediaLabel(url) }));
}

export function toSourceRow(source: Source): SourceRow {
  const links = source.link ?? [];
  const url = links[0] ?? '';
  return {
    name: source.name,
    url,
    kind: sourceKind(url),
    media: source.media ?? mediaLabel(url),
    date: source.date,
    excerpt: toExcerpt(source.quote, source.name),
    comment: source.comment,
    mirrors: mirrorLinks(links),
  };
}
