import { Component, inject, output, ChangeDetectionStrategy } from '@angular/core';
import { JourneyMapStore } from '../../../../core/services/journey-map.store';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Toolbar {
  private store = inject(JourneyMapStore);

  readonly exportJson = output<void>();
  readonly importJson = output<void>();
  readonly exportPdf = output<void>();
  readonly exportPng = output<void>();

  protected readonly canUndo = this.store.canUndo;
  protected readonly canRedo = this.store.canRedo;

  protected undo(): void {
    this.store.undo();
  }

  protected redo(): void {
    this.store.redo();
  }

  protected onExportJson(): void {
    this.exportJson.emit();
  }

  protected onImportJson(): void {
    this.importJson.emit();
  }

  protected onExportPdf(): void {
    this.exportPdf.emit();
  }

  protected onExportPng(): void {
    this.exportPng.emit();
  }
}
