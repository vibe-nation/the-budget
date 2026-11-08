import { stringToColor } from './timeline-colors';
import { humanDate } from './timeline-format';
import { Election, ElectionSource, GanttGroup } from './timeline.model';

/** Where izboren-den serves its data: the relative citations resolve against this. */
const ELECTION_DATA_BASE = 'https://prizemjavane.github.io/izboren-den/data/election-day/';

/** The one row whose bars are assemblies rather than people. */
const PARLIAMENT_GROUP_NAME = 'Народно събрание';

/** `48-о НС` → 48. The Grand National Assembly (`VII ВНС`) has no ordinal in this
    numbering and no election in the data, so it yields null. */
export function assemblyNumber(barName: string): number | null {
  const match = /^(\d+)-/.exec(barName);
  return match ? Number(match[1]) : null;
}

/** Hangs each election on the bar of the assembly it returned, for the tooltip. */
export function attachElections(groups: readonly GanttGroup[], elections: readonly Election[]): void {
  const byAssembly = new Map(elections.map((election) => [election.assembly, election]));
  for (const group of groups) {
    if (group.name !== PARLIAMENT_GROUP_NAME) continue;
    for (const item of group.items) {
      const assembly = assemblyNumber(item.name);
      const election = assembly === null ? undefined : byAssembly.get(assembly);
      if (election) item.election = election;
    }
  }
}

/* Keyed by the normaliser's alias, so one entry covers every ballot name a party
   ran under. The two lists that split from ДПС in 2024 differ on purpose, so the
   seat bar shows two blocks. Everyone else gets the bars' name hash. */
const PARTY_COLORS: Readonly<Record<string, string>> = {
  БСП: '#df0000',
  ДПС: '#0060aa',
  'ДПС-Ново начало': '#0060aa',
  АПС: '#7fb2e5',
  СДС: '#003f8a',
  НДСВ: '#f7cb24',
  ГЕРБ: '#5789c4',
  ИТН: '#4bb7de',
  АТАКА: '#000000',
  'Продължаваме Промяната': '#0211c9',
  'ПРОДЪЛЖАВАМЕ ПРОМЯНАТА – ДЕМОКРАТИЧНА БЪЛГАРИЯ': '#530cb7',
  'ДЕМОКРАТИЧНА БЪЛГАРИЯ': '#1e3a5f',
  ВЪЗРАЖДАНЕ: '#1a5e1f',
};

export function partyColor(alias: string): string {
  return PARTY_COLORS[alias] ?? stringToColor(alias);
}

/** One seat-winning list, as the seat bar and the list under it print it. */
export interface SeatRow {
  /** Short name: the normaliser's alias, or the ballot name when it has none. */
  readonly alias: string;
  /** The ballot name, for the hover tip. */
  readonly name: string;
  readonly votes: number;
  readonly percent: number;
  readonly mandates: number;
  readonly color: string;
  /** Fraction of the house, for the bar segment's width. */
  readonly share: number;
}

/** Summed rather than assumed to be 240, so an unfinished count stays consistent. */
export function totalSeats(election: Election): number {
  return election.metrics.parties.reduce((sum, party) => sum + (party.mandates ?? 0), 0);
}

export function seatRows(election: Election): SeatRow[] {
  const total = totalSeats(election);
  return election.metrics.parties
    .filter((party) => (party.mandates ?? 0) > 0)
    .sort((a, b) => b.mandates! - a.mandates! || b.votes - a.votes)
    .map((party) => {
      const alias = party.alias ?? party.name;
      return {
        alias,
        name: party.name,
        votes: party.votes,
        percent: party.percent,
        mandates: party.mandates!,
        color: partyColor(alias),
        share: total ? party.mandates! / total : 0,
      };
    });
}

/** The election's citations, each with a full URL. */
export function electionSources(election: Election): ElectionSource[] {
  return election.sources.map(({ name, url }) => ({ name, url: /^https?:\/\//.test(url) ? url : ELECTION_DATA_BASE + url }));
}

const VOTES_FORMAT = new Intl.NumberFormat('bg-BG', { useGrouping: true, maximumFractionDigits: 0 });

export function formatVotes(votes: number): string {
  return VOTES_FORMAT.format(votes);
}

const PERCENT_FORMAT = new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatPercent(percent: number): string {
  return `${PERCENT_FORMAT.format(percent)} %`;
}

/* The tooltip is written with `innerHTML`, outside Angular's style scoping, so it
   borrows the global `.election-seat*` classes in styles.css. Built through the
   DOM so party names are escaped for us. */
export function electionSeatsHtml(election: Election): string {
  const doc = document.implementation.createHTMLDocument('');
  const root = doc.createElement('div');
  root.className = 'election-seats';

  const bar = doc.createElement('div');
  bar.className = 'election-seat-bar';
  const list = doc.createElement('ul');
  list.className = 'election-seat-list';

  for (const row of seatRows(election)) {
    const segment = doc.createElement('span');
    segment.className = 'election-seat';
    segment.style.width = `${(row.share * 100).toFixed(3)}%`;
    segment.style.background = row.color;
    segment.title = `${row.alias} — ${row.mandates}`;
    bar.append(segment);

    const item = doc.createElement('li');
    item.className = 'election-seat-row';
    const dot = doc.createElement('span');
    dot.className = 'election-seat-dot';
    dot.style.background = row.color;
    const alias = doc.createElement('span');
    alias.className = 'election-seat-alias';
    alias.textContent = row.alias;
    const mandates = doc.createElement('span');
    mandates.className = 'election-seat-mandates';
    mandates.textContent = String(row.mandates);
    const percent = doc.createElement('span');
    percent.className = 'election-seat-percent';
    percent.textContent = formatPercent(row.percent);
    item.append(dot, alias, mandates, percent);
    list.append(item);
  }

  root.append(bar, list);
  return root.outerHTML;
}

/** The election day and turnout on one line, then the seat bar and the party list. */
export function electionTooltipHtml(election: Election): string {
  return `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid #f4f5f7;">
      <div style="font-size:13px;font-weight:600;color:#1f2937;">Избори · ${humanDate(election.date)}</div>
      <div style="font-size:13px;color:#4b5563;white-space:nowrap;">активност ${formatPercent(election.activity)}</div>
    </div>${electionSeatsHtml(election)}`;
}
