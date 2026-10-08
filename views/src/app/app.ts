import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: everything is rendered by the router (see app.routes.ts). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
