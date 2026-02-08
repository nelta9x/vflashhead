import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPhaser = {
  Scene: class {
    add = {
      text: () => ({
        setOrigin: () => ({ setDepth: () => ({ setVisible: () => ({}) }) }),
        setVisible: () => ({}),
        setText: () => ({}),
      }),
      existing: vi.fn(),
      graphics: () => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        strokePath: vi.fn().mockReturnThis(),
        fillPath: vi.fn().mockReturnThis(),
        setBlendMode: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }),
      tweens: { add: vi.fn() },
      circle: () => ({
        setDepth: () => ({}),
        setPosition: () => ({}),
        setScale: () => ({}),
        destroy: vi.fn(),
        displayWidth: 10,
        x: 0,
        y: 0,
      }),
      arc: () => ({
        setAlpha: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setFillStyle: vi.fn().mockReturnThis(),
      }),
      particles: () => ({ setDepth: () => ({}), setPosition: () => ({}), destroy: vi.fn() }),
    };
    time = { delayedCall: (_delay: number, cb: () => void) => cb(), addEvent: vi.fn(), timeScale: 1 };
    physics = { add: { existing: vi.fn() }, pause: vi.fn(), resume: vi.fn() };
    cameras = { main: { shake: vi.fn(), fadeIn: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } };
    input = {
      setDefaultCursor: vi.fn(),
      keyboard: { on: vi.fn() },
      activePointer: { x: 0, y: 0, worldX: 0, worldY: 0 },
    };
    sound = { add: () => ({ play: vi.fn(), stop: vi.fn() }) };
  },
  GameObjects: {
    Container: class {
      scene: unknown;
      constructor(scene?: unknown) {
        this.scene = scene;
      }
      add = vi.fn();
      setPosition = vi.fn();
      setScale = vi.fn();
      setAlpha = vi.fn();
      setDepth = vi.fn().mockReturnThis();
      setVisible = vi.fn();
      setActive = vi.fn();
      setInteractive = vi.fn();
      removeAllListeners = vi.fn();
      disableInteractive = vi.fn();
    },
    Graphics: class {
      clear = vi.fn().mockReturnThis();
      fillStyle = vi.fn().mockReturnThis();
      fillCircle = vi.fn().mockReturnThis();
      lineStyle = vi.fn().mockReturnThis();
      strokeCircle = vi.fn().mockReturnThis();
      setBlendMode = vi.fn().mockReturnThis();
      setDepth = vi.fn().mockReturnThis();
    },
    Arc: class {
      setVisible = vi.fn();
      setPosition = vi.fn();
    },
  },
  Display: {
    Color: {
      HexStringToColor: () => ({ color: 0xffffff }),
    },
  },
  Math: {
    Between: (min: number, _max: number) => min,
    FloatBetween: (min: number, max: number) => (min + max) / 2,
    DegToRad: (deg: number) => (deg * Math.PI) / 180,
    Clamp: (value: number, min: number, max: number) => Math.max(min, Math.min(max, value)),
    Distance: {
      Between: (x1: number, y1: number, x2: number, y2: number) =>
        Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)),
    },
  },
  BlendModes: {
    ADD: 'ADD',
  },
};

(globalThis as { Phaser?: unknown }).Phaser = mockPhaser;

vi.mock('phaser', () => ({
  default: mockPhaser,
  ...mockPhaser,
}));

vi.mock('../src/utils/EventBus', () => ({
  EventBus: {
    getInstance: () => ({
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      clear: vi.fn(),
    }),
  },
  GameEvents: {
    DISH_DAMAGED: 'dish:damaged',
    MONSTER_HP_CHANGED: 'monster:hp_changed',
    MONSTER_DIED: 'monster:died',
  },
}));

type BossStub = {
  x: number;
  y: number;
  visible: boolean;
  getBossId: () => string;
  unfreeze: () => void;
  freeze: () => void;
  update: (_delta: number) => void;
  spawnAt: (_x: number, _y: number) => void;
  deactivate: () => void;
  destroy: () => void;
};

