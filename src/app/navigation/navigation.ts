import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NavSlot } from './nav-slot';

@Component({
  selector: 'app-navigation',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation.html',
  styleUrl: './navigation.css',
})
export class Navigation {
  protected readonly slot = inject(NavSlot);
}
