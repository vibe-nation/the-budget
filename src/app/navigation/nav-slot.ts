import { Injectable, TemplateRef, signal } from '@angular/core';

/* What the page puts in the header's row, after the brand. A template, so the
   controls stay bound to the page that owns their state and only render here. */
@Injectable({ providedIn: 'root' })
export class NavSlot {
  readonly content = signal<TemplateRef<unknown> | null>(null);
}
