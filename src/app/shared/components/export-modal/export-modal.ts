import { Component, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { PaperSize, ExportFormat } from '../../../core/services/export.service';

export interface ExportOptions {
  format: ExportFormat;
  paperSize: PaperSize;
}

@Component({
  selector: 'app-export-modal',
  templateUrl: './export-modal.html',
  styleUrl: './export-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportModal {
  readonly close = output<void>();
  readonly export = output<ExportOptions>();

  protected readonly selectedFormat = signal<ExportFormat>('pdf');
  protected readonly selectedPaperSize = signal<PaperSize>('letter');

  protected selectFormat(format: ExportFormat): void {
    this.selectedFormat.set(format);
  }

  protected selectPaperSize(size: PaperSize): void {
    this.selectedPaperSize.set(size);
  }

  protected onExport(): void {
    this.export.emit({
      format: this.selectedFormat(),
      paperSize: this.selectedPaperSize(),
    });
  }

  protected onClose(): void {
    this.close.emit();
  }
}
