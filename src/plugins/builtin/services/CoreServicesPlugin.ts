import Phaser from 'phaser';
import type { ServicePlugin } from '../../types/SystemPlugin';
import type { ServiceEntry } from '../../ServiceRegistry';
import { DEPTHS } from '../../../data/constants';
import { Data } from '../../../data/DataManager';
import { ComboSystem } from '../../../systems/ComboSystem';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { MonsterSystem } from '../../../systems/MonsterSystem';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { ParticleManager } from '../../../effects/ParticleManager';
import { ScreenShake } from '../../../systems/ScreenShake';
import { DamageText } from '../../../ui/DamageText';
import { CursorTrail } from '../entities/CursorTrail';
import { SoundSystem } from '../../../systems/SoundSystem';
import { FeedbackSystem } from '../../../systems/FeedbackSystem';
import { GaugeSystem } from '../../../systems/GaugeSystem';
import { CursorRenderer } from '../entities/CursorRenderer';
import { OrbRenderer } from '../abilities/OrbRenderer';
import { BlackHoleRenderer } from '../abilities/BlackHoleRenderer';

export class CoreServicesPlugin implements ServicePlugin {
  readonly id = 'core:services';
  readonly services: ServiceEntry[] = [
    // auto-inject (no deps)
    ComboSystem,
    UpgradeSystem,
    HealthSystem,
    MonsterSystem,
    StatusEffectManager,

    // custom factory (singleton — needed before ParticleManager)
    {
      key: SoundSystem,
      factory: (r) => {
        const s = SoundSystem.getInstance();
        s.setScene(r.get(Phaser.Scene));
        return s;
      },
    },

    // auto-inject / custom factory (inject = [Phaser.Scene])
    {
      key: ParticleManager,
      factory: (r) => new ParticleManager(r.get(Phaser.Scene), undefined, r.get(SoundSystem)),
    },
    ScreenShake,
    DamageText,
    CursorTrail,

    // auto-inject (complex deps)
    FeedbackSystem,
    GaugeSystem,

    // custom factory (post-init)
    {
      key: CursorRenderer,
      factory: (r) => {
        const cr = new CursorRenderer(r.get(Phaser.Scene));
        cr.setDepth(DEPTHS.cursor);
        return cr;
      },
    },
    {
      key: OrbRenderer,
      factory: (r) => {
        const renderer = new OrbRenderer(r.get(Phaser.Scene));
        renderer.setDepth(DEPTHS.orb);
        return renderer;
      },
    },
    {
      key: BlackHoleRenderer,
      factory: (r) => {
        const renderer = new BlackHoleRenderer(r.get(Phaser.Scene));
        renderer.setDepth(Data.gameConfig.blackHoleVisual.depth);
        return renderer;
      },
    },
  ];
}
