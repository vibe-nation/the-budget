import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

export interface RoleRow {
  readonly name: string;
  readonly description: string;
}

/** A row dragged from one position of the list to another. */
export interface RoleMove {
  readonly from: number;
  readonly to: number;
}

/* The left-edge menu: which rows the chart shows, and in what order. It holds no
   state of its own — `TimelineChart` owns the selection and the order.

   Unencapsulated because its rules cannot be scoped to this view: opening it
   pushes `body` aside, and CDK moves the row being dragged out to `body`. */
@Component({
  selector: 'app-roles-panel',
  imports: [CdkDrag, CdkDragHandle, CdkDropList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  templateUrl: './roles-panel.html',
  styleUrl: './roles-panel.css',
})
export class RolesPanel {
  readonly rows = input.required<readonly RoleRow[]>();
  readonly selected = input.required<ReadonlySet<string>>();
  readonly open = input.required<boolean>();
  /** The row whose label was clicked on the chart. */
  readonly focused = input<string | null>(null);
  readonly defaultOrder = input.required<boolean>();

  readonly toggled = output<string>();
  readonly selectedAll = output<void>();
  readonly clearedAll = output<void>();
  readonly orderReset = output<void>();
  readonly moved = output<RoleMove>();
  readonly closed = output<void>();

  protected readonly allSelected = computed(() => this.rows().length > 0 && this.selected().size === this.rows().length);
  protected readonly noneSelected = computed(() => this.selected().size === 0);

  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');

  constructor() {
    afterRenderEffect(() => {
      const name = this.focused();
      if (!name) return;
      this.list()
        .nativeElement.querySelector(`[data-role="${CSS.escape(name)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.moved.emit({ from: event.previousIndex, to: event.currentIndex });
  }
}
