import moment from 'moment';

export function humanDate(date?: string | number): string {
  return moment(date).format('D MMMM YYYY г.');
}

/* An ongoing tenure is `null` on disk but reaches "now" once the chart resolves
   it, and printing today's date there would read as a real end date. */
export function humanRangeEnd(date: string | number): string {
  return moment(date).isSame(moment(), 'day') ? 'до днес' : humanDate(date);
}

export interface DurationParts {
  readonly years: number;
  readonly months: number;
  readonly days: number;
}

export function durationParts(from: string | number, to: string | number): DurationParts {
  const startDate = moment(from);
  const endDate = moment(to);

  const years = endDate.diff(startDate, 'years');
  startDate.add(years, 'years');

  const months = endDate.diff(startDate, 'months');
  startDate.add(months, 'months');

  return { years, months, days: endDate.diff(startDate, 'days') };
}

/* Adds spans through the calendar rather than in raw days, so months carry the
   way they do in the rows the reader is adding up. */
export function sumDurations(ranges: readonly (readonly [string | number, string | number])[]): DurationParts {
  const anchor = moment(0);
  const cursor = anchor.clone();

  for (const [from, to] of ranges) {
    const { years, months, days } = durationParts(from, to);
    cursor.add(years, 'years').add(months, 'months').add(days, 'days');
  }

  return durationParts(anchor.valueOf(), cursor.valueOf());
}

function durationWords({ years, months, days }: DurationParts): string {
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years !== 1 ? 'години' : 'година'}`);
  if (months > 0) parts.push(`${months} ${months !== 1 ? 'месеца' : 'месец'}`);
  if (days > 0) parts.push(`${days} ${days !== 1 ? 'дни' : 'ден'}`);
  return parts.join(', ');
}

/** Like `humanDateDiff`, but a zero span still reads as a duration. */
export function fullDuration(parts: DurationParts): string {
  return durationWords(parts) || '0 дни';
}

export function humanDateDiff(from: string | number, to: string | number): string {
  return durationWords(durationParts(from, to));
}
