import type { EntityId } from './EntityId';

export interface GameContext {
  gameTime: number;
  currentWave: number;
  playerId: EntityId;
}

export function createDefaultGameContext(): GameContext {
  return {
    gameTime: 0,
    currentWave: 0,
    playerId: 0,
  };
}
