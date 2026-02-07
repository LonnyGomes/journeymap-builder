import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PwaService } from '../../../core/services/pwa.service';

@Component({
  selector: 'app-pwa-install-prompt',
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './pwa-install-prompt.html',
  styleUrl: './pwa-install-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallPrompt {
  private pwaService = inject(PwaService);

  protected readonly canInstall = this.pwaService.canInstall;
  protected readonly dismissed = signal(false);

  protected async install(): Promise<void> {
    await this.pwaService.install();
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}
