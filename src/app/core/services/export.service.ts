import { Injectable, inject } from '@angular/core';
import { JourneyMap } from '../../models/journey-map.model';
import { ToastService } from './toast.service';

export type PaperSize = 'letter' | 'tabloid';
export type ExportFormat = 'pdf' | 'png';
type Html2CanvasModule = typeof import('html2canvas');

@Injectable({ providedIn: 'root' })
export class ExportService {
  private static readonly PDF_MARGIN_MM = 6;

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
      const [html2canvasModule, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await this.captureCanvas(html2canvasModule, element);

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: paperSize === 'letter' ? 'letter' : 'tabloid',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxWidth = pageWidth - ExportService.PDF_MARGIN_MM * 2;
      const maxHeight = pageHeight - ExportService.PDF_MARGIN_MM * 2;
      const imageRatio = canvas.width / canvas.height;
      const pageRatio = maxWidth / maxHeight;

      const finalWidth = imageRatio > pageRatio ? maxWidth : maxHeight * imageRatio;
      const finalHeight = imageRatio > pageRatio ? maxWidth / imageRatio : maxHeight;
      const xOffset = (pageWidth - finalWidth) / 2;
      const yOffset = (pageHeight - finalHeight) / 2;

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

      const html2canvasModule = await import('html2canvas');
      const canvas = await this.captureCanvas(html2canvasModule, element);

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

  private async captureCanvas(
    html2canvasModule: Html2CanvasModule,
    element: HTMLElement,
  ): Promise<HTMLCanvasElement> {
    const html2canvas = html2canvasModule.default;
    const captureId = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const captureWidth = this.getCaptureWidth(element);

    element.setAttribute('data-export-capture-id', captureId);

    try {
      return await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: captureWidth,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          const clone = clonedDocument.querySelector(
            `[data-export-capture-id="${captureId}"]`,
          ) as HTMLElement | null;

          if (!clone) return;

          clone.classList.add('export-mode');
          clone.style.width = `${captureWidth}px`;
          clone.style.minWidth = `${captureWidth}px`;
          clone.style.maxWidth = 'none';
          clone.style.height = 'auto';
          clone.style.minHeight = '0';
          clone.style.overflow = 'visible';

          const phasesScroll = clone.querySelector('.phases-scroll') as HTMLElement | null;
          if (phasesScroll) {
            phasesScroll.scrollLeft = 0;
            phasesScroll.scrollTop = 0;
          }

          // Inputs are often clipped in html2canvas; render them as static text for export.
          this.replaceInputsWithStaticText(clone, clonedDocument, '.phase-name-input');
          this.replaceInputsWithStaticText(clone, clonedDocument, '.title-input');
        },
      });
    } finally {
      element.removeAttribute('data-export-capture-id');
    }
  }

  private getCaptureWidth(element: HTMLElement): number {
    const viewportWidth = Math.ceil(element.getBoundingClientRect().width || element.clientWidth || 0);
    const rowLabelsWidth = this.getElementWidth(element, '.row-labels');
    const phaseTrackWidths = this.getPhaseTracksWidth(element);
    const addPhaseWidth = this.getElementWidth(element, '.add-phase-column', true);
    const phaseGridWidth =
      rowLabelsWidth > 0 && phaseTrackWidths > 0
        ? rowLabelsWidth + Math.max(phaseTrackWidths - addPhaseWidth, 0)
        : 0;

    return Math.ceil(Math.max(viewportWidth, phaseGridWidth, element.scrollWidth, element.clientWidth, 1));
  }

  private getElementWidth(element: HTMLElement, selector: string, useScrollWidth = false): number {
    const target = element.querySelector(selector) as HTMLElement | null;
    if (!target) return 0;
    return useScrollWidth ? target.scrollWidth : target.offsetWidth;
  }

  private getPhaseTracksWidth(element: HTMLElement): number {
    const phaseTracks = Array.from(element.querySelectorAll('.phase-track')) as HTMLElement[];
    if (phaseTracks.length === 0) return 0;
    return phaseTracks.reduce((sum, track) => sum + track.offsetWidth, 0);
  }

  private replaceInputsWithStaticText(root: HTMLElement, doc: Document, selector: string): void {
    const inputs = Array.from(root.querySelectorAll(selector)) as HTMLInputElement[];
    const view = doc.defaultView;

    for (const input of inputs) {
      const staticNode = doc.createElement('div');
      staticNode.className = `${input.className} export-static-input`;

      const value = (input.value ?? '').trim();
      const fallback = (input.getAttribute('placeholder') ?? '').trim();
      const text = value || fallback;

      staticNode.textContent = text;
      staticNode.setAttribute('data-export-empty', value ? 'false' : 'true');

      const computed = view?.getComputedStyle(input);
      if (computed) {
        staticNode.style.font = computed.font;
        staticNode.style.fontSize = computed.fontSize;
        staticNode.style.fontWeight = computed.fontWeight;
        staticNode.style.letterSpacing = computed.letterSpacing;
        staticNode.style.lineHeight = computed.lineHeight === 'normal' ? '1.35' : computed.lineHeight;
        staticNode.style.color = computed.color;
        staticNode.style.padding = computed.padding;
        staticNode.style.margin = computed.margin;
        staticNode.style.border = computed.border;
        staticNode.style.borderRadius = computed.borderRadius;
        staticNode.style.width = computed.width;
        staticNode.style.minWidth = computed.minWidth;
        staticNode.style.minHeight = computed.height;
        staticNode.style.background = computed.backgroundColor;
        staticNode.style.boxSizing = computed.boxSizing;
        staticNode.style.display = 'flex';
        staticNode.style.alignItems = 'center';
      }

      input.replaceWith(staticNode);
    }
  }
}
