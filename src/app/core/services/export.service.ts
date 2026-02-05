import { Injectable, inject } from '@angular/core';
import { JourneyMap } from '../../models/journey-map.model';
import { ToastService } from './toast.service';

export type PaperSize = 'letter' | 'tabloid';
export type ExportFormat = 'pdf' | 'png';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private toastService = inject(ToastService);

  exportJson(map: JourneyMap): void {
    try {
      const exportData = {
        ...map,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const filename = `${this.sanitizeFilename(map.title)}_${this.getDateString()}.json`;
      this.downloadFile(url, filename);

      URL.revokeObjectURL(url);
      this.toastService.success('Journey map exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      this.toastService.error('Failed to export journey map');
    }
  }

  async exportPdf(element: HTMLElement, map: JourneyMap, paperSize: PaperSize): Promise<void> {
    try {
      this.toastService.info('Generating PDF...');

      // Dynamic import to reduce bundle size
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Paper dimensions in mm (landscape)
      const dimensions =
        paperSize === 'letter'
          ? { width: 279.4, height: 215.9 } // Letter landscape
          : { width: 431.8, height: 279.4 }; // Tabloid landscape

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: paperSize === 'letter' ? 'letter' : 'tabloid',
      });

      const imgWidth = dimensions.width - 20; // 10mm margins
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Scale to fit on page if needed
      let finalWidth = imgWidth;
      let finalHeight = imgHeight;

      if (imgHeight > dimensions.height - 20) {
        finalHeight = dimensions.height - 20;
        finalWidth = (canvas.width * finalHeight) / canvas.height;
      }

      const xOffset = (dimensions.width - finalWidth) / 2;
      const yOffset = (dimensions.height - finalHeight) / 2;

      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);

      const filename = `${this.sanitizeFilename(map.title)}_${this.getDateString()}.pdf`;
      pdf.save(filename);

      this.toastService.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export failed:', error);
      this.toastService.error('Failed to export PDF');
    }
  }

  async exportPng(element: HTMLElement, map: JourneyMap): Promise<void> {
    try {
      this.toastService.info('Generating PNG...');

      const { default: html2canvas } = await import('html2canvas');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const filename = `${this.sanitizeFilename(map.title)}_${this.getDateString()}.png`;
          this.downloadFile(url, filename);
          URL.revokeObjectURL(url);
          this.toastService.success('PNG exported successfully');
        } else {
          this.toastService.error('Failed to generate PNG');
        }
      }, 'image/png');
    } catch (error) {
      console.error('PNG export failed:', error);
      this.toastService.error('Failed to export PNG');
    }
  }

  private downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
}
