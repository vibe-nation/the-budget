/* The opening view: the year of the first event, 10 November 1989, whose line
   needs the room to its left for its label. The wheel and drag reach the rest of
   the prime-ministers row, back to 1879. */
export const INITIAL_VIEW_FROM = '1989-01-01';

/** The reader's zoom, as shares of the whole axis. */
export interface TimelineZoom {
  readonly start: number;
  readonly end: number;
}
