import { Injectable, inject } from '@angular/core';
import { JourneyMap, getEmotionLevel } from '../../models/journey-map.model';
import { ToastService } from './toast.service';

export type PaperSize = 'letter' | 'tabloid';
export type ExportFormat = 'pdf' | 'png';
type Html2CanvasModule = typeof import('html2canvas');

@Injectable({ providedIn: 'root' })
export class ExportService {
  private static readonly PDF_MARGIN_MM = 6;
  private static readonly CAPTURE_BLEED_PX = 2;

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

      const canvas = await this.captureCanvas(html2canvasModule, element, map);

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
      const canvas = await this.captureCanvas(html2canvasModule, element, map);

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
    map: JourneyMap,
  ): Promise<HTMLCanvasElement> {
    const html2canvas = html2canvasModule.default;
    const captureId = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    element.setAttribute('data-export-capture-id', captureId);

    // --- Pre-capture: temporarily apply export layout to the ORIGINAL DOM ---
    // html2canvas reads computed styles/dimensions from the original element,
    // so the text must be wrapping correctly BEFORE capture starts.
    const savedStyles = this.applyExportLayoutToOriginal(element, map);

    // Force a synchronous reflow so the browser recalculates layouts
    void element.offsetHeight;

    const captureWidth = this.getCaptureWidth(element, map);
    const captureHeight = this.getCaptureHeight(element);

    // Measure grid dimensions from the DOM after export layout is applied
    const origPhasesWrapper = element.querySelector('.phases-wrapper') as HTMLElement | null;
    const gridHeight = origPhasesWrapper
      ? origPhasesWrapper.scrollHeight || origPhasesWrapper.offsetHeight || origPhasesWrapper.clientHeight
      : 0;

    try {
      return await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: captureWidth,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDocument) => {
          const clone = clonedDocument.querySelector(
            `[data-export-capture-id="${captureId}"]`,
          ) as HTMLElement | null;

          if (!clone) return;

          this.injectExportStyleOverrides(clonedDocument);

          clone.classList.add('export-mode');
          clone.style.width = `${captureWidth}px`;
          clone.style.minWidth = `${captureWidth}px`;
          clone.style.maxWidth = 'none';
          clone.style.height = 'auto';
          clone.style.minHeight = '0';
          clone.style.overflow = 'visible';
          clone.style.boxSizing = 'border-box';
          this.removeExportGradients(clone);
          this.applyExportInlineLayout(clone);

          // Inputs are often clipped in html2canvas; render them as static text for export.
          this.replaceInputsWithStaticText(clone, clonedDocument, '.phase-name-input');
          this.replaceInputsWithStaticText(clone, clonedDocument, '.title-input');
          this.normalizeGoalsForExport(clone, clonedDocument);
          this.normalizePhaseNumberBadges(clone, clonedDocument);
          this.normalizePhaseHeaderInputsForExport(clone);
          this.realignEmotionCurveForExport(clone, map);
          this.addColumnBordersOverlay(clone, clonedDocument, gridHeight);
        },
      });
    } finally {
      // --- Post-capture: restore original DOM styles ---
      this.restoreOriginalStyles(savedStyles);
      element.removeAttribute('data-export-capture-id');
    }
  }

  private applyExportLayoutToOriginal(
    element: HTMLElement,
    map: JourneyMap,
  ): Array<{ el: HTMLElement; attr: string; prev: string }> {
    const saved: Array<{ el: HTMLElement; attr: string; prev: string }> = [];

    const save = (el: HTMLElement | null) => {
      if (el) {
        saved.push({ el, attr: 'style', prev: el.getAttribute('style') ?? '' });
      }
    };

    // Add export-mode class
    element.classList.add('export-mode');
    saved.push({ el: element, attr: 'class', prev: element.className.replace(' export-mode', '') });

    // Make phases-scroll not clip content
    const phasesScroll = element.querySelector('.phases-scroll') as HTMLElement | null;
    if (phasesScroll) {
      save(phasesScroll);
      phasesScroll.style.overflow = 'visible';
    }

    // Make phases-wrapper a grid
    const phasesWrapper = element.querySelector('.phases-wrapper') as HTMLElement | null;
    const phaseTracks = Array.from(element.querySelectorAll('.phase-track')).filter(
      (t) => t.querySelector('.phase-column'),
    ) as HTMLElement[];

    if (phasesWrapper && phaseTracks.length > 0) {
      save(phasesWrapper);
      phasesWrapper.style.display = 'grid';
      phasesWrapper.style.gridTemplateColumns = `repeat(${phaseTracks.length}, minmax(0, 1fr))`;
      phasesWrapper.style.minWidth = '0';
      phasesWrapper.style.width = '100%';
    }

    // Hide add-phase column
    const addPhase = element.querySelector('.add-phase-column') as HTMLElement | null;
    if (addPhase) {
      save(addPhase);
      addPhase.style.display = 'none';
    }

    // Reset min-width on phase columns so they fit in the grid
    const phaseColumns = Array.from(element.querySelectorAll('.phase-column')) as HTMLElement[];
    phaseColumns.forEach((col) => {
      save(col);
      col.style.minWidth = '0';
    });

    return saved;
  }

  private restoreOriginalStyles(saved: Array<{ el: HTMLElement; attr: string; prev: string }>): void {
    for (const { el, attr, prev } of saved) {
      if (attr === 'class') {
        el.className = prev;
      } else if (prev) {
        el.setAttribute(attr, prev);
      } else {
        el.removeAttribute(attr);
      }
    }
  }

  private static readonly MIN_EXPORT_COLUMN_WIDTH = 240;

  private getCaptureWidth(element: HTMLElement, map: JourneyMap): number {
    const viewportWidth = Math.ceil(element.getBoundingClientRect().width || element.clientWidth || 0);
    const rowLabelsWidth = this.getElementWidth(element, '.row-labels');
    const phaseTrackWidths = this.getPhaseTracksWidth(element, map);
    const addPhaseWidth = this.getElementWidth(element, '.add-phase-column', true);
    const phaseGridWidth =
      rowLabelsWidth > 0 && phaseTrackWidths > 0
        ? rowLabelsWidth + Math.max(phaseTrackWidths - addPhaseWidth, 0)
        : 0;

    // Ensure minimum column width so text has room to wrap
    const minPhaseGridWidth = rowLabelsWidth > 0
      ? rowLabelsWidth + map.phases.length * ExportService.MIN_EXPORT_COLUMN_WIDTH
      : 0;

    return (
      Math.ceil(Math.max(viewportWidth, phaseGridWidth, minPhaseGridWidth, element.scrollWidth, element.clientWidth, 1)) +
      ExportService.CAPTURE_BLEED_PX
    );
  }

  private getCaptureHeight(element: HTMLElement): number {
    const viewportHeight = Math.ceil(element.getBoundingClientRect().height || element.clientHeight || 0);
    return (
      Math.ceil(Math.max(viewportHeight, element.scrollHeight, element.clientHeight, 1)) +
      ExportService.CAPTURE_BLEED_PX
    );
  }

  private getElementWidth(element: HTMLElement, selector: string, useScrollWidth = false): number {
    const target = element.querySelector(selector) as HTMLElement | null;
    if (!target) return 0;
    return useScrollWidth ? target.scrollWidth : target.offsetWidth;
  }

  private getPhaseTracksWidth(element: HTMLElement, map: JourneyMap): number {
    const phaseTracks = Array.from(element.querySelectorAll('.phase-track')) as HTMLElement[];
    if (phaseTracks.length === 0) return 0;
    const visiblePhaseCount = Math.min(map.phases.length, phaseTracks.length);
    return phaseTracks
      .slice(0, visiblePhaseCount)
      .reduce((sum, track) => sum + track.offsetWidth, 0);
  }

  private applyExportInlineLayout(root: HTMLElement): void {
    const phaseGrid = root.querySelector('.phase-grid-container') as HTMLElement | null;
    if (phaseGrid) {
      phaseGrid.style.width = '100%';
      phaseGrid.style.overflow = 'visible';
      phaseGrid.style.alignItems = 'stretch';
    }

    const rowLabels = root.querySelector('.row-labels') as HTMLElement | null;
    if (rowLabels) {
      rowLabels.style.position = 'static';
      rowLabels.style.left = 'auto';
    }

    const phasesScroll = root.querySelector('.phases-scroll') as HTMLElement | null;
    if (phasesScroll) {
      phasesScroll.style.overflow = 'visible';
      phasesScroll.style.width = '100%';
      phasesScroll.style.minWidth = '0';
      phasesScroll.style.flex = '1 1 0';
      phasesScroll.scrollLeft = 0;
      phasesScroll.scrollTop = 0;
    }

    const allPhaseTracks = Array.from(root.querySelectorAll('.phase-track')) as HTMLElement[];
    const phaseTracks = allPhaseTracks.filter((track) => track.querySelector('.phase-column'));
    const phasesWrapper = root.querySelector('.phases-wrapper') as HTMLElement | null;

    if (phasesWrapper && phaseTracks.length > 0) {
      const N = phaseTracks.length;
      root.style.setProperty('--export-phase-count', String(N));
      phasesWrapper.style.display = 'grid';
      phasesWrapper.style.width = '100%';
      phasesWrapper.style.minWidth = '0';
      phasesWrapper.style.alignItems = 'stretch';
      phasesWrapper.style.gap = '0';
      phasesWrapper.style.gridTemplateColumns = `repeat(${N}, minmax(0, 1fr))`;
    }

    const addPhaseColumn = root.querySelector('.add-phase-column') as HTMLElement | null;
    if (addPhaseColumn) {
      addPhaseColumn.style.display = 'none';
      addPhaseColumn.style.width = '0';
      addPhaseColumn.style.minWidth = '0';
      addPhaseColumn.style.padding = '0';
      addPhaseColumn.style.margin = '0';
      addPhaseColumn.style.border = 'none';
      addPhaseColumn.style.flex = '0 0 0';
    }

    phaseTracks.forEach((track) => {
      track.style.display = 'flex';
      track.style.flexDirection = 'column';
      track.style.alignItems = 'stretch';
      track.style.width = '100%';
      track.style.minWidth = '0';
      track.style.flex = '1 1 0';
      track.style.boxSizing = 'border-box';
    });

    const phaseHosts = Array.from(root.querySelectorAll('app-phase-column')) as HTMLElement[];
    phaseHosts.forEach((host) => {
      host.style.display = 'block';
      host.style.width = '100%';
      host.style.minWidth = '0';
      host.style.maxWidth = 'none';
      host.style.flex = '1 1 auto';
      host.style.alignSelf = 'stretch';
      host.style.margin = '0';
      host.style.padding = '0';
      host.style.boxSizing = 'border-box';
    });

    const phaseColumns = Array.from(root.querySelectorAll('.phase-column')) as HTMLElement[];
    phaseColumns.forEach((column) => {
      column.style.setProperty('width', '100%', 'important');
      column.style.setProperty('min-width', '0', 'important');
      column.style.setProperty('max-width', 'none', 'important');
      column.style.setProperty('overflow', 'visible', 'important');
      column.style.boxSizing = 'border-box';
      column.style.flex = '1 1 auto';
      column.style.margin = '0';
      column.style.background = '#fff';
    });

    const phaseHeaders = Array.from(root.querySelectorAll('.phase-header')) as HTMLElement[];
    phaseHeaders.forEach((header) => {
      header.style.width = '100%';
      header.style.boxSizing = 'border-box';
      header.style.borderTopColor = '#0f766e';
    });

    const phaseNumbers = Array.from(root.querySelectorAll('.phase-number')) as HTMLElement[];
    phaseNumbers.forEach((badge) => {
      badge.style.backgroundColor = '#0f766e';
    });

    const phaseCells = Array.from(root.querySelectorAll('.phase-cell')) as HTMLElement[];
    phaseCells.forEach((cell) => {
      cell.style.width = '100%';
      cell.style.boxSizing = 'border-box';
      cell.style.overflow = 'visible';
      cell.style.height = 'auto';
    });

    const emotionButtons = Array.from(root.querySelectorAll('.emotion-btn')) as HTMLElement[];
    emotionButtons.forEach((button) => {
      button.style.width = '100%';
      button.style.maxWidth = 'none';
      button.style.boxSizing = 'border-box';
      button.style.border = 'none';
      button.style.background = 'transparent';
      button.style.display = 'flex';
      button.style.flexDirection = 'column';
      button.style.alignItems = 'center';
      button.style.justifyContent = 'center';
    });

    const emotionCurveOverlay = root.querySelector('.emotion-curve-overlay') as HTMLElement | null;
    if (emotionCurveOverlay) {
      emotionCurveOverlay.style.width = '100%';
    }

    const emotionCurves = Array.from(root.querySelectorAll('.emotion-curve-svg')) as SVGElement[];
    emotionCurves.forEach((curve) => {
      curve.style.width = '100%';
    });

    // Ensure display-content text wraps properly.
    // Reset any copied pixel widths so content reflows to the grid column width.
    const displayContents = Array.from(root.querySelectorAll('.display-content')) as HTMLElement[];
    displayContents.forEach((el) => {
      el.style.setProperty('white-space', 'normal', 'important');
      el.style.setProperty('word-break', 'break-word', 'important');
      el.style.setProperty('overflow-wrap', 'break-word', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('width', 'auto', 'important');
      el.style.setProperty('max-width', '100%', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
    });

    // Ensure editable-cell hosts allow content to flow
    const editableCells = Array.from(root.querySelectorAll('app-editable-cell')) as HTMLElement[];
    editableCells.forEach((el) => {
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('max-width', '100%', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.display = 'block';
    });

    // Ensure markdown content and text spans wrap
    const contentTexts = Array.from(root.querySelectorAll('.content-text, .placeholder-text')) as HTMLElement[];
    contentTexts.forEach((el) => {
      el.style.setProperty('white-space', 'normal', 'important');
      el.style.setProperty('word-break', 'break-word', 'important');
      el.style.setProperty('overflow-wrap', 'break-word', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('max-width', '100%', 'important');
      el.style.display = 'block';
    });

    this.hideElements(root, '.add-phase-column');
    this.hideElements(root, '.add-goal-btn');
    this.hideElements(root, '.goal-remove');
    this.hideElements(root, '.remove-btn');
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
        const isPhaseNameInput = input.classList.contains('phase-name-input');
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
        staticNode.style.minHeight = isPhaseNameInput ? '0' : computed.height;
        staticNode.style.flex = computed.flex;
        staticNode.style.flexGrow = computed.flexGrow;
        staticNode.style.flexShrink = computed.flexShrink;
        staticNode.style.flexBasis = computed.flexBasis;
        staticNode.style.background = computed.backgroundColor;
        staticNode.style.boxSizing = computed.boxSizing;
        staticNode.style.display = 'flex';
        staticNode.style.alignItems = 'center';
        if (!isPhaseNameInput) {
          staticNode.style.whiteSpace = 'normal';
          staticNode.style.wordBreak = 'break-word';
          staticNode.style.overflow = 'visible';
          staticNode.style.height = 'auto';
        }
      }

      input.replaceWith(staticNode);
    }
  }

  private normalizePhaseNumberBadges(root: HTMLElement, doc: Document): void {
    const badges = Array.from(root.querySelectorAll('.phase-number')) as HTMLElement[];
    const view = doc.defaultView;

    for (const badge of badges) {
      const value = (badge.textContent ?? '').trim();
      if (!value) continue;

      const computed = view?.getComputedStyle(badge);
      const width = Math.max(parseFloat(computed?.width ?? '0'), badge.clientWidth || 18);
      const height = Math.max(parseFloat(computed?.height ?? '0'), badge.clientHeight || 18);
      const backgroundColor = computed?.backgroundColor || '#2563eb';
      const textColor = computed?.color || '#ffffff';
      const fontSize = computed?.fontSize || '11px';
      const fontWeight = computed?.fontWeight || '600';
      const fontFamily = computed?.fontFamily || 'DM Sans, sans-serif';
      const letterSpacing = computed?.letterSpacing || '0';

      badge.textContent = '';
      badge.style.position = 'relative';
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.padding = '0';
      badge.style.margin = '0';
      badge.style.backgroundColor = backgroundColor;
      badge.style.borderRadius = '50%';
      badge.style.width = `${width}px`;
      badge.style.height = `${height}px`;
      badge.style.lineHeight = '0';
      badge.style.transform = 'none';

      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', `${width}`);
      svg.setAttribute('height', `${height}`);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.style.display = 'block';
      svg.style.width = '100%';
      svg.style.height = '100%';

      const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '50%');
      text.setAttribute('y', '50%');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', textColor);
      text.setAttribute('font-size', fontSize);
      text.setAttribute('font-weight', fontWeight);
      text.setAttribute('font-family', fontFamily);
      text.setAttribute('letter-spacing', letterSpacing);
      text.setAttribute('dy', '0.04em');
      text.textContent = value;

      svg.appendChild(text);
      badge.appendChild(svg);
    }
  }

  private normalizeGoalsForExport(root: HTMLElement, doc: Document): void {
    const lists = Array.from(root.querySelectorAll('.goals-list')) as HTMLElement[];

    for (const list of lists) {
      const chips = Array.from(list.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('goal-chip'),
      );
      if (chips.length === 0) continue;

      const plainRows = doc.createElement('div');
      plainRows.style.display = 'flex';
      plainRows.style.flexDirection = 'column';
      plainRows.style.gap = '6px';

      for (const chip of chips) {
        const content = chip.querySelector('.content-text, .placeholder-text') as HTMLElement | null;
        const value = (content?.textContent ?? '').trim();
        if (!value) continue;

        const row = doc.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '0';
        row.style.margin = '0';
        row.style.border = 'none';
        row.style.background = 'transparent';
        row.style.minHeight = '0';

        const marker = doc.createElement('span');
        marker.textContent = '•';
        marker.style.color = 'var(--color-primary)';
        marker.style.fontSize = '14px';
        marker.style.lineHeight = '1';
        marker.style.flex = '0 0 auto';

        const text = doc.createElement('span');
        text.textContent = value;
        if (content) {
          const style = doc.defaultView?.getComputedStyle(content);
          if (style) {
            text.style.font = style.font;
            text.style.fontSize = style.fontSize;
            text.style.fontWeight = style.fontWeight;
            text.style.letterSpacing = style.letterSpacing;
            text.style.lineHeight = style.lineHeight === 'normal' ? '1.35' : style.lineHeight;
            text.style.color = style.color;
          }
        }

        row.appendChild(marker);
        row.appendChild(text);
        plainRows.appendChild(row);
      }

      list.innerHTML = '';
      list.appendChild(plainRows);
    }
  }

  private normalizePhaseHeaderInputsForExport(root: HTMLElement): void {
    const phaseHeaders = Array.from(root.querySelectorAll('.phase-header')) as HTMLElement[];

    for (const header of phaseHeaders) {
      header.style.display = 'flex';
      header.style.alignItems = 'center';

      const phaseName = header.querySelector('.phase-name-input.export-static-input') as HTMLElement | null;
      if (phaseName) {
        phaseName.style.flex = '1 1 auto';
        phaseName.style.width = 'auto';
        phaseName.style.minWidth = '0';
        phaseName.style.maxWidth = '100%';
        phaseName.style.margin = '0';
        phaseName.style.display = 'flex';
        phaseName.style.alignItems = 'center';
        phaseName.style.lineHeight = '1.25';
        phaseName.style.whiteSpace = 'nowrap';
        phaseName.style.overflow = 'hidden';
        phaseName.style.textOverflow = 'ellipsis';
        phaseName.style.minHeight = '0';
        phaseName.style.height = 'auto';
      }
    }
  }

  private realignEmotionCurveForExport(root: HTMLElement, map: JourneyMap): void {
    const phasesWrapper = root.querySelector('.phases-wrapper') as HTMLElement | null;
    const tracks = (Array.from(root.querySelectorAll('.phase-track')) as HTMLElement[]).filter((track) =>
      Boolean(track.querySelector('.phase-column')),
    );
    const overlay = root.querySelector('.emotion-curve-overlay') as HTMLElement | null;
    const sourceSvg = root.querySelector('.emotion-curve-svg') as SVGSVGElement | null;

    if (!phasesWrapper || tracks.length === 0 || !overlay) return;

    // Use calculation-based approach instead of getBoundingClientRect()
    // which is unreliable in html2canvas cloned DOMs.
    // The grid uses repeat(N, minmax(0, 1fr)) so columns are equal width.
    let totalWidth = phasesWrapper.offsetWidth || phasesWrapper.clientWidth;
    if (totalWidth <= 0) {
      const rootWidth = root.offsetWidth || root.clientWidth || 0;
      const rowLabels = root.querySelector('.row-labels') as HTMLElement | null;
      const rowLabelsWidth = rowLabels
        ? rowLabels.offsetWidth || rowLabels.clientWidth || 152
        : 152;
      totalWidth = rootWidth - rowLabelsWidth;
    }
    if (totalWidth <= 0) return;

    const phaseCount = tracks.length;
    const columnWidth = totalWidth / phaseCount;

    overlay.style.width = `${totalWidth}px`;
    overlay.style.left = '0';
    overlay.style.right = 'auto';

    const svgHeight = sourceSvg ? this.getViewBoxSize(sourceSvg).height : 100;

    // Calculate phase centers based on equal grid columns
    const phaseCenters = tracks.map((_, index) => {
      return columnWidth * index + columnWidth / 2;
    });

    const svgPaddingTop = 18;
    const svgPaddingBottom = 18;
    const usableHeight = svgHeight - svgPaddingTop - svgPaddingBottom;

    const phasesById = new Map(map.phases.map((phase) => [phase.id, phase]));
    const columnPhases = tracks.map((track, index) => {
      const phaseId = track.getAttribute('data-phase-id');
      if (phaseId && phasesById.has(phaseId)) {
        return phasesById.get(phaseId) ?? null;
      }

      return map.phases[index] ?? null;
    });

    const points: Array<{ x: number; y: number; emoji: string; level: number }> = [];
    columnPhases.forEach((phase, index) => {
      if (!phase) return;
      const level = getEmotionLevel(phase.emotion);
      if (level === null || !phase.emotion || index >= phaseCenters.length) return;

      points.push({
        x: phaseCenters[index],
        y: svgPaddingTop + usableHeight - (level / 9) * usableHeight,
        emoji: phase.emotion,
        level,
      });
    });

    this.renderStaticEmotionCurveForExport(overlay, totalWidth, svgHeight, points);
  }

  private addColumnBordersOverlay(root: HTMLElement, doc: Document, gridHeight: number): void {
    const phasesScroll = root.querySelector('.phases-scroll') as HTMLElement | null;
    const phasesWrapper = root.querySelector('.phases-wrapper') as HTMLElement | null;
    const tracks = (Array.from(root.querySelectorAll('.phase-track')) as HTMLElement[]).filter(
      (track) => Boolean(track.querySelector('.phase-column')),
    );

    if (!phasesScroll || !phasesWrapper || tracks.length < 2) return;

    const totalWidth = phasesWrapper.offsetWidth || phasesWrapper.clientWidth;
    if (totalWidth <= 0) return;

    // Use gridHeight measured from the original DOM (passed from captureCanvas)
    const overlayHeight = gridHeight > 0 ? gridHeight : 800;

    const columnWidth = totalWidth / tracks.length;
    const ns = 'http://www.w3.org/2000/svg';

    // Remove border-right from all phase columns to avoid doubling
    const allColumns = Array.from(root.querySelectorAll('.phase-column')) as HTMLElement[];
    allColumns.forEach((col) => (col.style.borderRight = 'none'));

    // Create an SVG overlay with vertical lines — same approach as
    // the emotion curve which html2canvas renders correctly.
    const overlay = doc.createElement('div');
    overlay.className = 'export-borders-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = `${totalWidth}px`;
    overlay.style.height = `${overlayHeight}px`;
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '8';
    overlay.style.overflow = 'visible';

    const svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('width', `${totalWidth}`);
    svg.setAttribute('height', `${overlayHeight}`);
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${overlayHeight}`);
    svg.style.display = 'block';
    svg.style.width = `${totalWidth}px`;
    svg.style.height = `${overlayHeight}px`;

    for (let i = 1; i < tracks.length; i++) {
      const x = Math.round(columnWidth * i);
      const line = doc.createElementNS(ns, 'line');
      line.setAttribute('x1', `${x}`);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', `${x}`);
      line.setAttribute('y2', `${overlayHeight}`);
      line.setAttribute('stroke', '#d8e2ec');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
    }

    overlay.appendChild(svg);

    // Place overlay inside phases-scroll (same container as emotion curve overlay)
    phasesScroll.style.position = 'relative';
    phasesScroll.appendChild(overlay);
  }

  private getViewBoxSize(svg: SVGSVGElement): { width: number; height: number } {
    const rawViewBox = svg.getAttribute('viewBox') ?? '';
    const parts = rawViewBox
      .trim()
      .split(/\s+/)
      .map((value) => Number(value));

    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
      return { width: parts[2], height: parts[3] };
    }

    const width = Number(svg.getAttribute('width') ?? svg.clientWidth ?? 1);
    const height = Number(svg.getAttribute('height') ?? svg.clientHeight ?? 100);
    return {
      width: Number.isFinite(width) && width > 0 ? width : 1,
      height: Number.isFinite(height) && height > 0 ? height : 100,
    };
  }

  private buildCurvePath(points: Array<{ x: number; y: number }>): string {
    let d = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return d;
  }

  private renderStaticEmotionCurveForExport(
    overlay: HTMLElement,
    width: number,
    height: number,
    points: Array<{ x: number; y: number; emoji: string; level: number }>,
  ): void {
    const doc = overlay.ownerDocument;
    const ns = 'http://www.w3.org/2000/svg';
    const computed = doc.defaultView?.getComputedStyle(overlay);
    const palette = {
      positive: this.resolveCssColor(computed, '--emotion-positive', '#059669'),
      neutral: this.resolveCssColor(computed, '--emotion-neutral', '#c5731c'),
      negative: this.resolveCssColor(computed, '--emotion-negative', '#dc2626'),
      border: this.resolveCssColor(computed, '--color-border', '#d8e2ec'),
      textMuted: this.resolveCssColor(computed, '--color-text-muted', '#627d98'),
    };

    overlay.innerHTML = '';

    const container = doc.createElement('div');
    container.className = 'emotion-curve-container';
    container.style.position = 'relative';
    container.style.width = '100%';
    container.style.height = `${height}px`;
    container.style.minHeight = `${height}px`;
    container.style.background = 'transparent';

    const svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('width', `${width}`);
    svg.setAttribute('height', `${height}`);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'emotion-curve-svg');
    svg.style.display = 'block';
    svg.style.width = '100%';
    svg.style.height = `${height}px`;

    const defs = doc.createElementNS(ns, 'defs');
    const gradientToken = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const lineGradientId = `export-curve-gradient-${gradientToken}`;
    const areaGradientId = `export-area-gradient-${gradientToken}`;

    const lineGradient = doc.createElementNS(ns, 'linearGradient');
    lineGradient.setAttribute('id', lineGradientId);
    lineGradient.setAttribute('x1', '0');
    lineGradient.setAttribute('y1', '0');
    lineGradient.setAttribute('x2', '0');
    lineGradient.setAttribute('y2', '1');
    this.appendGradientStop(doc, lineGradient, '0%', palette.positive, '1');
    this.appendGradientStop(doc, lineGradient, '50%', palette.neutral, '1');
    this.appendGradientStop(doc, lineGradient, '100%', palette.negative, '1');

    const areaGradient = doc.createElementNS(ns, 'linearGradient');
    areaGradient.setAttribute('id', areaGradientId);
    areaGradient.setAttribute('x1', '0');
    areaGradient.setAttribute('y1', '0');
    areaGradient.setAttribute('x2', '0');
    areaGradient.setAttribute('y2', '1');
    this.appendGradientStop(doc, areaGradient, '0%', palette.positive, '0.08');
    this.appendGradientStop(doc, areaGradient, '50%', palette.neutral, '0.05');
    this.appendGradientStop(doc, areaGradient, '100%', palette.negative, '0.08');

    defs.appendChild(lineGradient);
    defs.appendChild(areaGradient);
    svg.appendChild(defs);

    const yLines = [18, 50, 82];
    for (const y of yLines) {
      const line = doc.createElementNS(ns, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', `${y}`);
      line.setAttribute('x2', `${width}`);
      line.setAttribute('y2', `${y}`);
      line.setAttribute('stroke', palette.border);
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('opacity', '0.5');
      svg.appendChild(line);
    }

    if (points.length >= 2) {
      const curvePath = this.buildCurvePath(points);
      const areaPath = `${curvePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

      const area = doc.createElementNS(ns, 'path');
      area.setAttribute('d', areaPath);
      area.setAttribute('fill', `url(#${areaGradientId})`);
      svg.appendChild(area);

      const curve = doc.createElementNS(ns, 'path');
      curve.setAttribute('d', curvePath);
      curve.setAttribute('fill', 'none');
      curve.setAttribute('stroke', `url(#${lineGradientId})`);
      curve.setAttribute('stroke-width', '2.5');
      curve.setAttribute('stroke-linecap', 'round');
      curve.setAttribute('stroke-linejoin', 'round');
      curve.setAttribute('class', 'curve-line');
      svg.appendChild(curve);
    }

    for (const point of points) {
      const color = this.getPointColor(point.level, palette);

      const glow = doc.createElementNS(ns, 'circle');
      glow.setAttribute('cx', `${point.x}`);
      glow.setAttribute('cy', `${point.y}`);
      glow.setAttribute('r', '12');
      glow.setAttribute('fill', color);
      glow.setAttribute('opacity', '0.1');
      glow.setAttribute('class', 'point-glow');
      svg.appendChild(glow);

      const circle = doc.createElementNS(ns, 'circle');
      circle.setAttribute('cx', `${point.x}`);
      circle.setAttribute('cy', `${point.y}`);
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', 'white');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'point-circle');
      circle.style.filter = 'drop-shadow(0 2px 4px rgba(16, 42, 67, 0.16))';
      svg.appendChild(circle);

      const text = doc.createElementNS(ns, 'text');
      text.setAttribute('x', `${point.x}`);
      text.setAttribute('y', `${point.y + 1}`);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('font-size', '10');
      text.setAttribute('class', 'point-emoji');
      text.textContent = point.emoji;
      svg.appendChild(text);
    }

    container.appendChild(svg);

    if (points.length < 2) {
      const emptyState = doc.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.position = 'absolute';
      emptyState.style.inset = '0';
      emptyState.style.display = 'flex';
      emptyState.style.alignItems = 'center';
      emptyState.style.justifyContent = 'center';
      emptyState.style.pointerEvents = 'none';

      const hint = doc.createElement('span');
      hint.className = 'empty-hint';
      hint.textContent = 'Select emotions in at least 2 phases to see the emotional arc';
      hint.style.fontSize = '12px';
      hint.style.color = palette.textMuted;
      hint.style.textAlign = 'center';
      hint.style.padding = '6px 14px';
      hint.style.fontStyle = 'italic';
      hint.style.background = 'rgba(255, 255, 255, 0.72)';
      hint.style.border = `1px dashed ${palette.border}`;
      hint.style.borderRadius = '999px';
      hint.style.lineHeight = '1.35';

      emptyState.appendChild(hint);
      container.appendChild(emptyState);
    }

    overlay.appendChild(container);
  }

  private appendGradientStop(
    doc: Document,
    gradient: SVGLinearGradientElement,
    offset: string,
    color: string,
    opacity: string,
  ): void {
    const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop.setAttribute('offset', offset);
    stop.setAttribute('stop-color', color);
    stop.setAttribute('stop-opacity', opacity);
    gradient.appendChild(stop);
  }

  private getPointColor(
    level: number,
    palette: { positive: string; neutral: string; negative: string },
  ): string {
    if (level >= 7) return palette.positive;
    if (level >= 4) return palette.neutral;
    return palette.negative;
  }

  private resolveCssColor(
    computedStyle: CSSStyleDeclaration | undefined,
    variableName: string,
    fallback: string,
  ): string {
    const value = computedStyle?.getPropertyValue(variableName).trim();
    return value ? value : fallback;
  }

  private injectExportStyleOverrides(doc: Document): void {
    const style = doc.createElement('style');
    style.textContent = `
      .export-mode .display-content,
      .export-mode .content-text,
      .export-mode .markdown-content,
      .export-mode .placeholder-text {
        white-space: normal !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        overflow: visible !important;
        text-overflow: clip !important;
        max-width: 100% !important;
      }
      .export-mode .display-content {
        height: auto !important;
        min-height: 0 !important;
        width: auto !important;
      }
      .export-mode .phase-cell {
        overflow: visible !important;
        height: auto !important;
      }
      .export-mode app-editable-cell {
        overflow: visible !important;
        height: auto !important;
        width: 100% !important;
      }
      .export-mode .phase-column {
        min-width: 0 !important;
        overflow: visible !important;
        background: #fff !important;
      }
      .export-mode .emotion-btn {
        border: none !important;
        background: transparent !important;
      }
      .export-mode .header-section {
        background: #fff !important;
      }
      .export-mode .row-label-icon {
        overflow: visible !important;
      }
    `;
    doc.head.appendChild(style);
  }

  private removeExportGradients(root: HTMLElement): void {
    // Remove header section gradient
    const headerSection = root.querySelector('.header-section') as HTMLElement | null;
    if (headerSection) {
      headerSection.style.background = '#fff';
    }

    // Remove editor-body gradient
    const editorBody = root.querySelector('.editor-body') as HTMLElement | null;
    if (editorBody) {
      editorBody.style.background = '#fff';
    }

    // Remove phase column gradients
    const phaseColumns = Array.from(root.querySelectorAll('.phase-column')) as HTMLElement[];
    phaseColumns.forEach((col) => {
      col.style.background = '#fff';
    });

    // Remove phase header gradients
    const phaseHeaders = Array.from(root.querySelectorAll('.phase-header')) as HTMLElement[];
    phaseHeaders.forEach((header) => {
      header.style.background = 'linear-gradient(180deg, #f7fbfd 0%, #f2f8fb 100%)';
    });

    // Remove row-labels gradient
    const rowLabels = root.querySelector('.row-labels') as HTMLElement | null;
    if (rowLabels) {
      rowLabels.style.background = '#f8fbfd';
    }

    // Remove emotion-arc-spacer gradient
    const arcSpacers = Array.from(root.querySelectorAll('.emotion-arc-spacer')) as HTMLElement[];
    arcSpacers.forEach((spacer) => {
      spacer.style.background = 'transparent';
    });

    // Fix row-label icons overflow
    const rowLabelIcons = Array.from(root.querySelectorAll('.row-label-icon')) as HTMLElement[];
    rowLabelIcons.forEach((icon) => {
      icon.style.overflow = 'visible';
    });
  }

  private hideElements(root: HTMLElement, selector: string): void {
    const elements = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    elements.forEach((element) => {
      element.style.display = 'none';
    });
  }
}
