import Phaser from 'phaser';
import { COLORS, COLORS_HEX, GAME_WIDTH, GAME_HEIGHT, FONTS } from '../data/constants';
import { Data } from '../data/DataManager';
import { SoundSystem } from '../systems/SoundSystem';
import { CursorTrail } from '../effects/CursorTrail';
import { ParticleManager } from '../effects/ParticleManager';
import { StarBackground } from '../effects/StarBackground';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private startPrompt!: Phaser.GameObjects.Text;
  private isTransitioning: boolean = false;
  private gridGraphics!: Phaser.GameObjects.Graphics;
  private bossGraphics!: Phaser.GameObjects.Graphics;
  private starBackground!: StarBackground;
  private menuCursorGraphics!: Phaser.GameObjects.Graphics;
  private cursorTrail!: CursorTrail;
  private particleManager!: ParticleManager;
  private menuDishes!: Phaser.GameObjects.Group;
  private cursorPos = { x: 0, y: 0 };

  private gridOffset: number = 0;
  private bossTime: number = 0;
  private cursorTime: number = 0;
  private lastDishSpawnTime: number = 0;
  private bestWaveText!: Phaser.GameObjects.Text;
  private langButton!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    this.isTransitioning = false;
    // 배경색 채우기
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.DARK_BG).setOrigin(0, 0).setDepth(-10);
    
    this.starBackground = new StarBackground(this, Data.mainMenu.stars);
    this.createBoss();
    this.createGrid();

    this.particleManager = new ParticleManager(this);
    this.menuDishes = this.add.group();

    this.cursorTrail = new CursorTrail(this);
    this.createMenuCursor();
    this.createTitle();
    this.createStartUI();
    this.createBestWave();
    this.createLanguageButton();

    this.setupInputHandlers();
  }

  private createLanguageButton(): void {
    const currentLang = Data.getLanguage();
    const x = GAME_WIDTH - 20;
    const y = 25;
    
    const container = this.add.container(x, y);
    
    // 1. 지구본 아이콘 (간단한 그래픽)
    const icon = this.add.graphics();
    icon.lineStyle(1.5, COLORS.WHITE, 0.6);
    icon.strokeCircle(-85, 10, 8);
    icon.lineStyle(1, COLORS.WHITE, 0.4);
    icon.moveTo(-85, 2); icon.lineTo(-85, 18); // 세로선
    icon.moveTo(-93, 10); icon.lineTo(-77, 10); // 가로선
    container.add(icon);

    // 2. EN 텍스트
    const enText = this.add.text(-60, 0, 'EN', {
      fontFamily: FONTS.MAIN,
      fontSize: '18px',
      color: currentLang === 'en' ? COLORS_HEX.CYAN : COLORS_HEX.WHITE,
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    // 3. 구분선
    const separator = this.add.text(-40, 0, '|', {
      fontFamily: FONTS.MAIN,
      fontSize: '16px',
      color: COLORS_HEX.WHITE,
    }).setOrigin(0.5, 0).setAlpha(0.3);

    // 4. KO 텍스트
    const koText = this.add.text(-20, 0, 'KO', {
      fontFamily: FONTS.MAIN,
      fontSize: '18px',
      color: currentLang === 'ko' ? COLORS_HEX.CYAN : COLORS_HEX.WHITE,
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    container.add([enText, separator, koText]);

    // 하이라이트 및 이벤트 설정
    const updateStyle = (textObj: Phaser.GameObjects.Text, isActive: boolean) => {
      if (isActive) {
        textObj.setColor(COLORS_HEX.CYAN);
        textObj.setAlpha(1);
        textObj.setScale(1.1);
        textObj.setShadow(0, 0, COLORS_HEX.CYAN, 5, true, true);
      } else {
        textObj.setColor(COLORS_HEX.WHITE);
        textObj.setAlpha(0.5);
        textObj.setScale(1);
        textObj.setShadow(0, 0, '', 0);
      }
    };

    updateStyle(enText, currentLang === 'en');
    updateStyle(koText, currentLang === 'ko');

    enText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (Data.getLanguage() !== 'en') {
        Data.setLanguage('en');
        this.scene.restart();
      }
    });

    koText.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      if (Data.getLanguage() !== 'ko') {
        Data.setLanguage('ko');
        this.scene.restart();
      }
    });

    // 호버 효과
    [enText, koText].forEach(t => {
      t.on('pointerover', () => {
        if (t.alpha < 1) t.setAlpha(0.8);
      });
      t.on('pointerout', () => {
        const isThisActive = (t === enText && Data.getLanguage() === 'en') || (t === koText && Data.getLanguage() === 'ko');
        t.setAlpha(isThisActive ? 1 : 0.5);
      });
    });
  }

  private createBoss(): void {
    this.bossGraphics = this.add.graphics();
    // 보스 위치: 이전 태양 위치와 비슷하게
    this.updateBoss(0);
  }

  private updateBoss(delta: number): void {
    const config = Data.mainMenu.boss;
    this.bossGraphics.clear();
    this.bossTime += delta;

    const bossX = GAME_WIDTH / 2;
    const bossY = GAME_HEIGHT * config.posYRatio;

    // 1. 배경 아우라 (붉은빛)
    const auraPulse = 0.2 + Math.sin(this.bossTime * config.aura.pulseSpeed) * 0.1;
    for (let i = 0; i < config.aura.count; i++) {
      const alpha = (1 - i / config.aura.count) * auraPulse;
      this.bossGraphics.fillStyle(COLORS.RED, alpha);
      this.bossGraphics.fillCircle(bossX, bossY, config.baseRadius * (1 + i * config.aura.spacing));
    }

    // 2. 중앙 거대 코어
    const corePulse = 0.6 + Math.sin(this.bossTime * config.core.pulseSpeed) * 0.2;
    this.bossGraphics.fillStyle(COLORS.RED, corePulse);
    this.bossGraphics.fillCircle(bossX, bossY, config.coreRadius);

    // 코어 내부 흰색 광원
    this.bossGraphics.fillStyle(0xffffff, 0.8);
    this.bossGraphics.fillCircle(bossX, bossY, config.innerLightRadius);

    // 3. 회전하는 거대 아머 조각들
    const rotation = this.bossTime * config.armor.rotationSpeed;
    const pieceAngle = (Math.PI * 2) / config.armor.pieceCount;

    for (let i = 0; i < config.armor.pieceCount; i++) {
      const startAngle = rotation + i * pieceAngle + config.armor.gap;
      const endAngle = rotation + (i + 1) * pieceAngle - config.armor.gap;

      const p1x = bossX + Math.cos(startAngle) * config.armor.innerRadius;
      const p1y = bossY + Math.sin(startAngle) * config.armor.innerRadius;
      const p2x = bossX + Math.cos(endAngle) * config.armor.innerRadius;
      const p2y = bossY + Math.sin(endAngle) * config.armor.innerRadius;
      const p3x = bossX + Math.cos(endAngle) * config.armor.outerRadius;
      const p3y = bossY + Math.sin(endAngle) * config.armor.outerRadius;
      const p4x = bossX + Math.cos(startAngle) * config.armor.outerRadius;
      const p4y = bossY + Math.sin(startAngle) * config.armor.outerRadius;

      // 아머 본체 (어두운 색)
      this.bossGraphics.fillStyle(0x1a0505, 0.9);
      this.bossGraphics.fillPoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 테두리 (네온 레드)
      this.bossGraphics.lineStyle(3, COLORS.RED, 0.8);
      this.bossGraphics.strokePoints(
        [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
          { x: p3x, y: p3y },
          { x: p4x, y: p4y },
        ],
        true
      );

      // 아머 내부 디테일 라인
      this.bossGraphics.lineStyle(1, COLORS.RED, 0.4);
      const midR = (config.armor.innerRadius + config.armor.outerRadius) / 2;
      this.bossGraphics.beginPath();
      this.bossGraphics.arc(bossX, bossY, midR, startAngle, endAngle);
      this.bossGraphics.strokePath();
    }

    // 보스 미세 진동 효과
    const shakeX = (Math.random() - 0.5) * 2;
    const shakeY = (Math.random() - 0.5) * 2;
    this.bossGraphics.x = shakeX;
    this.bossGraphics.y = shakeY;
  }

  private createGrid(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(Data.gameConfig.gameGrid.depth);
    this.gridGraphics.setBlendMode(Phaser.BlendModes.SCREEN);
  }

  private createMenuCursor(): void {
    const config = Data.mainMenu.cursor;
    this.menuCursorGraphics = this.add.graphics();
    this.cursorPos.x = GAME_WIDTH / 2;
    this.cursorPos.y = GAME_HEIGHT - config.yOffset;
    this.updateMenuCursor(0);
  }

  private updateMenuCursor(delta: number): void {
    const config = Data.mainMenu.cursor;
    this.menuCursorGraphics.clear();
    this.cursorTime += delta;

    // 1. 타겟 결정
    let targetX: number;
    let targetY: number;

    // 가장 가까운 접시 찾기
    let nearestDish: Phaser.GameObjects.Graphics | null = null;
    let minDist = Infinity;

    for (const child of this.menuDishes.getChildren()) {
      const dish = child as Phaser.GameObjects.Graphics;
      const dist = Phaser.Math.Distance.Between(this.cursorPos.x, this.cursorPos.y, dish.x, dish.y);
      // 너무 멀리 있는(지평선 근처) 접시는 무시하고 어느 정도 다가온 것부터 추적
      if (dist < minDist && dish.y > GAME_HEIGHT * config.trackingYThreshold) {
        minDist = dist;
        nearestDish = dish;
      }
    }

    if (nearestDish) {
      // 접시가 있으면 접시 위치를 타겟으로 (추적 속도 향상)
      targetX = nearestDish.x;
      targetY = nearestDish.y;
    } else {
      // 접시가 없으면 기본 8자 유영 패턴
      const centerX = GAME_WIDTH / 2;
      const centerY = GAME_HEIGHT - config.yOffset;
      targetX = centerX + Math.sin(this.cursorTime * config.floatSpeed) * config.floatRangeX;
      targetY = centerY + Math.sin(this.cursorTime * config.floatSpeed * 1.5) * config.floatRangeY;
    }

    // 2. 부드러운 이동 (Lerp)
    const lerpFactor = nearestDish ? config.lerpTracking : config.lerpIdle; // 추적 시 더 민첩하게 반응
    this.cursorPos.x = Phaser.Math.Linear(this.cursorPos.x, targetX, lerpFactor);
    this.cursorPos.y = Phaser.Math.Linear(this.cursorPos.y, targetY, lerpFactor);

    const x = this.cursorPos.x;
    const y = this.cursorPos.y;

    // 원근감 계산: Y값이 작을수록(위로 갈수록) 멀리 있는 것이므로 크기를 줄임
    const horizonY = GAME_HEIGHT * Data.mainMenu.grid.horizonRatio;
    const verticalRange = GAME_HEIGHT - horizonY;
    const perspectiveFactor = Phaser.Math.Clamp((y - horizonY) / verticalRange, 0, 1);

    // 멀어질수록 작아지고(0.4x ~ 1.0x), 가까울수록 커짐
    const currentRadius = config.radius * (0.4 + perspectiveFactor * 0.6);

    // 트레일 업데이트
    this.cursorTrail.update(delta, currentRadius, x, y);

    // 1. 외곽 원 (원근감이 적용된 두께와 크기)
    this.menuCursorGraphics.lineStyle(
      1 + perspectiveFactor * 2,
      Data.gameConfig.player.cursorColorNumeric,
      0.2 + perspectiveFactor * 0.4
    );
    this.menuCursorGraphics.strokeCircle(x, y, currentRadius);

    // 2. 내부 채우기
    this.menuCursorGraphics.fillStyle(Data.gameConfig.player.cursorColorNumeric, 0.05 + perspectiveFactor * 0.1);
    this.menuCursorGraphics.fillCircle(x, y, currentRadius);

    // 4. 중앙 점
    this.menuCursorGraphics.fillStyle(COLORS.WHITE, 0.5 + perspectiveFactor * 0.5);
    this.menuCursorGraphics.fillCircle(x, y, 2 * (0.5 + perspectiveFactor * 0.5));
  }

  private createTitle(): void {
    const config = Data.mainMenu.title;
    // 메인 타이틀 (크롬 느낌의 네온 텍스트)
    this.titleText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - config.yOffset,
      Data.t('menu.title'),
      {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: config.color,
        fontStyle: 'italic bold',
      }
    );
    this.titleText.setOrigin(0.5);
    // 그림자와 이탤릭체로 인해 글자가 잘리는 것을 방지하기 위해 패딩 추가
    this.titleText.setPadding(config.padding, config.padding, config.padding, config.padding);
    this.titleText.setShadow(0, 0, config.shadowColor, config.shadowBlur, true, true);

    // 은은한 글로우/애니메이션
    this.tweens.add({
      targets: this.titleText,
      y: GAME_HEIGHT / 2 - config.moveY,
      duration: config.moveDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createStartUI(): void {
    // 시작 안내 텍스트
    this.startPrompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 150, Data.t('menu.start'), {
      fontFamily: FONTS.MAIN,
      fontSize: '28px',
      color: COLORS_HEX.WHITE,
    });
    this.startPrompt.setOrigin(0.5);
    this.startPrompt.setShadow(0, 0, COLORS_HEX.CYAN, 10, true, true);

    this.tweens.add({
      targets: this.startPrompt,
      alpha: 0.2,
      scale: 1.1,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Cubic.easeInOut',
    });
  }

  private createBestWave(): void {
    const config = Data.mainMenu.bestWave;
    const bestWave = parseInt(localStorage.getItem(config.localStorageKey) || '0', 10);

    if (bestWave <= 0) return;

    this.bestWaveText = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 + 150 - config.yOffset,
      Data.t('menu.best_wave', bestWave),
      {
        fontFamily: FONTS.MAIN,
        fontSize: config.fontSize,
        color: COLORS_HEX.WHITE,
      }
    );
    this.bestWaveText.setOrigin(0.5);
    this.bestWaveText.setAlpha(config.alpha);
    this.bestWaveText.setShadow(0, 0, COLORS_HEX.CYAN, 6, true, true);
  }

  private updateMenuDishes(delta: number): void {
    const config = Data.mainMenu.dishSpawn;
    const gridConfig = Data.mainMenu.grid;
    const globalGridConfig = Data.gameConfig.gameGrid;
    const cursorConfig = Data.mainMenu.cursor;
    const horizonY = GAME_HEIGHT * gridConfig.horizonRatio;

    // 1. 스폰
    const randomInterval = Phaser.Math.Between(400, 800);
    if (this.time.now - this.lastDishSpawnTime > randomInterval) {
      this.spawnMenuDish(horizonY, config);
      this.lastDishSpawnTime = this.time.now;
    }

    // 2. 이동 및 충돌
    const cursorRadius = cursorConfig.radius;

    this.menuDishes.getChildren().forEach((child: Phaser.GameObjects.GameObject) => {
      const dish = child as Phaser.GameObjects.Graphics;

      // 원근감 이동 (아래로 갈수록 빨라짐)
      const verticalRange = GAME_HEIGHT - horizonY;
      const perspectiveFactor = (dish.y - horizonY) / verticalRange;
      const speed = globalGridConfig.speed * delta * (1 + perspectiveFactor * config.speedMultiplier);

      dish.y += speed;

      // X축 이동 (중앙에서 퍼져나가는 효과 등은 제외하고 직선 이동)

      // 원근감 스케일링
      const scale = 0.2 + perspectiveFactor * 0.8;
      dish.setScale(scale);

      // 화면 밖 제거
      if (dish.y > GAME_HEIGHT + 50) {
        dish.destroy();
        return;
      }

      // 충돌 체크 (커서와 접시)
      // 원근감이 적용된 실제 화면상 거리와 반지름 비교
      const dist = Phaser.Math.Distance.Between(dish.x, dish.y, this.cursorPos.x, this.cursorPos.y);
      const hitDist = config.radius * scale + cursorRadius * (0.4 + perspectiveFactor * 0.6);

      if (dist < hitDist) {
        // 파괴 이펙트
        const color = parseInt(config.color.replace('#', ''), 16);
        this.particleManager.createExplosion(dish.x, dish.y, color, 'basic', 0.5);
        this.particleManager.createHitEffect(dish.x, dish.y, COLORS.WHITE);

        dish.destroy();
      }
    });
  }

  private spawnMenuDish(
    horizonY: number,
    config: { spawnRangeX: number; color: string; radius: number }
  ): void {
    // 커서가 움직이는 X 범위 내에서 스폰하여 충돌 확률 높임
    const spawnXRange = config.spawnRangeX || 300;
    const x = GAME_WIDTH / 2 + (Math.random() - 0.5) * spawnXRange;
    const y = horizonY;

    const dish = this.add.graphics();
    dish.x = x;
    dish.y = y;

    // 네온 팔각형 그리기
    const color = parseInt(config.color.replace('#', ''), 16);
    dish.lineStyle(2, color, 1);
    dish.fillStyle(color, 0.3);

    const radius = config.radius;
    dish.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) dish.moveTo(px, py);
      else dish.lineTo(px, py);
    }
    dish.closePath();
    dish.fillPath();
    dish.strokePath();

    this.menuDishes.add(dish);
  }

  private setupInputHandlers(): void {
    // 입력을 감지하기 위한 이벤트 리스너 등록
    this.input.keyboard?.on('keydown', () => this.startGame());
    this.input.on('pointerdown', () => this.startGame());

    const onNativeInput = () => {
      this.startGame();
      window.removeEventListener('mousedown', onNativeInput);
      window.removeEventListener('keydown', onNativeInput);
    };
    window.addEventListener('mousedown', onNativeInput);
    window.addEventListener('keydown', onNativeInput);
  }

  update(time: number, delta: number): void {
    const globalConfig = Data.gameConfig.gameGrid;
    this.updateGrid(delta);
    this.starBackground.update(delta, time, globalConfig.speed);
    this.updateBoss(delta);
    this.updateMenuCursor(delta);
    this.updateMenuDishes(delta);
  }

  private updateGrid(delta: number): void {
    const config = Data.mainMenu.grid;
    const globalConfig = Data.gameConfig.gameGrid;
    this.gridGraphics.clear();
    const horizonY = GAME_HEIGHT * config.horizonRatio;
    const vanishingPointX = GAME_WIDTH / 2;
    const verticalSpread = 8; // 좌우로 퍼지는 강도

    // 1. 세로선 (원근법) - 화면 전체를 덮도록 시작점을 넓게 잡음
    this.gridGraphics.lineStyle(globalConfig.lineWidth, COLORS.CYAN, globalConfig.alpha);
    
    for (let i = 0; i <= config.verticalLines; i++) {
      // 선 사이의 간격을 좁혀서 더 촘촘하게 배치 (나누는 값을 키움)
      const xOffset = (i - config.verticalLines / 2) * (GAME_WIDTH / 25);
      const startX = vanishingPointX + xOffset * 0.08; 
      const endX = vanishingPointX + xOffset * verticalSpread; 

      this.gridGraphics.moveTo(startX, horizonY);
      this.gridGraphics.lineTo(endX, GAME_HEIGHT);
    }

    // 2. 움직이는 가로선 (원근법 적용)
    this.gridOffset += delta * globalConfig.speed;
    const maxRange = config.horizontalLines * config.size;
    if (this.gridOffset >= config.size) {
      this.gridOffset -= config.size;
    }

    for (let i = 0; i < config.horizontalLines; i++) {
      const progress = (i * config.size + this.gridOffset) / maxRange;
      const perspectiveProgress = Math.pow(progress, 2.0);
      const y = horizonY + perspectiveProgress * (GAME_HEIGHT - horizonY);

      if (y > GAME_HEIGHT) continue;

      // 가로선 너비도 세로선 확장에 맞춰 충분히 넓게 설정
      const widthAtY = GAME_WIDTH * verticalSpread;
      this.gridGraphics.moveTo(vanishingPointX - widthAtY / 2, y);
      this.gridGraphics.lineTo(vanishingPointX + widthAtY / 2, y);
    }

    this.gridGraphics.strokePath();

    // 지평선 강조 (globalConfig.alpha 사용)
    this.gridGraphics.lineStyle(2, COLORS.CYAN, globalConfig.alpha * 1.5);
    this.gridGraphics.moveTo(0, horizonY);
    this.gridGraphics.lineTo(GAME_WIDTH, horizonY);
    this.gridGraphics.strokePath();
  }

  private async startGame(): Promise<void> {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    // 사운드 시스템 활성화 및 대기
    const ss = SoundSystem.getInstance();
    await ss.init();

    // 시작음 재생
    ss.playSafeSound();

    // 시작 시 강렬한 효과
    this.tweens.add({
      targets: [this.titleText, this.startPrompt, this.bestWaveText].filter(Boolean),
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.scene.start('GameScene');
      },
    });

    this.cameras.main.fadeOut(400, 0, 0, 0);
  }
}