type GameSceneTestContext = {
  activeLasers: Array<{
    bossId: string;
    isWarning: boolean;
    isFiring: boolean;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    startTime?: number;
  }>;
  bosses: Map<string, BossStub>;
  damageText: { showText: (...args: unknown[]) => void };
  laserRenderer: { clear: (...args: unknown[]) => void };
  feedbackSystem: {
    onBossDamaged: (...args: unknown[]) => void;
    onBossContactDamaged: (...args: unknown[]) => void;
    onCriticalHit: (...args: unknown[]) => void;
    onHpLost: (...args: unknown[]) => void;
  };
  healthSystem: {
    takeDamage: (...args: unknown[]) => void;
    getHp: () => number;
    getMaxHp: () => number;
  };
  monsterSystem: {
    isAlive: (bossId?: string) => boolean;
    takeDamage: (...args: unknown[]) => void;
    getAliveBossIds: () => string[];
    areAllDead: () => boolean;
    publishBossHpSnapshot: (bossId: string) => void;
  };
  upgradeSystem: {
    getMissileLevel: () => number;
    getMissileCount: () => number;
    getMissileDamage: () => number;
    getCriticalChanceBonus: () => number;
    getCursorSizeBonus: () => number;
    getCursorMissileThicknessBonus: () => number;
    getCursorDamageBonus: () => number;
  };
  comboSystem: { getCombo: () => number; increment: (...args: unknown[]) => void };
  soundSystem: {
    playPlayerChargeSound: (...args: unknown[]) => void;
    playBossFireSound: (...args: unknown[]) => void;
    playHitSound: (...args: unknown[]) => void;
    playBossImpactSound: (...args: unknown[]) => void;
  };
  particleManager: {
    createSparkBurst: (...args: unknown[]) => void;
    createHitEffect: (...args: unknown[]) => void;
    createExplosion: (...args: unknown[]) => void;
  };
  dishPool: {
    forEach: (callback: (dish: unknown) => void) => void;
  };
  playerAttackRenderer: {
    createMissile: (...args: unknown[]) => { x: number; y: number; displayWidth: number };
    spawnMissileTrail: (...args: unknown[]) => void;
    destroyProjectile: (...args: unknown[]) => void;
  };
  tweens: {
    add: (config: { onComplete?: () => void; onUpdate?: (...args: unknown[]) => void }) => void;
    killTweensOf: (...args: unknown[]) => void;
    pauseAll: (...args: unknown[]) => void;
    resumeAll: (...args: unknown[]) => void;
  };
  time: { timeScale: number };
  physics: { pause: (...args: unknown[]) => void; resume: (...args: unknown[]) => void };
  waveSystem: {
    getCurrentWave: () => number;
    getCurrentWaveBosses: () => Array<{ id: string; laser: { maxCount: number; minInterval: number; maxInterval: number } }>;
    getCurrentWaveBossSpawnMinDistance: () => number;
  };
  input: { activePointer: { worldX: number; worldY: number } };
  cameras: { main: { shake: (...args: unknown[]) => void } };
  gameTime: number;
  cursorX: number;
  cursorY: number;
  isPaused: boolean;
  isGameOver: boolean;
  isDockPaused: boolean;
  isSimulationPaused: boolean;
  cancelBossChargingLasers: (bossId: string) => void;
  fireSequentialMissile: (
    x: number,
    y: number,
    index: number,
    count: number,
    initialTargetBossId: string
  ) => void;
  destroyDishesAlongMissileSegment: (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    pathRadius: number
  ) => void;
  updateBossOverlapDamage: (cursorRadius: number) => void;
  checkLaserCollisions: (_delta: number) => void;
  onDishDamaged: (data: {
    type: string;
    isCritical: boolean;
    damage: number;
    dish: { getColor: () => number };
  }) => void;
  setDockPaused: (paused: boolean) => void;
  syncBossesForWave: (waveNumber: number) => void;
};

function createBossStub(id: string, x: number, y: number): BossStub {
  return {
    x,
    y,
    visible: true,
    getBossId: () => id,
    unfreeze: vi.fn(),
    freeze: vi.fn(),
    update: vi.fn(),
    spawnAt: vi.fn(),
    deactivate: vi.fn(),
    destroy: vi.fn(),
  };
}

