import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { LineShape } from './timeline-lines';

interface ShapeOption {
  readonly value: LineShape;
  readonly label: string;
}

/* The toolbar's gear and the modal it opens. A native <dialog>: showModal()
   puts it in the top layer over the header and chart, traps focus and closes
   on Escape. `TimelineChart` owns the settings and stores them. */
@Component({
  selector: 'app-settings-dialog',
  templateUrl: './settings-dialog.html',
  styleUrl: './settings-dialog.css',
})
export class SettingsDialog {
  readonly lineShape = input.required<LineShape>();
  readonly lineShapeChange = output<LineShape>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly shapes: readonly ShapeOption[] = [
    { value: 'step', label: 'Стъпала' },
    { value: 'line', label: 'Линия' },
  ];

  protected open(): void {
    this.dialog().nativeElement.showModal();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /* A click on the backdrop lands on the <dialog> itself; one inside its box
     lands on a child. */
  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }
}
