import { ServiceToken } from './ServiceRegistry';
import type { CursorSnapshot, BossRadiusSnapshot } from '../scenes/game/GameSceneContracts';

export type DamageBossFn = (
  bossId: string,
  amount: number,
  sourceX: number,
  sourceY: number,
  isCritical: boolean
) => void;

export const GetCursorToken = new ServiceToken<() => CursorSnapshot>('getCursor');
export const GetBossSnapshotsToken = new ServiceToken<() => BossRadiusSnapshot[]>('getBossSnapshots');
export const DamageBossToken = new ServiceToken<DamageBossFn>('damageBoss');
