import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { JourneyMap, EmotionEmoji, MIN_PHASES, MAX_PHASES } from '../../models/journey-map.model';
import {
  createEmptyJourneyMap,
  createEmptyPhase,
  cloneJourneyMap,
  reorderPhases,
} from '../../models/journey-map.factory';
import { UndoService } from './undo.service';
import { PersistenceService } from './persistence.service';
import { ToastService } from './toast.service';

const AUTO_SAVE_DELAY = 500;

@Injectable({ providedIn: 'root' })
export class JourneyMapStore {
  private undoService = inject(UndoService);
  private persistenceService = inject(PersistenceService);
  private toastService = inject(ToastService);

  private map = signal<JourneyMap>(createEmptyJourneyMap());
  private isLoading = signal(false);
  private isDirty = signal(false);
  private isInitialized = signal(false);

  private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;

  // Readonly signals for consumers
  readonly journeyMap = computed(() => this.map());
  readonly loading = computed(() => this.isLoading());
  readonly dirty = computed(() => this.isDirty());
  readonly phases = computed(() => this.map().phases);
  readonly canAddPhase = computed(() => this.map().phases.length < MAX_PHASES);
  readonly canRemovePhase = computed(() => this.map().phases.length > MIN_PHASES);
  readonly canUndo = computed(() => this.undoService.canUndo());
  readonly canRedo = computed(() => this.undoService.canRedo());

  constructor() {
    // Auto-save effect
    effect(() => {
      const dirty = this.isDirty();
      const initialized = this.isInitialized();

      if (dirty && initialized) {
        this.scheduleAutoSave();
      }
    });
  }

  async init(): Promise<void> {
    this.isLoading.set(true);
    try {
      const savedMap = await this.persistenceService.loadMap();
      if (savedMap) {
        this.map.set(savedMap);
      }
    } catch (error) {
      console.error('Failed to load saved map:', error);
    } finally {
      this.isLoading.set(false);
      this.isInitialized.set(true);
    }
  }

  private scheduleAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(async () => {
      await this.save();
    }, AUTO_SAVE_DELAY);
  }

  private async save(): Promise<void> {
    try {
      await this.persistenceService.saveMap(this.map());
      this.isDirty.set(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  private saveSnapshot(): void {
    this.undoService.pushSnapshot(this.map());
  }

  private updateMap(updater: (map: JourneyMap) => JourneyMap, saveHistory = true): void {
    if (saveHistory) {
      this.saveSnapshot();
    }
    this.map.update((current) => {
      const updated = updater(cloneJourneyMap(current));
      updated.updatedAt = new Date();
      return updated;
    });
    this.isDirty.set(true);
  }

  // Map-level operations
  setMap(map: JourneyMap): void {
    this.undoService.clear();
    this.map.set(cloneJourneyMap(map));
    this.isDirty.set(true);
  }

  setLoading(loading: boolean): void {
    this.isLoading.set(loading);
  }

  markClean(): void {
    this.isDirty.set(false);
  }

  resetToNew(): void {
    this.undoService.clear();
    this.map.set(createEmptyJourneyMap());
    this.isDirty.set(true);
  }

  // Title and metadata
  updateTitle(title: string): void {
    this.updateMap((map) => ({ ...map, title }));
  }

  updateScenario(scenario: string): void {
    this.updateMap((map) => ({ ...map, scenario }));
  }

  updateExpectations(expectations: string): void {
    this.updateMap((map) => ({ ...map, expectations }));
  }

  // Actor operations
  updateActorName(name: string): void {
    this.updateMap((map) => ({
      ...map,
      actor: { ...map.actor, name },
    }));
  }

  updateActorDescription(description: string): void {
    this.updateMap((map) => ({
      ...map,
      actor: { ...map.actor, description },
    }));
  }

  updateActorGoals(goals: string[]): void {
    this.updateMap((map) => ({
      ...map,
      actor: { ...map.actor, goals: [...goals] },
    }));
  }

  addActorGoal(goal: string): void {
    this.updateMap((map) => ({
      ...map,
      actor: { ...map.actor, goals: [...map.actor.goals, goal] },
    }));
  }

  removeActorGoal(index: number): void {
    this.updateMap((map) => ({
      ...map,
      actor: {
        ...map.actor,
        goals: map.actor.goals.filter((_, i) => i !== index),
      },
    }));
  }

  // Phase operations
  addPhase(): void {
    if (!this.canAddPhase()) return;

    this.updateMap((map) => {
      const newPhase = createEmptyPhase(map.phases.length);
      return {
        ...map,
        phases: [...map.phases, newPhase],
      };
    });
  }

  removePhase(phaseId: string): void {
    if (!this.canRemovePhase()) return;

    this.updateMap((map) => ({
      ...map,
      phases: reorderPhases(map.phases.filter((p) => p.id !== phaseId)),
    }));
  }

  updatePhaseName(phaseId: string, name: string): void {
    this.updateMap((map) => ({
      ...map,
      phases: map.phases.map((p) => (p.id === phaseId ? { ...p, name } : p)),
    }));
  }

  updatePhaseActions(phaseId: string, actions: string): void {
    this.updateMap((map) => ({
      ...map,
      phases: map.phases.map((p) => (p.id === phaseId ? { ...p, actions } : p)),
    }));
  }

  updatePhaseMindsets(phaseId: string, mindsets: string): void {
    this.updateMap((map) => ({
      ...map,
      phases: map.phases.map((p) => (p.id === phaseId ? { ...p, mindsets } : p)),
    }));
  }

  updatePhaseEmotion(phaseId: string, emotion: EmotionEmoji | null): void {
    this.updateMap((map) => ({
      ...map,
      phases: map.phases.map((p) => (p.id === phaseId ? { ...p, emotion } : p)),
    }));
  }

  updatePhaseOpportunities(phaseId: string, opportunities: string): void {
    this.updateMap((map) => ({
      ...map,
      phases: map.phases.map((p) => (p.id === phaseId ? { ...p, opportunities } : p)),
    }));
  }

  // Undo/Redo
  undo(): void {
    const restoredMap = this.undoService.undo(this.map());
    if (restoredMap) {
      this.map.set(restoredMap);
      this.isDirty.set(true);
    }
  }

  redo(): void {
    const restoredMap = this.undoService.redo(this.map());
    if (restoredMap) {
      this.map.set(restoredMap);
      this.isDirty.set(true);
    }
  }

  // Get raw map for export
  getMapForExport(): JourneyMap {
    return cloneJourneyMap(this.map());
  }
}
