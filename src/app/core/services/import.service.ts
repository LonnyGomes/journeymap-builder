import { Injectable, inject } from '@angular/core';
import {
  JourneyMap,
  JourneyPhase,
  EmotionEmoji,
  EMOTION_OPTIONS,
  MIN_PHASES,
  MAX_PHASES,
} from '../../models/journey-map.model';
import { generateId } from '../../models/journey-map.factory';
import { ToastService } from './toast.service';

interface ImportResult {
  success: boolean;
  map?: JourneyMap;
  error?: string;
}

const VALID_EMOTIONS = EMOTION_OPTIONS.map((e) => e.emoji);

@Injectable({ providedIn: 'root' })
export class ImportService {
  private toastService = inject(ToastService);

  async importFromFile(): Promise<ImportResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = async (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve({ success: false, error: 'No file selected' });
          return;
        }

        try {
          const text = await file.text();
          const result = this.parseAndValidate(text);
          if (result.success) {
            this.toastService.success('Journey map imported successfully');
          } else {
            this.toastService.error(result.error || 'Invalid file format');
          }
          resolve(result);
        } catch (error) {
          const errorMessage = 'Failed to read file';
          this.toastService.error(errorMessage);
          resolve({ success: false, error: errorMessage });
        }
      };

      input.click();
    });
  }

  parseAndValidate(jsonString: string): ImportResult {
    try {
      const data = JSON.parse(jsonString);
      const validatedMap = this.validateJourneyMap(data);
      return { success: true, map: validatedMap };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON format';
      return { success: false, error: message };
    }
  }

  private validateJourneyMap(data: unknown): JourneyMap {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    const obj = data as Record<string, unknown>;

    // Validate and extract title
    const title = typeof obj['title'] === 'string' ? obj['title'] : 'Untitled Journey Map';

    // Validate and extract scenario
    const scenario = typeof obj['scenario'] === 'string' ? obj['scenario'] : '';

    // Validate and extract expectations
    const expectations = typeof obj['expectations'] === 'string' ? obj['expectations'] : '';

    // Validate and extract actor
    const actor = this.validateActor(obj['actor']);

    // Validate and extract phases
    const phases = this.validatePhases(obj['phases']);

    // Validate dates or use current
    const now = new Date();
    const createdAt = this.parseDate(obj['createdAt']) || now;
    const updatedAt = now;

    return {
      id: generateId(),
      title,
      createdAt,
      updatedAt,
      actor,
      scenario,
      expectations,
      phases,
    };
  }

  private validateActor(data: unknown): JourneyMap['actor'] {
    if (!data || typeof data !== 'object') {
      return { name: '', description: '', goals: [] };
    }

    const obj = data as Record<string, unknown>;

    return {
      name: typeof obj['name'] === 'string' ? obj['name'] : '',
      description: typeof obj['description'] === 'string' ? obj['description'] : '',
      goals: Array.isArray(obj['goals'])
        ? obj['goals'].filter((g): g is string => typeof g === 'string')
        : [],
    };
  }

  private validatePhases(data: unknown): JourneyPhase[] {
    if (!Array.isArray(data)) {
      throw new Error('Phases must be an array');
    }

    if (data.length < MIN_PHASES) {
      throw new Error(`Journey map must have at least ${MIN_PHASES} phases`);
    }

    if (data.length > MAX_PHASES) {
      throw new Error(`Journey map cannot have more than ${MAX_PHASES} phases`);
    }

    return data.map((phase, index) => this.validatePhase(phase, index));
  }

  private validatePhase(data: unknown, index: number): JourneyPhase {
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid phase at index ${index}`);
    }

    const obj = data as Record<string, unknown>;

    const emotion = obj['emotion'];
    let validEmotion: EmotionEmoji | null = null;
    if (emotion && typeof emotion === 'string' && VALID_EMOTIONS.includes(emotion as EmotionEmoji)) {
      validEmotion = emotion as EmotionEmoji;
    }

    return {
      id: generateId(),
      name: typeof obj['name'] === 'string' ? obj['name'] : `Phase ${index + 1}`,
      order: index,
      actions: typeof obj['actions'] === 'string' ? obj['actions'] : '',
      mindsets: typeof obj['mindsets'] === 'string' ? obj['mindsets'] : '',
      emotion: validEmotion,
      opportunities: typeof obj['opportunities'] === 'string' ? obj['opportunities'] : '',
    };
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
}