describe('Boss Laser Cancellation Logic', () => {
  let gameScene: GameSceneTestContext;
  const aliveBossIds = new Set<string>(['boss_left', 'boss_right']);

  beforeEach(async () => {
    vi.clearAllMocks();
    aliveBossIds.clear();
    aliveBossIds.add('boss_left');
    aliveBossIds.add('boss_right');

    const { GameScene } = await import('../src/scenes/GameScene');

    gameScene = new GameScene() as unknown as GameSceneTestContext;

    gameScene.activeLasers = [];
    gameScene.bosses = new Map<string, BossStub>([
      ['boss_left', createBossStub('boss_left', 360, 100)],
      ['boss_right', createBossStub('boss_right', 920, 100)],
    ]);
    gameScene.damageText = { showText: vi.fn() };
    gameScene.laserRenderer = { clear: vi.fn() };
    gameScene.feedbackSystem = {
      onBossDamaged: vi.fn(),
      onBossContactDamaged: vi.fn(),
      onCriticalHit: vi.fn(),
      onHpLost: vi.fn(),
    };
    gameScene.healthSystem = {
      takeDamage: vi.fn(),
      getHp: () => 5,
      getMaxHp: () => 5,
    };
    gameScene.monsterSystem = {
      isAlive: (bossId?: string) => {
        if (!bossId) return aliveBossIds.size > 0;
        return aliveBossIds.has(bossId);
      },
      takeDamage: vi.fn(),
      getAliveBossIds: () => Array.from(aliveBossIds),
      areAllDead: () => aliveBossIds.size === 0,
      publishBossHpSnapshot: vi.fn(),
    };
    gameScene.upgradeSystem = {
      getMissileLevel: () => 0,
      getMissileCount: () => 1,
      getMissileDamage: () => 100,
      getCriticalChanceBonus: () => 0,
      getCursorSizeBonus: () => 0,
      getCursorMissileThicknessBonus: () => 0,
      getCursorDamageBonus: () => 0,
    };
    gameScene.comboSystem = {
      getCombo: () => 10,
      increment: vi.fn(),
    };
    gameScene.soundSystem = {
      playPlayerChargeSound: vi.fn(),
      playBossFireSound: vi.fn(),
      playHitSound: vi.fn(),
      playBossImpactSound: vi.fn(),
    };
    gameScene.particleManager = {
      createSparkBurst: vi.fn(),
      createHitEffect: vi.fn(),
      createExplosion: vi.fn(),
    };
    gameScene.dishPool = {
      forEach: vi.fn(),
    };
    gameScene.playerAttackRenderer = {
      createMissile: () => ({ x: 0, y: 0, displayWidth: 10 }),
      spawnMissileTrail: vi.fn(),
      destroyProjectile: vi.fn(),
    };
    gameScene.tweens = {
      add: vi.fn((config) => {
        if (config.onUpdate) config.onUpdate({ progress: 1 }, { progress: 1 });
        if (config.onComplete) config.onComplete();
      }),
      killTweensOf: vi.fn(),
      pauseAll: vi.fn(),
      resumeAll: vi.fn(),
    };
    gameScene.time.timeScale = 1;
    gameScene.physics = { pause: vi.fn(), resume: vi.fn() };
    gameScene.waveSystem = {
      getCurrentWave: () => 10,
      getCurrentWaveBosses: () => [
        { id: 'boss_left', laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 } },
        { id: 'boss_right', laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 } },
      ],
      getCurrentWaveBossSpawnMinDistance: () => 200,
    };
    gameScene.input = { activePointer: { worldX: 0, worldY: 0 } };
    gameScene.cameras = { main: { shake: vi.fn() } };
    gameScene.gameTime = 0;
    gameScene.cursorX = 900;
    gameScene.cursorY = 100;
    gameScene.isPaused = false;
    gameScene.isGameOver = false;
    gameScene.isDockPaused = false;
    gameScene.isSimulationPaused = false;
  });

  it('cancels only warning lasers of the targeted boss', () => {
    gameScene.activeLasers = [
      { bossId: 'boss_left', isWarning: true, isFiring: false },
      { bossId: 'boss_right', isWarning: true, isFiring: false },
      { bossId: 'boss_left', isWarning: false, isFiring: true },
    ];

    gameScene.cancelBossChargingLasers('boss_left');

    expect(gameScene.activeLasers).toEqual([
      { bossId: 'boss_right', isWarning: true, isFiring: false },
      { bossId: 'boss_left', isWarning: false, isFiring: true },
    ]);
  });

  it('unfreezes targeted boss and shows interruption text', () => {
    const leftBoss = gameScene.bosses.get('boss_left')!;
    gameScene.activeLasers = [{ bossId: 'boss_left', isWarning: true, isFiring: false }];

    gameScene.cancelBossChargingLasers('boss_left');

    expect(leftBoss.unfreeze).toHaveBeenCalled();
    expect(gameScene.damageText.showText).toHaveBeenCalledWith(
      360,
      40,
      'INTERRUPTED!',
      expect.any(Number)
    );
  });

  it('retargets missile to nearest alive boss when initial target is dead', () => {
    aliveBossIds.delete('boss_left');
    const takeDamageSpy = vi.spyOn(gameScene.monsterSystem, 'takeDamage');

    gameScene.fireSequentialMissile(100, 100, 0, 1, 'boss_left');

    expect(takeDamageSpy).toHaveBeenCalledWith(
      'boss_right',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('amber critical cancels nearest boss lasers only', () => {
    const cancelSpy = vi.spyOn(gameScene, 'cancelBossChargingLasers');

    gameScene.onDishDamaged({
      type: 'amber',
      isCritical: true,
      damage: 10,
      dish: { getColor: () => 0xffffff },
    });

    expect(cancelSpy).toHaveBeenCalledWith('boss_right');
  });

  it('syncBossesForWave creates two bosses for wave-10 style config', () => {
    gameScene.bosses.clear();
    gameScene.waveSystem = {
      ...gameScene.waveSystem,
      getCurrentWaveBosses: () => [
        {
          id: 'boss_left',
          hpWeight: 1,
          spawnRange: { minX: 320, maxX: 360, minY: 100, maxY: 110 },
          laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
        },
        {
          id: 'boss_right',
          hpWeight: 1,
          spawnRange: { minX: 900, maxX: 940, minY: 100, maxY: 110 },
          laser: { maxCount: 1, minInterval: 3000, maxInterval: 5000 },
        },
      ],
    };

    gameScene.syncBossesForWave(10);

    expect(gameScene.bosses.has('boss_left')).toBe(true);
    expect(gameScene.bosses.has('boss_right')).toBe(true);
  });

  it('syncBossesForWave creates three bosses for wave-12 style config', () => {
    gameScene.bosses.clear();
    gameScene.waveSystem = {
      ...gameScene.waveSystem,
      getCurrentWaveBosses: () => [
        {
          id: 'boss_left',
          hpWeight: 1,
          spawnRange: { minX: 260, maxX: 300, minY: 100, maxY: 110 },
          laser: { maxCount: 1, minInterval: 2500, maxInterval: 4500 },
        },
        {
          id: 'boss_center',
          hpWeight: 1,
          spawnRange: { minX: 620, maxX: 660, minY: 100, maxY: 110 },
          laser: { maxCount: 1, minInterval: 2500, maxInterval: 4500 },
        },
        {
          id: 'boss_right',
          hpWeight: 1,
          spawnRange: { minX: 980, maxX: 1020, minY: 100, maxY: 110 },
          laser: { maxCount: 1, minInterval: 2500, maxInterval: 4500 },
        },
      ],
    };

    gameScene.syncBossesForWave(12);

    expect(gameScene.bosses.has('boss_left')).toBe(true);
    expect(gameScene.bosses.has('boss_center')).toBe(true);
    expect(gameScene.bosses.has('boss_right')).toBe(true);
  });

  it('destroys normal dishes on missile path with forceDestroy(false)', () => {
    const onPathDish = {
      active: true,
      x: 320,
      y: 50,
      getSize: () => 30,
      isDangerous: () => false,
      isFullySpawned: () => true,
      forceDestroy: vi.fn(),
    };
    const offPathDish = {
      active: true,
      x: 320,
      y: 150,
      getSize: () => 30,
      isDangerous: () => false,
      isFullySpawned: () => true,
      forceDestroy: vi.fn(),
    };

    gameScene.dishPool = {
      forEach: (callback) => {
        callback(onPathDish);
        callback(offPathDish);
      },
    };

    gameScene.destroyDishesAlongMissileSegment(0, 0, 640, 100, 10);

    expect(onPathDish.forceDestroy).toHaveBeenCalledWith(false);
    expect(offPathDish.forceDestroy).not.toHaveBeenCalled();
  });

  it('destroys spawned bombs on missile path with forceDestroy(true)', () => {
    const spawnedBomb = {
      active: true,
      x: 320,
      y: 50,
      getSize: () => 40,
      isDangerous: () => true,
      isFullySpawned: () => true,
      forceDestroy: vi.fn(),
    };

    gameScene.dishPool = {
      forEach: (callback) => {
        callback(spawnedBomb);
      },
    };

    gameScene.destroyDishesAlongMissileSegment(0, 0, 640, 100, 10);

    expect(spawnedBomb.forceDestroy).toHaveBeenCalledWith(true);
  });

  it('applies immediate boss damage when cursor overlaps boss', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    const takeDamageSpy = vi.spyOn(gameScene.monsterSystem, 'takeDamage');

    gameScene.updateBossOverlapDamage(30);

    expect(takeDamageSpy).toHaveBeenCalledTimes(1);
    expect(takeDamageSpy).toHaveBeenCalledWith('boss_left', expect.any(Number), 360, 100);
    randomSpy.mockRestore();
  });

  it('does not apply boss damage when cursor is not overlapping', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 0;
    gameScene.cursorY = 0;
    gameScene.gameTime = 1000;
    const takeDamageSpy = vi.spyOn(gameScene.monsterSystem, 'takeDamage');

    gameScene.updateBossOverlapDamage(30);

    expect(takeDamageSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('does not apply additional boss damage before overlap tick interval', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    const takeDamageSpy = vi.spyOn(gameScene.monsterSystem, 'takeDamage');

    gameScene.updateBossOverlapDamage(30);
    gameScene.updateBossOverlapDamage(30);

    expect(takeDamageSpy).toHaveBeenCalledTimes(1);
    randomSpy.mockRestore();
  });

  it('applies immediate damage again when overlap breaks and re-enters', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    const takeDamageSpy = vi.spyOn(gameScene.monsterSystem, 'takeDamage');

    gameScene.updateBossOverlapDamage(30);

    gameScene.cursorX = 0;
    gameScene.cursorY = 0;
    gameScene.gameTime = 1001;
    gameScene.updateBossOverlapDamage(30);

    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1002;
    gameScene.updateBossOverlapDamage(30);

    expect(takeDamageSpy).toHaveBeenCalledTimes(2);
    randomSpy.mockRestore();
  });

  it('does not damage player HP through boss overlap path', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    const hpDamageSpy = vi.spyOn(gameScene.healthSystem, 'takeDamage');

    gameScene.updateBossOverlapDamage(30);

    expect(hpDamageSpy).not.toHaveBeenCalled();
    randomSpy.mockRestore();
  });

  it('shows boss overlap damage feedback text when overlap damage is applied', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    gameScene.cursorX = 360;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    const feedbackSpy = vi.spyOn(gameScene.feedbackSystem, 'onBossContactDamaged');

    gameScene.updateBossOverlapDamage(30);

    expect(feedbackSpy).toHaveBeenCalledTimes(1);
    expect(feedbackSpy).toHaveBeenCalledWith(360, 100, expect.any(Number), false);
    randomSpy.mockRestore();
  });

  it('keeps laser collision damage behavior unchanged', () => {
    gameScene.cursorX = 320;
    gameScene.cursorY = 100;
    gameScene.gameTime = 1000;
    gameScene.activeLasers = [
      {
        bossId: 'boss_left',
        isWarning: false,
        isFiring: true,
        x1: 0,
        y1: 100,
        x2: 640,
        y2: 100,
        startTime: 0,
      },
    ];
    const hpDamageSpy = vi.spyOn(gameScene.healthSystem, 'takeDamage');

    gameScene.checkLaserCollisions(16);

    expect(hpDamageSpy).toHaveBeenCalledWith(1);
  });

  it('does not destroy unspawned bombs on missile path', () => {
    const unspawnedBomb = {
      active: true,
      x: 320,
      y: 50,
      getSize: () => 40,
      isDangerous: () => true,
      isFullySpawned: () => false,
      forceDestroy: vi.fn(),
    };

    gameScene.dishPool = {
      forEach: (callback) => {
        callback(unspawnedBomb);
      },
    };

    gameScene.destroyDishesAlongMissileSegment(0, 0, 640, 100, 10);

    expect(unspawnedBomb.forceDestroy).not.toHaveBeenCalled();
  });

  it('pauses scene time/tweens/physics when dock pause is enabled', () => {
    gameScene.setDockPaused(true);

    expect(gameScene.time.timeScale).toBe(0);
    expect(gameScene.tweens.pauseAll).toHaveBeenCalled();
    expect(gameScene.physics.pause).toHaveBeenCalled();
  });

  it('resumes scene time/tweens/physics when dock pause is disabled', () => {
    gameScene.setDockPaused(true);
    vi.clearAllMocks();

    gameScene.setDockPaused(false);

    expect(gameScene.time.timeScale).toBe(1);
    expect(gameScene.tweens.resumeAll).toHaveBeenCalled();
    expect(gameScene.physics.resume).toHaveBeenCalled();
  });

  it('clamps cursor position for shared pointer/keyboard path', () => {
    const inputScene = gameScene as unknown as {
      applyCursorPosition: (x: number, y: number) => void;
      cursorX: number;
      cursorY: number;
    };

    inputScene.applyCursorPosition(-200, 9999);

    expect(inputScene.cursorX).toBe(0);
    expect(inputScene.cursorY).toBe(720);
  });

  it('resetMovementInput clears keyboard plugin and movement keys', () => {
    const resetKeysSpy = vi.fn();
    const keyResetSpy = vi.fn();
    const inputScene = gameScene as unknown as {
      resetMovementInput: () => void;
      input: {
        activePointer: { worldX: number; worldY: number };
        keyboard?: { resetKeys?: () => void };
      };
      cursorKeys: {
        left: { reset: () => void };
        right: { reset: () => void };
        up: { reset: () => void };
        down: { reset: () => void };
      };
      wasdKeys: {
        W: { reset: () => void };
        A: { reset: () => void };
        S: { reset: () => void };
        D: { reset: () => void };
      };
    };

    inputScene.input = {
      activePointer: { worldX: 0, worldY: 0 },
      keyboard: { resetKeys: resetKeysSpy },
    };
    inputScene.cursorKeys = {
      left: { reset: keyResetSpy },
      right: { reset: keyResetSpy },
      up: { reset: keyResetSpy },
      down: { reset: keyResetSpy },
    };
    inputScene.wasdKeys = {
      W: { reset: keyResetSpy },
      A: { reset: keyResetSpy },
      S: { reset: keyResetSpy },
      D: { reset: keyResetSpy },
    };

    inputScene.resetMovementInput();

    expect(resetKeysSpy).toHaveBeenCalledTimes(1);
    expect(keyResetSpy).toHaveBeenCalledTimes(8);
  });

  it('shouldUseKeyboardMovement defers keyboard while pointer priority is active', () => {
    const inputScene = gameScene as unknown as {
      shouldUseKeyboardMovement: () => boolean;
      pointerPriorityMs: number;
      lastInputDevice: 'pointer' | 'keyboard';
      lastPointerMoveAt: number;
      time: { now: number; timeScale: number };
      cursorKeys: {
        left: { isDown: boolean };
        right: { isDown: boolean };
        up: { isDown: boolean };
        down: { isDown: boolean };
      };
      wasdKeys: {
        W: { isDown: boolean };
        A: { isDown: boolean };
        S: { isDown: boolean };
        D: { isDown: boolean };
      };
    };

    inputScene.pointerPriorityMs = 120;
    inputScene.lastInputDevice = 'pointer';
    inputScene.lastPointerMoveAt = 1000;
    inputScene.time = { ...inputScene.time, now: 1050 };
    inputScene.cursorKeys = {
      left: { isDown: true },
      right: { isDown: false },
      up: { isDown: false },
      down: { isDown: false },
    };
    inputScene.wasdKeys = {
      W: { isDown: false },
      A: { isDown: false },
      S: { isDown: false },
      D: { isDown: false },
    };

    expect(inputScene.shouldUseKeyboardMovement()).toBe(false);

    inputScene.time.now = 1200;
    expect(inputScene.shouldUseKeyboardMovement()).toBe(true);
  });
});
