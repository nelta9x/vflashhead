# 게임 데이터 가이드

이 디렉토리는 프로젝트 루트의 `/data`에 위치하며, 게임의 모든 밸런스 데이터, 기술 설정, 상수를 집중 관리합니다. 이곳의 JSON 파일을 수정하여 소스 코드 수정 없이 게임의 거의 모든 요소를 조절할 수 있습니다.

---

## 목차

1. [빠른 시작: 무엇을 수정하려면?](#빠른-시작-무엇을-수정하려면)
2. [체력 표시 빠른 맵](#체력-표시-빠른-맵)
3. [파일별 상세 가이드](#파일별-상세-가이드)
   - [game-config.json](#game-configjson)
   - [waves.json](#wavesjson)
   - [dishes.json](#dishesjson)
   - [combo.json](#combojson)
   - [upgrades.json](#upgradesjson)
   - [health-pack.json](#health-packjson)
   - [feedback.json](#feedbackjson)
   - [spawn.json](#spawnjson)
   - [colors.json](#colorsjson)
   - [boss.json](#bossjson)
   - [weapons.json](#weaponsjson)

---

## 빠른 시작: 무엇을 수정하려면?

| 수정 목표 | 파일 | 필드 |
|----------|------|------|
| **전체 난이도 조절** | `waves.json` | `spawnInterval`, `dishTypes` |
| **접시 체력** | `dishes.json` | `hp` |
| **접시 생존 시간** | `dishes.json` | `lifetime` |
| **콤보 타임아웃** | `combo.json` | `timeout.base`, `timeout.minimum` |
| **콤보 배율** | `combo.json` | `multiplier.factor` |
| **업그레이드 출현율** | `upgrades.json` | `rarityWeights` |
| **업그레이드 효과** | `upgrades.json` | `system` |
| **힐팩 스폰 확률** | `health-pack.json` | `baseSpawnChance` |
| **플레이어 초기 HP** | `game-config.json` | `player.initialHp` |
| **플레이어 HP 링 스타일** | `game-config.json` | `player.hpRing` |
| **보스 HP 세그먼트 스케일** | `boss.json` | `visual.armor.hpSegments` |
| **멀티 보스 구성/HP 분배** | `waves.json` | `bossTotalHp`, `bosses[]`, `bossSpawnMinDistance` |
| **폰트 설정** | `game-config.json` | `fonts` |
| **메인 메뉴 언어 안전영역** | `main-menu.json` | `languageUI.safeAreaPaddingX`, `languageUI.safeAreaPaddingTop`, `languageUI.safeAreaPaddingBottom` |
| **커서 크기** | `game-config.json` | `player.cursorHitbox.baseRadius` |
| **콤보 이펙트 강도** | `feedback.json` | `comboMilestones` |

---

## 체력 표시 빠른 맵

세션이 초기화된 AI 어시스트도 아래 표만 보면 체력 UI 구현 위치를 바로 찾을 수 있습니다.

| 대상 | 화면 형태 | 실제 렌더링 코드 | 상태 소스 | 설정 파일 |
|------|-----------|------------------|-----------|-----------|
| 플레이어 | 커서 둘레 세그먼트 링 | `src/effects/CursorRenderer.ts` (`drawHpRing`) | `HealthSystem` -> `GameScene.updateAttackRangeIndicator()` | `data/game-config.json` (`player.hpRing`) |
| 보스 | 메뉴 스타일 아머 실루엣 슬롯 | `src/effects/BossRenderer.ts` (호출: `src/entities/Boss.ts`) + `src/entities/bossHpSegments.ts` | `MonsterSystem` -> `MONSTER_HP_CHANGED` (`bossId`, `current`, `max`, `ratio`) | `data/boss.json` (`visual.armor`, `visual.armor.hpSegments`) |

> 참고: `game-config.json`의 `hud.hpDisplay`는 현재 상단 하트 UI 렌더링에 사용되지 않는 레거시/예약 설정입니다.

---

## 디렉토리 구조

- **`*.json`**: 실제 밸런스 수치들이 들어있는 데이터 파일 (가장 자주 수정하게 될 파일들)
- **`src/data/` (이동됨)**:
  - `DataManager.ts`: 모든 JSON 데이터를 로드하여 타입 안전하게 제공하는 싱글톤 관리자
  - `constants.ts`: JSON 기반 데이터 중 코드에서 자주 쓰이는 물리/기하학적 상수들을 정의
  - `game.config.ts`: Phaser 엔진의 기술적 설정 (물리, 렌더링 방식 등)
  - `types.ts`: 데이터 파일들의 인터페이스 정의 (TypeScript 타입)

---

## 코드에서의 사용법

```typescript
// DataManager 사용 (권장)
import { Data } from '../data/DataManager';

const playerHp = Data.gameConfig.player.initialHp;
const dishHp = Data.getDishData('basic').hp;

// 상수 사용
import { COLORS, FONTS } from '../data/constants';
```

---

## 파일별 상세 가이드

### game-config.json

게임 전역 설정을 관리합니다.

```json
{
  "screen": {
    "width": 1280,      // 화면 너비 (px)
    "height": 720       // 화면 높이 (px)
  },
  "player": {
    "initialHp": 5,     // 게임 시작 시 플레이어 HP
    "cursorHitbox": {
      "baseRadius": 30  // 커서 기본 공격 범위 (px)
    },
    "hpRing": {
      "radiusOffset": -4,      // 커서 반지름 대비 HP 링 위치 오프셋 (음수면 안쪽, 0에 가까울수록 껍데기에 붙음)
      "barThickness": 6,       // HP 바 두께
      "segmentGapDeg": 9,      // HP 세그먼트 간격(도)
      "filledAlpha": 0.85,     // 채워진 HP 바 투명도
      "emptyAlpha": 0.25       // 비워진 HP 바 투명도(테두리는 별도 유지)
    }
  },
  "upgradeUI": {
    "boxWidth": 200,    // 업그레이드 선택 박스 너비
    "boxHeight": 140,   // 업그레이드 선택 박스 높이
    "boxSpacing": 30,   // 박스 간 간격
    "hoverDuration": 300, // 호버 후 선택까지 시간 (ms)
    "boxYOffset": 150,  // 기본 카드 중심 Y 오프셋 (화면 하단 기준)
    "avoidAbilityUiGap": 24 // 하단 어빌리티 요약 UI와 최소 간격 (px)
  },
  "waveTransition": {
    "countdownDuration": 1000, // 웨이브 시작 전 카운트다운 총 시간 (ms)
    "countFrom": 3             // 카운트 시작 숫자 (예: 3 -> 3,2,1)
  },
  "fonts": {
    "main": "'Orbitron', 'Black Han Sans', sans-serif", // 기본 폰트
    "korean": "'Black Han Sans', 'Orbitron', sans-serif" // 한국어 우선 폰트
  },
  "magnet": {
    "minPullDistance": 30   // 최소 당김 거리 (레벨별 수치는 upgrades.json의 magnet.levels에서 관리)
  },
  "blackHoleVisual": {
    "depth": -0.5,              // 렌더링 depth (접시보다 뒤는 0 미만)
    "fadeInDuration": 680,      // 블랙홀 생성 후 페이드 인 시간 (ms)
    "fadeInStartScale": 0.5,    // 페이드 인 시작 스케일 (1 = 최종 크기)
    "fadeInGlowBoost": 1.35,    // 페이드 인 중 글로우 증폭 계수
    "spawnFlashDuration": 520,  // 스폰 플래시 지속 시간 (ms)
    "spawnFlashStartScale": 0.4, // 스폰 플래시 시작 반경 배율
    "spawnFlashEndScale": 1.35, // 스폰 플래시 종료 반경 배율
    "spawnFlashAlpha": 0.65,    // 스폰 플래시 투명도
    "spawnFlashLineWidth": 2.6, // 스폰 플래시 라인 두께
    "arcBurstCount": 6          // 스폰 시 방사 버스트 선 개수
  }
}
```

플레이어 HP는 별도 HUD 바가 아니라 `CursorRenderer`의 커서 통합형 링으로 렌더링됩니다.
`player.hpRing`은 해당 링 전용 설정입니다.

---

### waves.json

웨이브 시스템과 난이도 곡선을 설정합니다.

#### 최상위 필드

| 필드 | 설명 |
|------|------|
| `waves` | 웨이브 1~12 설정 배열 |
| `fever` | 피버 타임 설정 |
| `infiniteScaling` | 웨이브 12 이후 무한 스케일링 공식 |

#### 개별 웨이브 설정

```json
{
  "number": 10,             // 웨이브 번호
  "name": "폭풍",           // 표시 이름
  "dishCount": 5,           // 최소 활성 접시 수 (이 수 이하면 즉시 스폰)
  "spawnInterval": 720,     // 접시 스폰 간격 (ms). 낮을수록 빠름
  "dishTypes": [            // 접시 종류별 출현 가중치
    { "type": "basic", "weight": 0.8 },
    { "type": "golden", "weight": 0.1 },
    { "type": "bomb", "weight": 0.1 }
  ],
  "bossTotalHp": 2420,      // 웨이브 전체 보스 HP 총량
  "bossSpawnMinDistance": 280, // 보스 간 최소 스폰 거리
  "bosses": [
    {
      "id": "boss_left",
      "hpWeight": 1,        // bossTotalHp 분배 가중치
      "spawnRange": { "minX": 320, "maxX": 440, "minY": 90, "maxY": 120 },
      "laser": { "maxCount": 1, "minInterval": 3000, "maxInterval": 5600 }
    },
    {
      "id": "boss_right",
      "hpWeight": 1,
      "spawnRange": { "minX": 840, "maxX": 960, "minY": 90, "maxY": 120 },
      "laser": { "maxCount": 1, "minInterval": 3000, "maxInterval": 5600 }
    }
  ]
}
```

**dishTypes 가중치 계산**: 모든 weight의 합 대비 각 weight의 비율이 출현 확률
- 예: basic=0.8, golden=0.1, bomb=0.1 → basic 80%, golden 10%, bomb 10%

**보스 HP 분배 규칙**:
- `bossTotalHp`를 `bosses[].hpWeight` 비율로 분배
- 분배 과정의 반올림 잔여 HP는 마지막 보스가 흡수
- 예: `bossTotalHp=300`, 가중치 `1:2` -> `100`, `200`

#### 무한 스케일링 (웨이브 12 이후)

```json
{
  "spawnIntervalReduction": 20,  // 웨이브당 스폰 간격 감소 (ms)
  "minSpawnInterval": 150,       // 최소 스폰 간격
  "bombWeightIncrease": 0.02,    // 웨이브당 폭탄 가중치 증가
  "maxBombWeight": 0.35,         // 폭탄 최대 가중치
  "goldenWeightDecrease": 0.01,  // 웨이브당 골든 가중치 감소
  "minGoldenWeight": 0.2,        // 골든 최소 가중치
  "bossTotalHpIncrease": 3000,   // 웨이브당 bossTotalHp 증가량 (우선 사용)
  "bossHpIncrease": 3000,        // 레거시 호환용 보스 HP 증가량
  "infiniteBossCount": 3,        // 무한 웨이브 보스 수
  "minDishCountIncrease": 1,     // 웨이브당 최소 접시 수 증가
  "maxMinDishCount": 20          // 최소 접시 수 상한
}
```

---

### dishes.json

접시(적) 종류별 스탯을 설정합니다.

#### 접시 설정

```json
{
  "basic": {
    "name": "기본 접시",     // 표시 이름
    "hp": 10,               // 체력 (플레이어 데미지로 깎임)
    "color": "#00ffff",     // 색상 (hex)
    "size": 30,             // 접시 크기 (px)
    "chainReaction": false, // 파괴 시 연쇄 반응 여부
    "dangerous": false,     // 접촉 시 플레이어 데미지 여부
    "invulnerable": false,  // 무적 여부
    "lifetime": 2000,       // 생존 시간 (ms). 시간 내 파괴 못하면 사라짐
    "spawnAnimation": {
      "duration": 150,      // 스폰 애니메이션 시간 (ms)
      "ease": "Back.easeOut" // 이징 함수
    }
  }
}
```

#### 접시 타입 특성

| 타입 | 특성 |
|------|------|
| `basic` | 기본 접시. 밸런스 기준점 |
| `golden` | 높은 HP의 중후반 탱커 타입 |
| `crystal` | `chainReaction: true` - 파괴 시 주변 접시에 영향 |
| `bomb` | `dangerous: true`, `invulnerable: true` - 접촉 시 플레이어 피해, 파괴 불가 |
| `mini` | 낮은 HP, 빠른 소멸 |
| `amber` | 주황색 상위 접시. `crystal` 다음 단계(웨이브 10부터 등장) |

#### 데미지 설정

```json
{
  "damage": {
    "playerDamage": 10,    // 플레이어가 접시에 주는 기본 데미지
    "damageInterval": 200  // 데미지 적용 간격 (ms). 커서가 접시 위에 있을 때
  }
}
```

`dishes.damage`는 접시 커서 공격뿐 아니라, 인게임에서 커서가 보스와 겹칠 때의 보스 주기 피해(기본 피해/치명타/틱 간격)에도 동일하게 사용됩니다.

---

### combo.json

콤보 시스템을 설정합니다.

```json
{
  "timeout": {
    "base": 1500,          // 기본 콤보 타임아웃 (ms)
    "comboReduction": 15,  // 콤보당 타임아웃 감소량 (ms)
    "waveReduction": 80,   // 웨이브당 타임아웃 감소량 (ms)
    "minimum": 600         // 최소 타임아웃 (ms)
  },
  "milestones": [5, 10, 25, 50, 100],  // 마일스톤 콤보 (특별 이펙트)
  "multiplier": {
    "factor": 0.1,         // 배율 계수: 1 + combo * factor / (1 + combo * softcapFactor)
    "softcapFactor": 0.01  // 소프트캡 계수 (높을수록 배율 상한 낮아짐)
  }
}
```

**타임아웃 공식**: `max(minimum, base - combo * comboReduction - wave * waveReduction)`

**배율 공식**: `1 + (combo * factor) / (1 + combo * softcapFactor)`
- 콤보 10: 1.83배
- 콤보 50: 3.33배
- 콤보 100: 5.0배

---

### upgrades.json

업그레이드 시스템을 설정합니다.

#### 타이밍 설정

```json
{
  "timing": {
    "baseInterval": 15000,  // 첫 업그레이드까지 시간 (ms)
    "increment": 5000,      // 업그레이드마다 간격 증가 (ms)
    "maxInterval": 30000    // 최대 간격 (ms)
  }
}
```

#### 희귀도 가중치

업그레이드 횟수에 따라 희귀도 출현율이 변화합니다.

```json
{
  "rarityWeights": {
    "early": { "common": 60, "rare": 30, "epic": 10, "legendary": 0 },
    "mid": { "common": 45, "rare": 35, "epic": 17, "legendary": 3 },
    "late": { "common": 30, "rare": 35, "epic": 25, "legendary": 10 },
    "endgame": { "common": 20, "rare": 30, "epic": 30, "legendary": 20 }
  },
  "rarityThresholds": {
    "early": 2,   // 0~2회: early
    "mid": 4,     // 3~4회: mid
    "late": 6     // 5~6회: late, 7회+: endgame
  }
}
```

#### 시스템 업그레이드

시스템 업그레이드는 `levels` 배열 기반으로 동작합니다. 각 레벨마다 임의의 수치를 설정할 수 있어, 비선형적인 성장 곡선 설계가 가능합니다. `maxStack`은 `levels.length`에서 자동 파생됩니다.

```json
{
  "system": [
{
  "id": "cursor_size",
  "name": "넓은 타격",
  "description": "커서 판정 범위 및 데미지 증가",
  "descriptionTemplate": "커서 판정 범위가 {sizeBonus}% 증가하고, 데미지가 {damage} 증가하며, 미사일 굵기가 {missileThicknessBonus}% 증가합니다.",
  "rarity": "common",
  "effectType": "cursorSizeBonus",
      "levels": [
        { "sizeBonus": 0.3, "damage": 2, "missileThicknessBonus": 0.3 },
        { "sizeBonus": 0.6, "damage": 4, "missileThicknessBonus": 0.6 },
        { "sizeBonus": 0.9, "damage": 6, "missileThicknessBonus": 0.9 },
        { "sizeBonus": 1.2, "damage": 8, "missileThicknessBonus": 1.2 },
        { "sizeBonus": 1.5, "damage": 10, "missileThicknessBonus": 1.5 }
      ]
    }
  ]
}
```

**levels 배열 규칙**:
- 배열의 인덱스 0이 레벨 1, 인덱스 4가 레벨 5
- 각 레벨에서 모든 필드를 독립적으로 설정 가능 (비선형 성장)
- `maxStack`은 `levels.length`에서 자동 결정
- `health_pack`은 `levels`가 없으며 `maxStack`을 직접 지정

**어빌리티별 levels 필드**:

| 어빌리티 | 필드 | 설명 |
|----------|------|------|
| `cursor_size` | `sizeBonus` | 커서 크기 증가 비율 (0.3 = 30%) |
| | `damage` | 추가 데미지 |
| | `missileThicknessBonus` | 미사일 두께 증가 비율 (0.3 = 30%) |
| `electric_shock` | `radius` | 충격 범위 (px) |
| | `damage` | 데미지 |
| `magnet` | `radius` | 끌어당김 범위 (px) |
| | `force` | 끌어당기는 힘 (px/sec) |
| `missile` | `damage` | 미사일 데미지 |
| | `count` | 미사일 발사 수 |
| `black_hole` | `damageInterval` | 블랙홀 피해 틱 간격 (ms) |
| | `damage` | 블랙홀 피해 틱 당 피해량 |
| | `force` | 블랙홀 끌어당김 힘 (px/sec) |
| | `spawnInterval` | 블랙홀 재생성 주기 (ms, 주기마다 기존 교체) |
| | `spawnCount` | 주기당 생성 개수 |
| | `radius` | 블랙홀 반경 (px) |

`black_hole`는 중심 좌표와 반경이 모두 화면 안에 들어오도록 생성됩니다.

예시:
```json
{
  "id": "black_hole",
  "rarity": "legendary",
  "effectType": "blackHoleLevel",
  "levels": [
    {
      "damageInterval": 1200,
      "damage": 1,
      "force": 260,
      "spawnInterval": 7600,
      "spawnCount": 1,
      "radius": 150
    }
  ]
}
```

---

### health-pack.json

힐팩 시스템을 설정합니다.

```json
{
  "healAmount": 1,        // 회복량 (HP)
  "fallTime": 3500,       // 낙하 시간 (ms)
  "fallSpeed": 206,       // 낙하 속도 (px/sec)
  "visualSize": 28,       // 시각적 크기 (px)
  "hitboxSize": 35,       // 히트박스 크기 (px) - 클수록 획득 쉬움
  "cooldown": 15000,      // 스폰 쿨다운 (ms)
  "maxActive": 1,         // 동시에 존재 가능한 최대 개수
  "baseSpawnChance": 0.04, // 스폰 체크 1회당 기본 확률
  "checkInterval": 5000   // 스폰 확률 체크 간격 (ms)
}
```

---

### feedback.json

시각/청각 피드백을 설정합니다.

#### 콤보 마일스톤 효과

```json
{
  "comboMilestones": {
    "5": {
      "shake": 3,           // 화면 흔들림 강도 (px)
      "shakeDuration": 150  // 흔들림 지속 시간 (ms)
    },
    "10": {
      "shake": 5,
      "shakeDuration": 200
    }
  }
}
```

#### 파티클 수

```json
{
  "particles": {
    "basic": { "count": 20 },   // 기본 접시 파괴 시 파티클 수
    "golden": { "count": 30 },
    "crystal": { "count": 25 },
    "bomb": { "count": 40 }
  }
}
```

---

### spawn.json

접시 스폰 시스템을 설정합니다.

```json
{
  "area": {
    "minX": 80,     // 스폰 영역 좌측 경계
    "maxX": 1200,   // 스폰 영역 우측 경계
    "minY": 120,    // 스폰 영역 상단 경계
    "maxY": 640     // 스폰 영역 하단 경계
  },
  "minDishDistance": 100,  // 접시 간 최소 거리 (px)
  "fillSpawn": {
    "maxPerFrame": 1,         // 프레임당 최대 채우기 스폰 수
    "cooldownMs": 50          // 채우기 스폰 간 쿨다운 (ms)
  }
}
```

---

### colors.json

게임 색상 팔레트를 설정합니다.

```json
{
  "hex": {
    "cyan": "#00ffff",      // CSS hex 형식
    "magenta": "#ff00ff",
    "yellow": "#ffff00",
    "red": "#ff0044",
    "green": "#00ff88",
    "white": "#ffffff",
    "darkBg": "#0a0a0f",
    "darkPurple": "#1a0a2e"
  },
  "numeric": {
    "cyan": 65535,          // 숫자 형식 (Phaser용)
    "magenta": 16711935,
    "yellow": 16776960,
    "red": 16711748,
    "green": 65416,
    "white": 16777215,
    "darkBg": 657423,
    "darkPurple": 1706542
  }
}
```

**참고**: hex와 numeric 값은 항상 동기화해야 합니다.

---

### weapons.json

무기 기본 스탯을 설정합니다 (현재 시스템에서는 업그레이드로 대체됨).

```json
{
  "default": {
    "name": "기본 블래스터",
    "damage": 10,              // 기본 데미지
    "fireRate": 5,             // 초당 발사 횟수
    "projectileSpeed": 800,    // 발사체 속도 (px/sec)
    "projectileCount": 1,      // 발사체 개수
    "spreadAngle": 15,         // 산탄 각도 (도)
    "piercing": false,         // 관통 여부
    "explosive": false,        // 폭발 여부
    "homing": false,           // 유도 여부
    "criticalChance": 0.05,    // 치명타 확률 (0.05 = 5%)
    "criticalMultiplier": 2    // 치명타 배율
  }
}
```

---

### boss.json

보스의 시각적 외형과 피드백 설정을 관리합니다. 보스의 아머 파편은 현재 체력의 척도(HP Bar) 역할을 합니다.

```json
{
  "visual": {
    "core": {
      "radius": 30,          // 중앙 코어 반지름
      "pulseSpeed": 0.01     // 코어 깜빡임 속도
    },
    "armor": {
      "maxPieces": 10,       // 기본 아머 파편 개수
      "radius": 55,          // 아머 외곽 반지름
      "innerRadius": 40,     // 아머 안쪽 반지름
      "rotationSpeed": 0.0005, // 아머 회전 속도
      "depletedBodyAlpha": 0.22, // 잃은 HP 슬롯(빈 칸) 본체 투명도
      "depletedBorderAlpha": 0.42, // 잃은 HP 슬롯 테두리 투명도
      "hpSegments": {
        "minPieces": 1,          // 최소 슬롯 수
        "maxPieces": 9999,       // 슬롯 상한 (사실상 제한 해제)
        "targetHpPerPiece": 100 // 슬롯 1칸당 HP (100당 1칸, 나머지는 올림)
      }
    },
    "shockwave": {
      "maxRadius": 120,      // 아머 파괴 시 충격파 최대 크기
      "duration": 400        // 충격파 지속 시간
    }
  }
}
```

`hpSegments`를 사용하면 보스 체력에 따라 아머 실루엣 조각 수가 자동 조절됩니다.
현재 기본값은 **100 HP당 1칸, 나머지 HP가 있으면 1칸 추가(올림)** 규칙입니다.
현재 슬롯 시각화는 별도 보조 링 없이 **아머 실루엣 조각 자체**로 표현됩니다.

---

## 밸런스 팁

1. **난이도 곡선**: `waves.json`의 `spawnInterval`을 조절. 웨이브 1은 1000ms, 웨이브 12는 200ms가 기본값.

2. **접시 생존성**: `dishes.json`의 `hp`, `lifetime` 값을 조절해 타입별 체감 난이도를 조절.

3. **콤보 시스템**:
   - 쉽게 만들려면: `combo.json`의 `timeout.base` 증가, `timeout.minimum` 증가
   - 어렵게 만들려면: 반대로 조절

4. **업그레이드 파워**: `upgrades.json`에서 `multiply` 값을 조절. 1.25 = 25% 증가.

5. **생존성**: `health-pack.json`의 `baseSpawnChance`를 조절하여 힐팩 출현율 변경.
