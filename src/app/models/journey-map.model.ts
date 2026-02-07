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

export interface EmotionOption {
  emoji: EmotionEmoji;
  label: string;
  level: number; // 0 = most negative, 9 = most positive (for curve Y positioning)
}

export const EMOTION_OPTIONS: EmotionOption[] = [
  { emoji: '🎉', label: 'Delighted', level: 9 },
  { emoji: '😃', label: 'Excited', level: 8 },
  { emoji: '😊', label: 'Happy', level: 7 },
  { emoji: '😌', label: 'Satisfied', level: 6 },
  { emoji: '🤔', label: 'Thoughtful', level: 5 },
  { emoji: '😐', label: 'Neutral', level: 4 },
  { emoji: '😕', label: 'Confused', level: 3 },
  { emoji: '😰', label: 'Anxious', level: 2 },
  { emoji: '😢', label: 'Sad', level: 1 },
  { emoji: '😤', label: 'Frustrated', level: 0 },
];

export function getEmotionLevel(emoji: EmotionEmoji | null): number | null {
  if (!emoji) return null;
  const option = EMOTION_OPTIONS.find((o) => o.emoji === emoji);
  return option ? option.level : null;
}

export function getEmotionLabel(emoji: EmotionEmoji | null): string {
  if (!emoji) return '';
  const option = EMOTION_OPTIONS.find((o) => o.emoji === emoji);
  return option ? option.label : '';
}

export const MIN_PHASES = 2;
export const MAX_PHASES = 10;
