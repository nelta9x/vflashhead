import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock feedback.json
vi.mock('../src/data/feedback.json', () => ({
  default: {
    damageText: {
      normal: {
        color: '#ffffff',
        fontSize: 24,
        initialScale: 1.8,
      },
      critical: {
        color: '#ffcc00',
        fontSize: 32,
        initialScale: 2.2,
      },
      combo: {
        minComboToShow: 2,
        fontSize: 16,
        offsetX: 25,
        offsetY: -5,
        colors: {
          low: '#88ff88',
          mid: '#ffff44',
          high: '#ff8844',
          ultra: '#ff44ff',
        },
        thresholds: {
          mid: 10,
          high: 25,
          ultra: 50,
        },
      },
      style: {
        strokeThickness: 5,
        fontStyle: 'bold',
      },
      randomScale: {
        enabled: true,
        min: 0.85,
        max: 1.15,
      },
      randomRotation: {
        enabled: true,
        min: -8,
        max: 8,
      },
      animation: {
        scalePop: { duration: 60, ease: 'Back.easeOut' },
        shake: { distance: 5, duration: 18, ease: 'Sine.easeInOut', repeat: 2 },
        hold: { duration: 150 },
        shrinkFade: { duration: 250, targetScale: 0.3, ease: 'Power2' },
      },
    },
    comboMilestones: {},
    particles: {},
  },
}));

// Mock other data files
vi.mock('../src/data/game-config.json', () => ({
  default: {
    screen: { width: 1280, height: 720 },
    player: { initialHp: 5, cursorHitbox: { baseRadius: 30 } },
    upgradeUI: {},
    waveTransition: {},
    magnet: {},
  },
}));

vi.mock('../src/data/spawn.json', () => ({ default: {} }));
vi.mock('../src/data/combo.json', () => ({ default: { timeout: {}, milestones: [], multiplier: {} } }));
vi.mock('../src/data/health-pack.json', () => ({ default: {} }));
vi.mock('../src/data/colors.json', () => ({
  default: {
    hex: { white: '#ffffff' },
    numeric: { white: 16777215 },
  },
}));
vi.mock('../src/data/waves.json', () => ({ default: { waves: [] } }));
vi.mock('../src/data/dishes.json', () => ({ default: { dishes: {} } }));
vi.mock('../src/data/upgrades.json', () => ({ default: {} }));
vi.mock('../src/data/weapons.json', () => ({ default: {} }));

// Mock constants
vi.mock('../src/config/constants', () => ({
  COLORS_HEX: {
    WHITE: '#ffffff',
    YELLOW: '#ffff00',
  },
}));

// Mock Phaser
vi.mock('phaser', () => {
  return {
    default: {
      Math: {
        Between: vi.fn(() => 0),
        FloatBetween: vi.fn(() => 1), // randomScale 테스트용 (1.0 = 변화 없음)
        DegToRad: vi.fn((deg: number) => deg * (Math.PI / 180)),
      },
    },
  };
});

// Create mock text object
function createMockText() {
  return {
    x: 0,
    y: 0,
    text: '',
    color: '',
    fontSize: 0,
    visible: false,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    setText: vi.fn(function (this: ReturnType<typeof createMockText>, t: string) {
      this.text = t;
      return this;
    }),
    setPosition: vi.fn(function (this: ReturnType<typeof createMockText>, x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }),
    setColor: vi.fn(function (this: ReturnType<typeof createMockText>, c: string) {
      this.color = c;
      return this;
    }),
    setFontSize: vi.fn(function (this: ReturnType<typeof createMockText>, s: number) {
      this.fontSize = s;
      return this;
    }),
    setVisible: vi.fn(function (this: ReturnType<typeof createMockText>, v: boolean) {
      this.visible = v;
      return this;
    }),
    setAlpha: vi.fn(function (this: ReturnType<typeof createMockText>, a: number) {
      this.alpha = a;
      return this;
    }),
    setScale: vi.fn(function (this: ReturnType<typeof createMockText>, s: number) {
      this.scaleX = s;
      this.scaleY = s;
      return this;
    }),
    setRotation: vi.fn(function (this: ReturnType<typeof createMockText>, r: number) {
      this.rotation = r;
      return this;
    }),
    setOrigin: vi.fn(),
  };
}

