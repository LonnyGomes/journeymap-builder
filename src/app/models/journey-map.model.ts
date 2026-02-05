export type EmotionEmoji = '😊' | '😃' | '😐' | '😕' | '😢' | '😤' | '😰' | '🤔' | '😌' | '🎉';

export interface Actor {
  name: string;
  description: string;
  goals: string[];
}

export interface JourneyPhase {
  id: string;
  name: string;
  order: number;
  actions: string;
  mindsets: string;
  emotion: EmotionEmoji | null;
  opportunities: string;
}

export interface JourneyMap {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  actor: Actor;
  scenario: string;
  expectations: string;
  phases: JourneyPhase[];
}

export interface JourneyMapSnapshot {
  map: JourneyMap;
  timestamp: number;
}

export const EMOTION_OPTIONS: { emoji: EmotionEmoji; label: string }[] = [
  { emoji: '🎉', label: 'Delighted' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '😃', label: 'Excited' },
  { emoji: '😌', label: 'Satisfied' },
  { emoji: '🤔', label: 'Thoughtful' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '😕', label: 'Confused' },
  { emoji: '😰', label: 'Anxious' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😤', label: 'Frustrated' },
];

export const MIN_PHASES = 2;
export const MAX_PHASES = 10;
