import { PluginRegistry } from '../../PluginRegistry';
import { BasicDishPlugin } from './BasicDish';
import { BombDishPlugin } from './BombDish';
import { StandardBossPlugin } from './StandardBoss';
import { PlayerEntityPlugin } from './PlayerEntity';
import entitiesJson from '../../../../data/entities.json';

export function registerBuiltinEntityTypes(): void {
  const registry = PluginRegistry.getInstance();

  // 플레이어 (싱글톤)
  registry.registerEntityType(new PlayerEntityPlugin());

  // 기본 접시 타입들 (공유 플러그인, JSON 데이터로 차이화)
  const dishTypes = ['basic', 'golden', 'crystal', 'mini', 'amber'];
  for (const typeId of dishTypes) {
    const typeData = entitiesJson.types[typeId as keyof typeof entitiesJson.types];
    if (typeData && 'lifetime' in typeData && typeof typeData.lifetime === 'number') {
      registry.registerEntityType(
        new BasicDishPlugin(typeId, {
          poolSize: typeData.poolSize ?? 50,
          defaultLifetime: typeData.lifetime,
        })
      );
    }
  }

  // 폭탄 접시
  registry.registerEntityType(new BombDishPlugin());

  // 표준 보스
  const bossData = entitiesJson.types.boss_standard;
  const movementConfig = 'movement' in bossData ? bossData.movement : undefined;
  registry.registerEntityType(
    new StandardBossPlugin(
      movementConfig as {
        type: string;
        drift: { xAmplitude: number; xFrequency: number; yAmplitude: number; yFrequency: number };
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
      }
    )
  );
}
