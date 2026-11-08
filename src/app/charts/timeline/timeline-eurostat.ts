import {
  ChartPoint,
  ChartSeries,
  DatasetOption,
  EurostatGuide,
  EurostatRow,
} from './timeline.model';

/** Each dimension as Eurostat's data browser names it, for the reader to find it there. */
const DIMENSION_NAMES: Readonly<Record<string, string>> = {
  freq: 'Time frequency',
  unit: 'Unit of measure',
  sector: 'Sector',
  na_item: 'National accounts indicator (ESA 2010)',
  geo: 'Geopolitical entity (reporting)',
  age: 'Age class',
  statinfo: 'Statistical information',
  coicop18: 'Classification of individual consumption by purpose (COICOP) - 2018',
};

const QUARTERLY: DatasetOption = { code: 'Q', label: { en: 'Quarterly', bg: 'Тримесечно' } };

function optionRow(dimension: string, { code, label }: DatasetOption): EurostatRow {
  const option = label?.en ?? code;
  return {
    dimension: DIMENSION_NAMES[dimension] ?? dimension,
    option,
    code,
    ...(label?.bg ? { meaning: label.bg } : {}),
  };
}

/** The years or months the series takes from its own dataset, as Eurostat prints them. */
function seriesPeriod({ data, dataset }: ChartSeries): string {
  const period = (date: string) =>
    date.slice(0, dataset?.selection?.['freq']?.code === 'M' ? 7 : 4);
  const own = data.filter((point) => !point.dataset);
  if (!own.length) return '';
  const [first, last] = [period(own[0].date), period(own[own.length - 1].date)];
  return first === last ? first : `${first} – ${last}`;
}

/**
 * What to pick on Eurostat's page to see this series, whose link opens the dataset's default view.
 * A point from another dataset, such as the latest quarter on a yearly line, gets that dataset's
 * own directions. Nothing for a series that isn't Eurostat's.
 */
export function eurostatGuide(
  chart: ChartSeries,
  point: ChartPoint | null = null,
): EurostatGuide | undefined {
  const selection = chart.dataset?.selection;
  const dataset = point?.dataset?.id ?? chart.dataset?.id;
  const url = chart.sources?.find(({ dataset_id }) => dataset_id === dataset)?.url[0];
  if (!selection || !dataset || !url?.includes('ec.europa.eu/eurostat')) return undefined;

  const period = point?.dataset?.period ?? seriesPeriod(chart);
  const quarterly = /Q\d$/.test(point?.dataset?.period ?? '');
  const rows = Object.entries(selection).map(([dimension, option]) =>
    optionRow(dimension, dimension === 'freq' && quarterly ? QUARTERLY : option),
  );
  return {
    dataset,
    url,
    preset: url.includes('/bookmark/'),
    rows: period ? [...rows, { dimension: 'Time', option: period }] : rows,
  };
}
