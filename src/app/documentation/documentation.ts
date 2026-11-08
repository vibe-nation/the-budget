import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-documentation',
  imports: [RouterLink],
  templateUrl: './documentation.html',
  styleUrl: './documentation.css',
})
export class Documentation {
  protected readonly sections = [
    { id: 'start', label: 'Как се започва' },
    { id: 'eurostat-extract', label: 'eurostat-extract' },
    { id: 'describe-metric', label: 'describe-metric' },
    { id: 'budget-chart', label: 'budget-chart' },
    { id: 'verify-mandates', label: 'verify-mandates' },
  ];
}
