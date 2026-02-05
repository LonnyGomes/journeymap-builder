import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  viewChild,
} from '@angular/core';
import { JourneyMapStore } from '../../core/services/journey-map.store';
import { ExportService } from '../../core/services/export.service';
import { ImportService } from '../../core/services/import.service';
import { EmotionEmoji, EMOTION_OPTIONS } from '../../models/journey-map.model';
import { Toolbar } from './components/toolbar/toolbar';
import { HeaderSection } from './components/header-section/header-section';
import { PhaseColumn } from './components/phase-column/phase-column';
import { ExportModal, ExportOptions } from '../../shared/components/export-modal/export-modal';

@Component({
  selector: 'app-journey-map-editor',
  imports: [Toolbar, HeaderSection, PhaseColumn, ExportModal],
  templateUrl: './journey-map-editor.html',
  styleUrl: './journey-map-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyMapEditor {
  private store = inject(JourneyMapStore);
  private exportService = inject(ExportService);
  private importService = inject(ImportService);

  protected readonly phases = this.store.phases;
  protected readonly canAddPhase = this.store.canAddPhase;
  protected readonly canRemovePhase = this.store.canRemovePhase;
  protected readonly journeyMap = this.store.journeyMap;

  protected readonly emotionPickerPhaseId = signal<string | null>(null);
  protected readonly showExportModal = signal(false);
  protected readonly emotionOptions = EMOTION_OPTIONS;

  protected readonly rowLabels = ['Actions', 'Mindsets', 'Emotions', 'Opportunities'];

  private readonly exportAreaRef = viewChild<ElementRef<HTMLElement>>('exportArea');

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.store.redo();
      } else {
        this.store.undo();
      }
    }
  }

  protected addPhase(): void {
    this.store.addPhase();
  }

  protected removePhase(phaseId: string): void {
    this.store.removePhase(phaseId);
  }

  protected updatePhaseName(phaseId: string, name: string): void {
    this.store.updatePhaseName(phaseId, name);
  }

  protected updatePhaseActions(phaseId: string, actions: string): void {
    this.store.updatePhaseActions(phaseId, actions);
  }

  protected updatePhaseMindsets(phaseId: string, mindsets: string): void {
    this.store.updatePhaseMindsets(phaseId, mindsets);
  }

  protected updatePhaseOpportunities(phaseId: string, opportunities: string): void {
    this.store.updatePhaseOpportunities(phaseId, opportunities);
  }

  protected showEmotionPicker(phaseId: string): void {
    this.emotionPickerPhaseId.set(phaseId);
  }

  protected selectEmotion(emotion: EmotionEmoji | null): void {
    const phaseId = this.emotionPickerPhaseId();
    if (phaseId) {
      this.store.updatePhaseEmotion(phaseId, emotion);
      this.emotionPickerPhaseId.set(null);
    }
  }

  protected closeEmotionPicker(): void {
    this.emotionPickerPhaseId.set(null);
  }

  protected exportJson(): void {
    this.exportService.exportJson(this.store.getMapForExport());
  }

  protected async importJson(): Promise<void> {
    const result = await this.importService.importFromFile();
    if (result.success && result.map) {
      this.store.setMap(result.map);
    }
  }

  protected openExportModal(): void {
    this.showExportModal.set(true);
  }

  protected closeExportModal(): void {
    this.showExportModal.set(false);
  }

  protected async handleExport(options: ExportOptions): Promise<void> {
    this.showExportModal.set(false);

    const exportArea = this.exportAreaRef()?.nativeElement;
    if (!exportArea) return;

    const map = this.store.getMapForExport();

    if (options.format === 'pdf') {
      await this.exportService.exportPdf(exportArea, map, options.paperSize);
    } else {
      await this.exportService.exportPng(exportArea, map);
    }
  }

  protected exportPdf(): void {
    this.openExportModal();
  }

  protected exportPng(): void {
    const exportArea = this.exportAreaRef()?.nativeElement;
    if (!exportArea) return;
    const map = this.store.getMapForExport();
    this.exportService.exportPng(exportArea, map);
  }
}
