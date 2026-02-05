import { Injectable, signal, computed } from '@angular/core';
import { JourneyMap, JourneyMapSnapshot } from '../../models/journey-map.model';
import { cloneJourneyMap } from '../../models/journey-map.factory';

const MAX_HISTORY_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class UndoService {
  private undoStack = signal<JourneyMapSnapshot[]>([]);
  private redoStack = signal<JourneyMapSnapshot[]>([]);

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);

  pushSnapshot(map: JourneyMap): void {
    const snapshot: JourneyMapSnapshot = {
      map: cloneJourneyMap(map),
      timestamp: Date.now(),
    };

    this.undoStack.update((stack) => {
      const newStack = [...stack, snapshot];
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(-MAX_HISTORY_SIZE);
      }
      return newStack;
    });

    // Clear redo stack when a new action is performed
    this.redoStack.set([]);
  }

  undo(currentMap: JourneyMap): JourneyMap | null {
    const stack = this.undoStack();
    if (stack.length === 0) {
      return null;
    }

    const snapshot = stack[stack.length - 1];

    // Push current state to redo stack
    this.redoStack.update((redo) => [
      ...redo,
      { map: cloneJourneyMap(currentMap), timestamp: Date.now() },
    ]);

    // Remove from undo stack
    this.undoStack.update((undo) => undo.slice(0, -1));

    return cloneJourneyMap(snapshot.map);
  }

  redo(currentMap: JourneyMap): JourneyMap | null {
    const stack = this.redoStack();
    if (stack.length === 0) {
      return null;
    }

    const snapshot = stack[stack.length - 1];

    // Push current state to undo stack
    this.undoStack.update((undo) => [
      ...undo,
      { map: cloneJourneyMap(currentMap), timestamp: Date.now() },
    ]);

    // Remove from redo stack
    this.redoStack.update((redo) => redo.slice(0, -1));

    return cloneJourneyMap(snapshot.map);
  }

  clear(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
  }
}
