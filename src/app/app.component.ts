import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { inject } from '@angular/core';
import { PushService } from './core/push.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private push = inject(PushService);

  constructor() {
    void this.push.initialize();
  }
}
