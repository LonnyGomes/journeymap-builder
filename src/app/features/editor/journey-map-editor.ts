import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  viewChild,
  viewChildren,
  effect,
  OnDestroy,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { JourneyMapStore } from '../../core/services/journey-map.store';
import { ExportService } from '../../core/services/export.service';
import { ImportService } from '../../core/services/import.service';
import { EmotionEmoji, EMOTION_OPTIONS } from '../../models/journey-map.model';
import { Toolbar } from './components/toolbar/toolbar';
import { HeaderSection } from './components/header-section/header-section';
import { PhaseColumn } from './components/phase-column/phase-column';
import { EmotionCurve } from './components/emotion-curve/emotion-curve';
import { ExportModal, ExportOptions } from '../../shared/components/export-modal/export-modal';

const PHASE_COLORS = [
  'var(--phase-color-1)',
  'var(--phase-color-2)',
  'var(--phase-color-3)',
  'var(--phase-color-4)',
  'var(--phase-color-5)',
  'var(--phase-color-6)',
  'var(--phase-color-7)',
  'var(--phase-color-8)',
  'var(--phase-color-9)',
  'var(--phase-color-10)',
];

@Component({
  selector: 'app-journey-map-editor',
  imports: [
    Toolbar,
    HeaderSection,
    PhaseColumn,
    EmotionCurve,
    ExportModal,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './journey-map-editor.html',
  styleUrl: './journey-map-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JourneyMapEditor implements OnDestroy {
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
  private readonly viewportWidth = signal(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  protected readonly phaseColumnWidth = computed(() =>
    this.viewportWidth() <= 640 ? 180 : 220,
  );
  protected readonly phaseCenters = signal<number[]>([]);
  private readonly measuredEmotionCurveWidth = signal<number | null>(null);
  protected readonly emotionCurveWidth = computed(() => {
    const measured = this.measuredEmotionCurveWidth();
    if (measured !== null && measured > 0) return measured;
    return this.phases().length * this.phaseColumnWidth();
  });

  protected readonly rowLabels = [
    { label: 'Actions', icon: 'touch_app' },
    { label: 'Mindsets', icon: 'psychology' },
    { label: 'Emotional Arc', icon: 'mood' },
    { label: 'Emotions', icon: 'sentiment_satisfied' },
    { label: 'Opportunities', icon: 'lightbulb' },
  ];

  protected readonly currentPhaseEmotion = computed(() => {
    const phaseId = this.emotionPickerPhaseId();
    if (!phaseId) return null;
    const phase = this.phases().find((p) => p.id === phaseId);
    return phase?.emotion ?? null;
  });

  private readonly exportAreaRef = viewChild<ElementRef<HTMLElement>>('exportArea');
  private readonly phaseTrackRefs = viewChildren<ElementRef<HTMLElement>>('phaseTrack');
  private readonly phasesWrapperRef = viewChild<ElementRef<HTMLElement>>('phasesWrapper');
  private readonly resizeObserver =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.updateEmotionCurveLayout())
      : null;

  private readonly layoutSyncEffect = effect((onCleanup) => {
    const wrapper = this.phasesWrapperRef()?.nativeElement ?? null;
    const tracks = this.phaseTrackRefs().map((ref) => ref.nativeElement);

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      if (wrapper) this.resizeObserver.observe(wrapper);
      for (const track of tracks) {
        this.resizeObserver.observe(track);
      }
    }

    // Measure after the DOM paint that reflects current signals.
    const frameId = requestAnimationFrame(() => this.updateEmotionCurveLayout());
    onCleanup(() => cancelAnimationFrame(frameId));
  });

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

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

  @HostListener('window:resize')
  handleWindowResize(): void {
    if (typeof window !== 'undefined') {
      this.viewportWidth.set(window.innerWidth);
    }
    this.updateEmotionCurveLayout();
  }

  protected getPhaseColor(index: number): string {
    return PHASE_COLORS[index % PHASE_COLORS.length];
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

  private updateEmotionCurveLayout(): void {
    const tracks = this.phaseTrackRefs().map((ref) => ref.nativeElement);
    const wrapper = this.phasesWrapperRef()?.nativeElement;
    if (!wrapper || tracks.length === 0) {
      this.phaseCenters.set([]);
      this.measuredEmotionCurveWidth.set(null);
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const centers = tracks.map((track) => {
      const rect = track.getBoundingClientRect();
      return rect.left - wrapperRect.left + rect.width / 2;
    });

    const rightEdge = tracks[tracks.length - 1].getBoundingClientRect().right - wrapperRect.left;

    this.phaseCenters.set(centers);
    this.measuredEmotionCurveWidth.set(rightEdge);
  }

}
