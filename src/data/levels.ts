import type { CefrLevel } from '../types'

export interface LevelInfo {
  title: string
  description: string
  color: string
}

export const LEVEL_INFO: Record<CefrLevel, LevelInfo> = {
  A1: { title: 'Beginner', description: 'Family, food, home, everyday verbs', color: '#16a34a' },
  A2: { title: 'Elementary', description: 'Travel, shopping, health, routines', color: '#65a30d' },
  B1: { title: 'Intermediate', description: 'Work, opinions, relationships', color: '#ca8a04' },
  B2: { title: 'Upper intermediate', description: 'Society, economy, argumentation', color: '#ea580c' },
  C1: { title: 'Advanced', description: 'Nuance, abstraction, rhetoric', color: '#dc2626' },
  C2: { title: 'Proficient', description: 'Literary and expressive register', color: '#9333ea' },
}
