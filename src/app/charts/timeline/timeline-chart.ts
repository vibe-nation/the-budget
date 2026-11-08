import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, TemplateRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';

import * as echarts from 'echarts/core';
import { CustomChart, LineChart } from 'echarts/charts';
import { DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { forkJoin } from 'rxjs';

import { NavSlot } from '../../navigation/nav-slot';
import { BUDGET_PERIOD_ROW, toBudgetPeriodGroup } from './budget-periods';
import { DetailCard } from './detail-card';
import { EventsMenu } from './events-menu';
import { LegendSearch, isListed } from './legend-search';
import { LinesLegend } from './lines-legend';
import { SettingsDialog } from './settings-dialog';
import {
  RoleOrder,
  applyOrder,
  clearStoredOrder,
  moveRole,
  ordersEqual,
  readStoredOrder,
  readStoredPanelOpen,
  readStoredSelection,
  reconcileOrder,
  restoreSelection,
  storeOrder,
  storePanelOpen,
  storeSelection,
} from './role-order';
import { RoleMove, RoleRow, RolesPanel } from './roles-panel';
import { NARROW_WIDTH_PX, TimelineOption, TimelineView, buildTimelineOption, legendColumnWidth, valueAxisLayout } from './timeline-chart-option';
import { attachElections } from './timeline-elections';
import { eventSelectionUpdate, inMenuOrder, readStoredHiddenEvents, storeHiddenEvents } from './timeline-events';
import { adjustImpreciseOverlaps } from './timeline-lanes';
import { ValueAxisRanges, timeWindow, valueAxisPatches, valueAxisRanges } from './timeline-value-axes';
import { TimelineZoom } from './timeline-view';
import {
  CHARTS_URL,
  ChartPick,
  LegendSelection,
  LineShape,
  attachChartExtras,
  attachPlans,
  chartCard,
  chartColor,
  chartOfLine,
  drawnLegend,
  legendWith,
  pointAtTime,
  pointMark,
  readStoredLabels,
  readStoredLineShape,
  startingLegend,
  storeLabels,
  storeLineShape,
  toggledLegend,
} from './timeline-lines';
import { CURRENCIES, Currency, MAGNITUDES, Magnitude, MoneyView, readStoredMoney, storeMoney } from './timeline-money';
import { GANTT_SERIES_ID, RelatedTenureRow, centeredZoom, paintSelection, relatedTenures } from './timeline-selection';
import { SNAP_RADIUS_PX, SnapSeries, nearestPoint, snapCandidates } from './timeline-snap';
import { hiddenEventsFromUrl, legendFromUrl, lineShapeFromUrl, moneyFromUrl, viewParams, viewQuery } from './timeline-url';
import { BudgetPeriods, CardContent, ChartExtras, ChartPoint, ChartSeries, Election, GanttBar, GanttGroup, TimelineEvent } from './timeline.model';

// `LineChart` hosts the today line and the events: marks on empty series.
echarts.use([CustomChart, LineChart, GridComponent, DataZoomComponent, LegendComponent, TooltipComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, LabelLayout, CanvasRenderer]);

const ROLES_URL = 'data/roles.json';
const BUDGET_PERIODS_URL = 'data/budget-periods.json';
const CHART_EXTRAS_URL = 'data/chart-extras.json';
const ELECTIONS_URL = 'data/elections.json';
const EVENTS_URL = 'data/events.json';
const AXIS_LABEL_HOVER = '#0b5fff';
/* How long a wheel burst may run before the value axes catch up with the view. */
const VALUE_AXES_SETTLE_MS = 120;

/* The row order before the reader rearranges anything, and what the panel's
   reset restores. A row missing from this list goes to the end. */
const DEFAULT_ROW_ORDER: RoleOrder = [
  'Президент',
  'Вицепрезидент',
  'Народно събрание',
  'Министър-председател',
  BUDGET_PERIOD_ROW,
  'Министър на финансите',
  'Председател на комисия по бюджет и финанси',
  'Председател на Народното събрание',
  'Председател на Сметната палата',
  'Председател на КФН',
  'Директор на Българска Банка за Развитие',
];

/* The rows a first visit shows. The rest are in the panel, switched off. */
const DEFAULT_SELECTED_ROWS: readonly string[] = DEFAULT_ROW_ORDER.slice(0, 7);

@Component({
  selector: 'app-timeline-chart',
  imports: [NgxEchartsDirective, RolesPanel, DetailCard, EventsMenu, LegendSearch, LinesLegend, SettingsDialog],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-chart.html',
  styleUrl: './timeline-chart.css',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class TimelineChart {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navSlot = inject(NavSlot);
  private readonly location = inject(Location);
  /* The address as the page was opened: what a shared link asks for wins over what this browser has stored. */
  private readonly openedWith = viewParams(this.location.path());
  private readonly toolbar = viewChild.required('toolbar', { read: TemplateRef });

  private readonly groups = signal<readonly GanttGroup[] | null>(null);
  protected readonly charts = signal<readonly ChartSeries[]>([]);
  /* Which series the reader has on. The HTML legend reads it; the chart draws it
     narrowed to the search's picks (`drawnLegend`), and its legend component is
     never drawn. */
  protected readonly legendSelection = signal<LegendSelection>({});
  protected readonly legendColumnPx = computed(() => legendColumnWidth(this.charts()));
  /* Measured text, so worked out once per set of series and units, not on every zoom. */
  private readonly axisLayout = computed(() => valueAxisLayout(this.charts(), this.money()));
  protected readonly legendPicks = signal<ReadonlySet<string>>(new Set());
  private readonly legendListed = computed(() => this.charts().filter((chart) => isListed(this.legendPicks(), chart.id)));
  private readonly events = signal<readonly TimelineEvent[]>([]);
  private readonly hiddenEvents = signal(readStoredHiddenEvents());
  protected readonly eventToggles = computed(() =>
    inMenuOrder(this.events()).map(({ id, items, meta }) => ({
      id,
      label: items[0].name,
      color: meta.style.itemStyle.color,
      shown: !this.hiddenEvents().has(id),
    }))
  );
  private readonly names = computed(() => (this.groups() ?? []).map((group) => group.name));
  protected readonly error = signal<string | null>(null);

  protected readonly order = signal<RoleOrder>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly panelOpen = signal(false);
  protected readonly focusedRole = signal<string | null>(null);

  /* The bar picked on the chart, and whether its card is showing: the card's ✕
     shuts the card and leaves the bar lit. */
  protected readonly selectedBar = signal<GanttBar | null>(null);
  /* A clicked event or line shares the card with the bars, one at a time. */
  protected readonly selectedEntry = signal<CardContent | null>(null);
  protected readonly selectedPick = signal<ChartPick | null>(null);
  protected readonly card = computed<CardContent | null>(() => {
    const pick = this.selectedPick();
    return pick ? chartCard(pick.chart, pick.point, this.money()) : (this.selectedEntry() ?? this.selectedBar()?.content ?? null);
  });
  protected readonly cardOpen = signal(false);
  protected readonly related = signal<readonly RelatedTenureRow[]>([]);

  protected readonly currencies = CURRENCIES;
  protected readonly magnitudes = MAGNITUDES;
  protected readonly money = signal<MoneyView>(moneyFromUrl(this.openedWith, readStoredMoney()));
  protected readonly labels = signal(readStoredLabels());
  protected readonly lineShape = signal<LineShape>(lineShapeFromUrl(this.openedWith, readStoredLineShape()));

  protected readonly narrow = signal(typeof window !== 'undefined' && window.innerWidth < NARROW_WIDTH_PX);

  private readonly orderedGroups = computed(() => applyOrder(this.groups() ?? [], this.order()));
  private readonly visibleGroups = computed(() => this.orderedGroups().filter((group) => this.selected().has(group.name)));

  protected readonly rows = computed<readonly RoleRow[]>(() =>
    this.orderedGroups().map((group) => ({ name: group.name, description: group.description ?? group.name }))
  );
  protected readonly isDefaultOrder = computed(() => ordersEqual(this.order(), this.defaultOrder()));
  private readonly defaultOrder = computed(() => reconcileOrder(this.names(), DEFAULT_ROW_ORDER));

  protected readonly initOpts = { renderer: 'canvas' as const };

  /* The `[options]` binding creates the chart, so it gets the config only until
     the instance exists. After that the instance is updated directly: publishing
     through the binding would drop the reader's zoom. */
  protected readonly initialOption = signal<TimelineOption | null>(null);
  private chart: echarts.EChartsType | null = null;
  private hoveredLabel: { el: any; fill: string } | null = null;
  /* The bars as last built, with their selection painted in. A selection updates
     these alone; only a change of rows or layout rebuilds the chart. */
  private bars: GanttBar[] = [];
  private axis = { min: 0, max: 1 };
  /* What the value axes depend on from the chart itself, kept here because reading
     it back with `getOption` costs too much on every wheel tick. */
  private zoomShown: TimelineZoom | undefined;
  private legendShown: LegendSelection | undefined;
  private rangesDrawn = '';
  /* The points the pointer can take, with each series' index in the option. */
  private snapSeries: readonly SnapSeries[] = [];
  private axesTimer: ReturnType<typeof setTimeout> | null = null;
  /* The series carrying the point mark, which the next pick has to clear. */
  private markedChart: ChartSeries | null = null;
  /* The card id of the event drawn as selected, which the next pick has to clear. */
  private litEvent: string | null = null;

  constructor() {
    effect((onCleanup) => {
      this.navSlot.content.set(this.toolbar());
      onCleanup(() => this.navSlot.content.set(null));
    });

    forkJoin({
      roles: this.http.get<GanttGroup[]>(ROLES_URL),
      periods: this.http.get<BudgetPeriods>(BUDGET_PERIODS_URL),
      charts: this.http.get<ChartSeries[]>(CHARTS_URL),
      chartExtras: this.http.get<ChartExtras[]>(CHART_EXTRAS_URL),
      elections: this.http.get<Election[]>(ELECTIONS_URL),
      events: this.http.get<TimelineEvent[]>(EVENTS_URL),
    }).subscribe({
      next: ({ roles, periods, charts, chartExtras, elections, events }) => {
        /* Before the budget row joins: its dates are the acts' own and must not
           be nudged by the resolver. */
        adjustImpreciseOverlaps(roles);
        attachElections(roles, elections);
        this.charts.set(attachPlans(attachChartExtras(charts, chartExtras)));
        this.events.set(events);
        this.hiddenEvents.set(hiddenEventsFromUrl(this.openedWith, events, this.hiddenEvents()));
        this.initRows([toBudgetPeriodGroup(periods), ...roles]);
      },
      error: (err) => this.error.set(`Данните не можаха да се заредят (${err?.status ?? 'мрежова грешка'}).`),
    });

    effect(() => {
      const all = this.groups();
      if (!all) return;
      const visible = this.visibleGroups();
      const narrow = this.narrow();
      const money = this.money();
      const labels = this.labels();
      const lineShape = this.lineShape();
      untracked(() => this.rebuild(visible, all, narrow, money, labels, lineShape));
    });

    /* Straight to the address and not through the router: a navigation would scroll
       the page to the top on every switch, and each would be a step of the back button. */
    effect(() => {
      if (!this.groups()) return;
      const query = viewQuery(this.charts(), this.legendSelection(), this.events(), this.hiddenEvents(), this.money(), this.lineShape());
      this.location.replaceState('/', query, this.location.getState());
    });
  }

  private rebuild(
    visible: readonly GanttGroup[],
    all: readonly GanttGroup[],
    narrow: boolean,
    money: MoneyView,
    labels: boolean,
    lineShape: LineShape
  ): void {
    const view = this.currentView();
    const legend = view.legend ?? {};
    this.zoomShown = view.zoom;
    this.legendSelection.set(legend);
    this.legendShown = this.drawn(legend);
    const option = buildTimelineOption(visible, all, this.charts(), this.events(), {
      ...view,
      legend: this.legendShown,
      narrow,
      money,
      labels,
      lineShape,
      hiddenEvents: this.hiddenEvents(),
      pick: this.selectedPick(),
      selectedEvent: this.selectedEntry()?.id ?? null,
    });
    const gantt = option.series.at(-1) as unknown as { data: GanttBar[] };

    /* A change of rows moves every index, so the selection is found again by id.
       A bar whose row was just hidden takes its card with it. */
    const id = this.selectedBar()?.content.id ?? null;
    const kept = id !== null && gantt.data.some((bar) => bar.content.id === id);
    if (id !== null && !kept) this.clearSelectionState();
    this.litEvent = this.selectedEntry()?.id ?? null;
    gantt.data = paintSelection(gantt.data, kept ? id : null);
    this.bars = gantt.data;
    this.axis = { min: +new Date(option.xAxis[0].min), max: +new Date(option.xAxis[0].max) };
    this.rangesDrawn = JSON.stringify(this.valueRanges());
    this.snapSeries = snapCandidates(option.series, this.charts().map((chart) => chart.id));
    if (kept) this.showBar(id);

    if (!this.chart) {
      this.initialOption.set(option);
      return;
    }
    this.hoveredLabel = null; // its text element does not survive notMerge
    this.chart.setOption(option, { notMerge: true });
  }

  private valueRanges(): ValueAxisRanges {
    return valueAxisRanges(this.charts(), this.money(), this.legendShown, timeWindow(this.zoomShown, this.axis), this.lineShape());
  }

  /* The zoom has already rendered the chart by the time this runs, so moving the
     axes here would render it a second time on the same wheel tick. The axes
     follow once per `VALUE_AXES_SETTLE_MS` instead, and after the last tick. */
  protected onDataZoom(event: { start?: number; end?: number; batch?: readonly TimelineZoom[] }): void {
    const { start, end } = event.batch?.[0] ?? event;
    if (start === undefined || end === undefined) return;
    this.zoomShown = { start, end };
    if (this.axesTimer !== null) return;
    this.axesTimer = setTimeout(() => {
      this.axesTimer = null;
      this.alignValueAxes();
    }, VALUE_AXES_SETTLE_MS);
  }

  protected toggleSeries(id: string): void {
    this.applyLegend(toggledLegend(this.legendSelection(), id));
  }

  /* The legend's two switches reach the rows it lists, so the search can pick out
     the series they apply to. */
  protected showAllSeries(): void {
    this.applyLegend(legendWith(this.legendSelection(), this.legendListed(), true));
  }

  protected hideAllSeries(): void {
    this.applyLegend(legendWith(this.legendSelection(), this.legendListed(), false));
  }

  /* A pick narrows the chart as well as the legend: the series it leaves out are
     drawn off until the picks are cleared, their switches untouched. A series
     just picked is switched on, since picking it is asking to see it. A row can
     leave the list from under the pointer, and takes its `mouseleave` with it;
     `applyLegend` clears the highlight it would leave behind. */
  protected pickLegend(picks: ReadonlySet<string>): void {
    const added = this.charts().filter(({ id }) => picks.has(id) && !this.legendPicks().has(id));
    this.legendPicks.set(picks);
    this.applyLegend(legendWith(this.legendSelection(), added, true));
  }

  private drawn(selection: LegendSelection): LegendSelection {
    return drawnLegend(selection, this.charts(), this.legendPicks());
  }

  /* The HTML legend owns which series are on, and sets the chart's legend
     component to match in one update, with the value axes the switch moves: a
     legend action per series would be a full render each, and the axes another. */
  private applyLegend(next: LegendSelection): void {
    /* A row is under the pointer, so its series is lit. Cleared first: a series
       switched off while lit would leave the others faded for it, and come back
       lit when switched on again. */
    this.chart?.dispatchAction({ type: 'downplay' });
    this.legendSelection.set(next);
    this.legendShown = this.drawn(next);
    const yAxis = this.valueAxisUpdate();
    this.chart?.setOption({ legend: { selected: this.legendShown }, ...(yAxis ? { yAxis } : {}) });
  }

  /* A row under the pointer lights its line as hovering the line itself would:
     the series' emphasis fades the others. */
  protected hoverSeries(id: string | null): void {
    if (id) this.chart?.dispatchAction({ type: 'highlight', seriesName: id });
    else this.chart?.dispatchAction({ type: 'downplay' });
  }

  /* Most zoom steps leave the ranges as they were, and an update of the chart is a
     full render, so it is sent only when one has moved. */
  private alignValueAxes(): void {
    const yAxis = this.valueAxisUpdate();
    if (yAxis) this.chart?.setOption({ yAxis });
  }

  /** The value axes as the view now needs them, or `null` while they stand as drawn. */
  private valueAxisUpdate(): object[] | null {
    const ranges = this.valueRanges();
    const drawn = JSON.stringify(ranges);
    if (drawn === this.rangesDrawn) return null;
    this.rangesDrawn = drawn;
    const { percent, money, coefficient, inflation, monthly } = valueAxisPatches(ranges, this.axisLayout());
    return [{}, percent, money, coefficient, inflation, monthly];
  }

  private initRows(groups: readonly GanttGroup[]): void {
    const ordered = applyOrder(groups, reconcileOrder(groups.map((group) => group.name), DEFAULT_ROW_ORDER));
    const names = ordered.map((group) => group.name);
    const selected = restoreSelection(names, readStoredSelection(), DEFAULT_SELECTED_ROWS);

    this.order.set(reconcileOrder(names, readStoredOrder()));
    this.selected.set(selected);
    this.groups.set(ordered);
    /* With nothing selected the row labels are gone, so the panel has to be
       showing for the rows to stay reachable. */
    this.panelOpen.set(selected.size === 0 || readStoredPanelOpen());
  }

  /* A rebuild replaces the whole option, so what the reader set on the chart
     itself has to be read back and carried over: the zoom. The legend is the
     reader's own as this component holds it, since the chart's is narrowed to
     the search's picks. */
  private currentView(): TimelineView {
    const option = this.chart?.getOption() as { dataZoom?: TimelineZoom[] } | undefined;
    const zoom = option?.dataZoom?.[0];
    return { zoom: zoom ? { start: zoom.start, end: zoom.end } : undefined, legend: this.chart ? this.legendSelection() : legendFromUrl(this.openedWith, this.charts(), startingLegend(this.charts())) };
  }

  protected onChartInit(chart: echarts.EChartsType): void {
    this.chart = chart;
    const isRowLabel = (params: any) => params?.componentType === 'yAxis' && params.targetType === 'axisLabel';

    chart.on('mouseover', (params: any) => {
      if (isRowLabel(params)) this.setLabelHover(params.event?.target);
    });
    chart.on('mouseout', (params: any) => {
      if (isRowLabel(params)) this.clearLabelHover();
    });
    chart.getZr().on('globalout', () => this.clearLabelHover());
    /* ECharts adds its own move handler on its first render, after this one, and
       it would put the pointer back under the cursor; a microtask runs once every
       handler of the move is done, so the re-aim at a point within reach stands. */
    chart.getZr().on('mousemove', ({ offsetX, offsetY }: { offsetX: number; offsetY: number }) =>
      queueMicrotask(() => this.snapPointer(offsetX, offsetY))
    );
    /* A click on nothing at all is how a reader lets go of the selection. */
    chart.getZr().on('click', (event: any) => {
      if (!event.target && this.card()) this.clearSelection();
    });

    /* The side panels push the page, so the chart's own width decides the layout
       rather than the window's. */
    const observer = new ResizeObserver(([entry]) => this.narrow.set(entry.contentRect.width < NARROW_WIDTH_PX));
    observer.observe(chart.getDom());
    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      if (this.axesTimer !== null) clearTimeout(this.axesTimer);
    });
  }

  /* Axis labels have no emphasis state in ECharts, so hover recolours the zrender
     text element itself. */
  private setLabelHover(el: any): void {
    if (!el?.setStyle || this.hoveredLabel?.el === el) return;
    this.clearLabelHover();
    this.hoveredLabel = { el, fill: el.style?.fill };
    el.setStyle({ fill: AXIS_LABEL_HOVER });
  }

  private clearLabelHover(): void {
    const hovered = this.hoveredLabel;
    if (!hovered) return;
    this.hoveredLabel = null;
    if (hovered.el.__zr) hovered.el.setStyle({ fill: hovered.fill });
  }

  protected onChartClick(event: any): void {
    /* A click on a row label opens the panel at that row. */
    if (event.componentType === 'yAxis' && event.targetType === 'axisLabel' && typeof event.value === 'string') {
      this.setPanelOpen(true);
      this.focusedRole.set(event.value.replace('\0', ''));
      return;
    }

    if ((event.componentType === 'markArea' || event.componentType === 'markLine') && event.data?.content) {
      this.toggleEntry(event.data.content);
      return;
    }

    /* A line, one of its points, or a level it draws across the grid. */
    const chart = chartOfLine(this.charts(), event.seriesName, event.seriesId);
    if (chart) {
      this.togglePick({ chart, point: this.clickedPoint(chart, event) });
      return;
    }

    if (event.seriesId !== GANTT_SERIES_ID || !event.data?.content) return;
    const id: string = event.data.content.id;
    /* A second click on the open bar lets it go; on a bar whose card was closed,
       it brings the card back. */
    if (this.selectedBar()?.content.id === id && this.cardOpen()) this.clearSelection();
    else this.selectBar(id);
  }

  /* Over the lines only: the bars keep a free pointer, and follow through the link. */
  private snapPointer(x: number, y: number): void {
    const chart = this.chart;
    if (!chart || !chart.containPixel({ gridIndex: 1 }, [x, y])) return;
    const timeAt = (px: number) => chart.convertFromPixel({ xAxisIndex: 1 }, px) as unknown as number;
    const found = nearestPoint(
      this.snapSeries,
      (id) => this.legendShown?.[id] !== false,
      [x, y],
      [timeAt(x - SNAP_RADIUS_PX), timeAt(x + SNAP_RADIUS_PX)],
      (seriesIndex, value) => chart.convertToPixel({ seriesIndex }, value as [string, number]) as unknown as [number, number]
    );
    if (!found) return;
    /* A pointer update ends by hiding the tooltip, as this axis raises none of its
       own. ECharts' own move handler lets the tooltip of the point under the cursor
       cancel that hide through this very hook; here it comes after that point's
       tooltip has shown, so the hide is dropped instead. */
    const dispatchAction = (payload: { type: string }) => {
      if (payload.type !== 'hideTip') chart.dispatchAction(payload);
    };
    chart.dispatchAction({ type: 'updateAxisPointer', seriesIndex: found.seriesIndex, dataIndex: found.dataIndex, dispatchAction });
  }

  /* A point reports its item, whose date finds it: an index would count a line's
     drawn opening. The line reports only that it was hit, so the click's place
     stands in. A level has no point to report. */
  private clickedPoint(chart: ChartSeries, event: any): ChartPoint | null {
    if (event.componentType !== 'series') return null;
    if (event.dataIndex !== undefined) return chart.data.find(({ date }) => date === event.data.content.date) ?? null;
    const pixel = [event.event.offsetX, event.event.offsetY];
    const [time] = this.chart?.convertFromPixel({ seriesId: chart.id }, pixel) as unknown as [number, number];
    return pointAtTime(chart, time, this.lineShape());
  }

  protected toggleLabels(): void {
    this.labels.update((shown) => !shown);
    storeLabels(this.labels());
  }

  protected setLineShape(shape: LineShape): void {
    if (shape === this.lineShape()) return;
    this.lineShape.set(shape);
    storeLineShape(shape);
  }

  protected setCurrency(currency: Currency): void {
    this.setMoney({ ...this.money(), currency });
  }

  protected setMagnitude(magnitude: Magnitude): void {
    this.setMoney({ ...this.money(), magnitude });
  }

  private setMoney(next: MoneyView): void {
    const { currency, magnitude } = this.money();
    if (next.currency === currency && next.magnitude === magnitude) return;
    this.money.set(next);
    storeMoney(next);
  }

  /* The legend switches a series by name, so this needs no rebuild and the zoom
     stays where the reader left it. */
  protected toggleEventBand(id: string): void {
    const hidden = new Set(this.hiddenEvents());
    const shown = hidden.delete(id);
    if (!shown) hidden.add(id);
    this.hiddenEvents.set(hidden);
    storeHiddenEvents(hidden);
    this.chart?.dispatchAction({ type: shown ? 'legendSelect' : 'legendUnSelect', name: id });
  }

  private toggleEntry(content: CardContent): void {
    const open = this.selectedEntry()?.id === content.id && this.cardOpen();
    this.clearSelectionState();
    if (open) {
      this.paintSelected(null, null);
      return;
    }
    this.selectedEntry.set(content);
    this.cardOpen.set(true);
    this.paintSelected(null, null, content.id);
  }

  private togglePick(pick: ChartPick): void {
    const open = this.card()?.id === chartCard(pick.chart, pick.point).id && this.cardOpen();
    this.clearSelectionState();
    if (open) {
      this.paintSelected(null, null);
      return;
    }
    this.selectedPick.set(pick);
    this.cardOpen.set(true);
    this.paintSelected(null, pick);
  }

  protected selectBar(id: string): void {
    this.selectedEntry.set(null);
    this.selectedPick.set(null);
    this.paintSelected(id, null);
    this.showBar(id);
    this.cardOpen.set(true);
    this.reveal();
  }

  private showBar(id: string): void {
    this.selectedBar.set(this.bars.find((bar) => bar.content.id === id) ?? null);
    this.related.set(relatedTenures(this.bars, id));
  }

  /* One update for the bars, the point mark and the event alike: each `setOption`
     redraws every bar, whatever it touches. */
  private paintSelected(barId: string | null, pick: ChartPick | null, eventId: string | null = null): void {
    this.bars = paintSelection(this.bars, barId);
    const point = pick?.point;
    const marked = point ? pick.chart : null;
    const series: object[] = [{ id: GANTT_SERIES_ID, data: this.bars }];
    /* By id: a plan's line shares its series' name. */
    if (this.markedChart && this.markedChart !== marked) series.push({ id: this.markedChart.id, markPoint: { data: [] } });
    if (marked && point) {
      series.push({ id: marked.id, markPoint: pointMark(marked, point, this.money(), chartColor(this.charts(), marked)) });
    }
    this.markedChart = marked;
    series.push(...eventSelectionUpdate(this.events(), this.litEvent, eventId));
    this.litEvent = eventId;
    this.chart?.setOption({ series });
  }

  /** Brings what the card shows into view; only `always` moves a window that shows it. */
  protected reveal(always = false): void {
    const { from, to } = this.card() ?? {};
    const zoom = this.currentView().zoom;
    if (from === undefined || to === undefined || !zoom) return;
    const next = centeredZoom({ from, to }, zoom, this.axis, always);
    if (next) this.chart?.dispatchAction({ type: 'dataZoom', start: next.start, end: next.end });
  }

  private clearSelectionState(): void {
    this.selectedBar.set(null);
    this.selectedEntry.set(null);
    this.selectedPick.set(null);
    this.related.set([]);
    this.cardOpen.set(false);
  }

  private clearSelection(): void {
    this.clearSelectionState();
    this.paintSelected(null, null);
  }

  protected closeCard(): void {
    this.cardOpen.set(false);
  }

  /* One Escape, one dismissal: the card first, then the rows menu. */
  protected onEscape(): void {
    if (this.cardOpen()) this.closeCard();
    else this.closePanel();
  }

  private setPanelOpen(open: boolean): void {
    this.panelOpen.set(open);
    storePanelOpen(open);
  }

  protected closePanel(): void {
    if (!this.selected().size) return;
    this.setPanelOpen(false);
    this.focusedRole.set(null);
  }

  protected toggleRole(name: string): void {
    const next = new Set(this.selected());
    if (!next.delete(name)) next.add(name);
    this.setSelected(next);
  }

  protected selectAll(): void {
    this.setSelected(new Set(this.names()));
  }

  protected clearAll(): void {
    this.setSelected(new Set());
  }

  private setSelected(next: ReadonlySet<string>): void {
    this.selected.set(next);
    storeSelection(next);
  }

  protected moveRow({ from, to }: RoleMove): void {
    const next = moveRole(this.order(), from, to);
    if (next === this.order()) return;
    this.order.set(next);
    storeOrder(next);
  }

  /** Restores the order only; the selection belongs to the two actions beside it. */
  protected resetOrder(): void {
    this.order.set(this.defaultOrder());
    clearStoredOrder();
  }
}
