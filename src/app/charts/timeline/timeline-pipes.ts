import { Pipe, PipeTransform } from '@angular/core';

import { humanDate, humanDateDiff, humanRangeEnd } from './timeline-format';

@Pipe({ name: 'humanDate' })
export class HumanDatePipe implements PipeTransform {
  /** `openEnded` marks the end of a range: today prints as „до днес“. */
  transform(value: string | number, openEnded = false): string {
    return openEnded ? humanRangeEnd(value) : humanDate(value);
  }
}

@Pipe({ name: 'dateAgo' })
export class DateAgoPipe implements PipeTransform {
  transform(value: string | number): string {
    return humanDateDiff(value, Date.now());
  }
}