// Create mock scene
function createMockScene() {
  const texts: ReturnType<typeof createMockText>[] = [];

  return {
    texts,
    add: {
      text: vi.fn(() => {
        const mockText = createMockText();
        texts.push(mockText);
        return mockText;
      }),
    },
    tweens: {
      add: vi.fn(),
    },
    time: {
      delayedCall: vi.fn(),
    },
  };
}

describe('DamageText', () => {
  let mockScene: ReturnType<typeof createMockScene>;

  beforeEach(() => {
    mockScene = createMockScene();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showDamage', () => {
    it('일반 피해 텍스트가 올바른 색상과 크기로 표시되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 0);

      // 풀에서 가져온 텍스트 확인
      const textObj = mockScene.texts[0];
      expect(textObj.text).toBe('50');
      expect(textObj.color).toBe('#ffffff');
      expect(textObj.fontSize).toBe(24); // 22 → 24
      expect(textObj.scaleX).toBe(1.8); // 1.3 → 1.8
    });

    it('크리티컬 피해 텍스트가 올바른 색상과 크기로 표시되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 100, 'critical', 0);

      const textObj = mockScene.texts[0];
      expect(textObj.text).toBe('100');
      expect(textObj.color).toBe('#ffcc00');
      expect(textObj.fontSize).toBe(32); // 28 → 32
      expect(textObj.scaleX).toBe(2.2); // 1.6 → 2.2
    });

    it('콤보가 minComboToShow 미만이면 콤보 텍스트가 표시되지 않아야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 1); // combo=1, minComboToShow=2

      // 피해 텍스트만 설정됨 (20개 풀 + 20개 콤보 풀 = 40개, 그 중 피해 텍스트만 사용)
      const damageTextObj = mockScene.texts[0];
      expect(damageTextObj.setText).toHaveBeenCalledWith('50');

      // 콤보 텍스트는 setText가 호출되지 않아야 함
      const comboTextObjs = mockScene.texts.slice(20);
      comboTextObjs.forEach((text) => {
        expect(text.setText).not.toHaveBeenCalled();
      });
    });

    it('콤보가 minComboToShow 이상이면 콤보 텍스트가 표시되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 5); // combo=5

      // 콤보 텍스트가 설정됨
      const comboTextObj = mockScene.texts[20]; // 콤보 풀의 첫 번째
      expect(comboTextObj.setText).toHaveBeenCalledWith('x5');
    });

    it('콤보 2~9는 low 색상을 사용해야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 5);

      const comboTextObj = mockScene.texts[20];
      expect(comboTextObj.color).toBe('#88ff88');
    });

    it('콤보 10~24는 mid 색상을 사용해야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 15);

      const comboTextObj = mockScene.texts[20];
      expect(comboTextObj.color).toBe('#ffff44');
    });

    it('콤보 25~49는 high 색상을 사용해야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 30);

      const comboTextObj = mockScene.texts[20];
      expect(comboTextObj.color).toBe('#ff8844');
    });

    it('콤보 50 이상은 ultra 색상을 사용해야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 75);

      const comboTextObj = mockScene.texts[20];
      expect(comboTextObj.color).toBe('#ff44ff');
    });

    it('콤보 텍스트가 피해 텍스트 오른쪽에 표시되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 10);

      const damageTextObj = mockScene.texts[0];
      const comboTextObj = mockScene.texts[20];

      // offsetX=25, offsetY=-5
      expect(comboTextObj.x).toBe(damageTextObj.x + 25);
      expect(comboTextObj.y).toBe(200 - 5);
    });
  });

  describe('애니메이션', () => {
    it('피해 텍스트에 애니메이션이 적용되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 0);

      // tweens.add가 호출되어야 함 (스케일 팝 애니메이션)
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('콤보 텍스트에도 애니메이션이 적용되어야 함', async () => {
      const { DamageText } = await import('../src/ui/DamageText');
      const damageText = new DamageText(mockScene as unknown as Phaser.Scene);

      damageText.showDamage(100, 200, 50, 'normal', 5);

      // 피해 텍스트 + 콤보 텍스트 애니메이션
      expect(mockScene.tweens.add).toHaveBeenCalledTimes(2);
    });
  });
});
