import { humanDate } from './timeline-format';
import { BudgetPeriodLaw, BudgetPeriodYear, BudgetPeriods, BudgetRegime, GanttGroup, GanttItem, Source } from './timeline.model';

export const BUDGET_PERIOD_ROW = 'Бюджет в сила';

export const BUDGET_PERIOD_DESCRIPTION =
  'Кой закон за държавния бюджет е бил в сила по всяко време — тъмното е година, харчила по собствения си бюджет, светлото е удължен бюджет от предходната година';

/* Two shades of one slate: dark is a year spending under its own budget law,
   light is a year still running on the previous one's framework. The renderer
   picks each label's colour from its fill, so both stay readable. */
const PERIOD_OWN_COLOR = '#334155';
const PERIOD_CARRYOVER_COLOR = '#cbd5e1';

/** „Приет от 52-рото Народно събрание на 24 юли 2026 г.; обн. ДВ, бр. 69…“ */
function adoptionLine(entry: BudgetPeriodYear): string {
  const { adopted, assembly, dv } = entry.law;
  const passed = adopted
    ? `Приет от ${assembly ?? 'Народното събрание'} на ${humanDate(adopted)}`
    : /* The scanned ДВ issues for 2000, 2001 and 2007–2010 have no usable text
         layer; the date was left out rather than guessed. */
      'Датата на приемане не е установена от закона';
  return `${passed}; обн. ${dv}`;
}

/* A law is cited by the gazette that promulgated it: that gives it force. The
   annual laws have no web link in the data, so they cite the issue alone. */
function annualLawSource(law: BudgetPeriodLaw): Source {
  const clause = law.inForceFromVerified && law.inForceReference ? ` · клаузата за влизане в сила: ${law.inForceReference}` : '';
  return { name: law.title, media: 'Държавен вестник', date: law.promulgated, comment: `${law.dv}${clause}` };
}

/** Only the gazette citation is certain, so the link is whatever copy the data has. */
function extensionLawSource(law: BudgetPeriodLaw): Source {
  return {
    name: law.title,
    link: law.url ? [law.url] : [],
    /* With a link the host names the publisher: a mirror must not pose as the gazette. */
    ...(law.url ? {} : { media: 'Държавен вестник' }),
    date: law.promulgated,
    comment: [law.dv, law.note].filter(Boolean).join(' · '),
  };
}

function ownBar(entry: BudgetPeriodYear, regime: BudgetRegime): GanttItem {
  return {
    name: String(entry.year),
    title: entry.law.title,
    value: [regime.from, regime.to],
    description: adoptionLine(entry),
    comment: entry.lateByDays
      ? `В сила от 1 януари ${entry.year} г., но обнародван ${entry.lateByDays} дни по-късно — дотогава се е харчело по бюджета за ${entry.year - 1} г.`
      : undefined,
    color: PERIOD_OWN_COLOR,
    sources: [annualLawSource(entry.law)],
  };
}

/* `waiting` is the year still without a budget and holds the extension laws;
   `carried` is the year whose framework was being spent. Either may be missing. */
function carryoverBar(regime: BudgetRegime, waiting?: BudgetPeriodYear, carried?: BudgetPeriodYear): GanttItem {
  /* The year still waiting for its own budget is the calendar year the segment
     falls in; `budgetYear` is the one being carried into it. */
  const waitingFor = Number(regime.from.slice(0, 4));

  return {
    name: `${regime.budgetYear} (удължен)`,
    title: `Бюджетът за ${regime.budgetYear} г., удължен до приемането на бюджета за ${waitingFor} г.`,
    value: [regime.from, regime.to],
    description: regime.laws.join(' · '),
    comment: `През този период няма приет бюджет за ${waitingFor} г.: приходите се събират и разходите се извършват по рамката на предходната година.`,
    color: PERIOD_CARRYOVER_COLOR,
    /* The extension law leads: it is what made this stretch lawful. */
    sources: [...(waiting?.gap?.laws ?? []).map(extensionLawSource), ...(carried ? [annualLawSource(carried.law)] : [])],
  };
}

/** The gantt row: one bar per segment of `regimes`. */
export function toBudgetPeriodGroup(periods: BudgetPeriods): GanttGroup {
  const byYear = new Map(periods.budgets.map((entry) => [entry.year, entry]));

  const items = periods.regimes.flatMap((regime) => {
    if (regime.kind === 'carryover') {
      return [carryoverBar(regime, byYear.get(Number(regime.from.slice(0, 4))), byYear.get(regime.budgetYear))];
    }
    const entry = byYear.get(regime.budgetYear);
    return entry ? [ownBar(entry, regime)] : [];
  });

  return { name: BUDGET_PERIOD_ROW, description: BUDGET_PERIOD_DESCRIPTION, items };
}
