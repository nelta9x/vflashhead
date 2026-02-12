import Phaser from 'phaser';
import type { ServicePlugin } from '../../types/SystemPlugin';
import type { ServiceEntry } from '../../ServiceRegistry';
import { DEPTHS } from '../../../data/constants';
import { ComboSystem } from '../../../systems/ComboSystem';
import { UpgradeSystem } from '../../../systems/UpgradeSystem';
import { HealthSystem } from '../../../systems/HealthSystem';
import { MonsterSystem } from '../../../systems/MonsterSystem';
import { StatusEffectManager } from '../../../systems/StatusEffectManager';
import { ParticleManager } from '../../../effects/ParticleManager';
import { ScreenShake } from '../../../effects/ScreenShake';
import { DamageText } from '../../../ui/DamageText';
import { CursorTrail } from '../../../effects/CursorTrail';
import { SoundSystem } from '../../../systems/SoundSystem';
import { FeedbackSystem } from '../../../systems/FeedbackSystem';
import { GaugeSystem } from '../../../systems/GaugeSystem';
import { CursorRenderer } from '../../../effects/CursorRenderer';

export class CoreServicesPlugin implements ServicePlugin {
  readonly id = 'core:services';
  readonly services: ServiceEntry[] = [
    // auto-inject (no deps)
    ComboSystem,
    UpgradeSystem,
    HealthSystem,
    MonsterSystem,
    StatusEffectManager,

    // auto-inject (inject = [Phaser.Scene])
    ParticleManager,
    ScreenShake,
    DamageText,
    CursorTrail,

    // custom factory (singleton)
    {
      key: SoundSystem,
      factory: (r) => {
        const s = SoundSystem.getInstance();
        s.setScene(r.get(Phaser.Scene));
        return s;
      },
    },

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
  ];
}
