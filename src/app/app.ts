import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { JourneyMapEditor } from './features/editor/journey-map-editor';
import { ToastComponent } from './shared/components/toast/toast';
import { PwaInstallPrompt } from './shared/components/pwa-install-prompt/pwa-install-prompt';
import { JourneyMapStore } from './core/services/journey-map.store';

@Component({
  selector: 'app-root',
  imports: [JourneyMapEditor, ToastComponent, PwaInstallPrompt],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private store = inject(JourneyMapStore);

  ngOnInit(): void {
    this.store.init();
  }
}
