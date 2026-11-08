import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';

export interface EventToggle {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly shown: boolean;
}

/* The toolbar's dropdown of events. It stays open across ticks, so several
   can be switched in one go. `TimelineChart` owns which ones are shown. */
@Component({
  selector: 'app-events-menu',
  templateUrl: './events-menu.html',
  styleUrl: './events-menu.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class EventsMenu {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly toggles = input.required<readonly EventToggle[]>();
  readonly toggled = output<string>();

  protected readonly open = signal(false);
  protected readonly shownCount = computed(() => this.toggles().filter((toggle) => toggle.shown).length);

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected close(): void {
    this.open.set(false);
  }
}
