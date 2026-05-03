import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from "@angular/router";
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {

  constructor(
    private router: Router
  ) {
  }

  ngOnInit(): void {
    this.router.navigateByUrl('/hiscores');
  }
  
}
