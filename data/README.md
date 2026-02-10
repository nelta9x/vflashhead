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
   - [falling-bomb.json](#falling-bombjson)
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
| **낙하 폭탄 스폰 확률** | `falling-bomb.json` | `baseSpawnChance` |
| **낙하 폭탄 등장 시작 웨이브** | `falling-bomb.json` | `minWave` |
| **플레이어 초기 HP** | `game-config.json` | `player.initialHp` |
| **플레이어 HP 링 스타일** | `game-config.json` | `player.hpRing` |
| **보스 HP 세그먼트 스케일** | `boss.json` | `visual.armor.hpSegments` |
| **멀티 보스 구성/HP 분배** | `waves.json` | `bossTotalHp`, `bosses[]`, `bossSpawnMinDistance` |
| **폰트 설정** | `game-config.json` | `fonts` |
| **메인 메뉴 언어 안전영역** | `main-menu.json` | `languageUI.safeAreaPaddingX`, `languageUI.safeAreaPaddingTop`, `languageUI.safeAreaPaddingBottom` |
| **커서 크기** | `game-config.json` | `player.cursorHitbox.baseRadius` |
| **커서 입력 전환 유예** | `game-config.json` | `player.input.pointerPriorityMs` |
| **키보드 축 가속 시간** | `game-config.json` | `player.input.keyboardAxisRampUpMs` |
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
    "input": {
      "pointerPriorityMs": 120,      // 포인터 입력 이후 키보드 이동이 우선권을 얻기 전까지의 유예 시간 (ms)
      "keyboardAxisRampUpMs": 90     // 키보드 축 입력이 0 -> 1로 도달하는 가속 시간 (ms)
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
    "boxWidth": 340,    // 업그레이드 선택 박스 너비
    "boxHeight": 440,   // 업그레이드 선택 박스 높이
    "boxSpacing": 45,   // 박스 간 간격
    "hoverDuration": 1000, // 호버 후 선택까지 시간 (ms)
    "boxYOffset": 220,  // 기본 카드 중심 Y 오프셋 (화면 하단 기준)
    "avoidAbilityUiGap": 24, // 하단 어빌리티 요약 UI와 최소 간격 (px)
    "readabilityCard": {
      "levelOffsetY": 188,      // 레벨 전환 텍스트 Y 위치
      "statListStartY": 220,    // 변경 수치 목록 시작 Y
      "statRowHeight": 24,      // 수치 행 간격
      "statMaxRows": 7          // 카드 내 최대 표시 행 수
    }
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
`player.input.pointerPriorityMs`는 포인터 이동 직후 키보드 이동이 입력 우선권을 가져가기 전까지의 안전 유예 시간을 정의합니다.
`player.input.keyboardAxisRampUpMs`는 키다운 시 축 입력이 최대치에 도달하는 가속 시간을 정의합니다(키업 시 즉시 0으로 복귀).
`stars.shootingStar.colorPalette`는 별똥별의 글로우/꼬리 색 팔레트를 제어합니다.

```json
{
  "stars": {
    "shootingStar": {
      "colorPalette": [                // 별똥별 랜덤 색 팔레트 (hex)
        "#ff8a8a",
        "#ffd24d",
        "#7ea8ff",
        "#8cf3ff"
      ]
    }
  }
}
```

---

### waves.json

웨이브 시스템과 난이도 곡선을 설정합니다.

#### 최상위 필드

| 필드 | 설명 |
|------|------|
| `waves` | 웨이브 1~14 설정 배열 |
| `fever` | 피버 타임 설정 |
| `infiniteScaling` | 웨이브 14 이후 무한 스케일링 공식 |

#### 개별 웨이브 설정

```json
{
  "number": 10,             // 웨이브 번호
  "name": "폭풍",           // 표시 이름
  "dishCount": 5,           // 최소 활성 접시 수 (이 수 이하면 즉시 스폰)
  "spawnInterval": 820,     // 접시 스폰 간격 (ms). 낮을수록 빠름
  "dishTypes": [            // 접시 종류별 출현 가중치
    { "type": "basic", "weight": 0.48 },
    { "type": "golden", "weight": 0.3 },
    { "type": "crystal", "weight": 0.1 },
    { "type": "bomb", "weight": 0.12 }
  ],
  "bossTotalHp": 1900,      // 웨이브 전체 보스 HP 총량
  "bossSpawnMinDistance": 280, // 보스 간 최소 스폰 거리
  "bosses": [
    {
      "id": "boss_left",
      "hpWeight": 1,        // bossTotalHp 분배 가중치
      "spawnRange": { "minX": 320, "maxX": 440, "minY": 90, "maxY": 120 },
      "laser": { "maxCount": 1, "minInterval": 4200, "maxInterval": 7600 }
    },
    {
      "id": "boss_right",
      "hpWeight": 1,
      "spawnRange": { "minX": 840, "maxX": 960, "minY": 90, "maxY": 120 },
      "laser": { "maxCount": 1, "minInterval": 4200, "maxInterval": 7600 }
    }
  ]
}
```

웨이브 설계 원칙: **새 접시/새 기믹/보스 수 증가 같은 \"큰 변화\"는 한 웨이브에 1개만 적용**합니다.
예시로 12웨이브는 `2보스 전환`만 적용하고, `amber` 도입은 무한 구간(15+)으로 분리합니다.

**dishTypes 가중치 계산**: 모든 weight의 합 대비 각 weight의 비율이 출현 확률
- 예: basic=0.8, golden=0.1, bomb=0.1 → basic 80%, golden 10%, bomb 10%

**보스 HP 분배 규칙**:
- `bossTotalHp`를 `bosses[].hpWeight` 비율로 분배
- 분배 과정의 반올림 잔여 HP는 마지막 보스가 흡수
- 예: `bossTotalHp=300`, 가중치 `1:2` -> `100`, `200`

#### 무한 스케일링 (웨이브 14 이후)

```json
{
  "spawnIntervalReduction": 5,   // 웨이브당 스폰 간격 감소 (ms)
  "minSpawnInterval": 640,       // 최소 스폰 간격
  "bombWeightIncrease": 0.002,   // 웨이브당 폭탄 가중치 증가
  "maxBombWeight": 0.18,         // 폭탄 최대 가중치
  "goldenWeightDecrease": 0.002, // 웨이브당 골든 가중치 감소
  "minGoldenWeight": 0.16,       // 골든 최소 가중치
  "bossTotalHpIncrease": 150,    // 웨이브당 bossTotalHp 증가량 (우선 사용)
  "bossHpIncrease": 150,         // 레거시 호환용 보스 HP 증가량
  "infiniteBossCount": 2,        // 무한 웨이브 보스 수(2보스 고정)
  "minDishCountIncrease": 0,     // 웨이브당 최소 접시 수 증가
  "maxMinDishCount": 7,          // 최소 접시 수 상한
  "amberStartWaveOffset": 1,     // 고정 웨이브 종료 후 몇 웨이브 뒤에 amber 시작할지
  "amberStartWeight": 0.02,      // amber 시작 가중치
  "amberWeightIncrease": 0.02,   // 웨이브당 amber 가중치 증가량
  "maxAmberWeight": 0.16         // amber 최대 가중치
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
| `crystal` | 높은 HP의 고위협 접시 |
| `bomb` | `dangerous: true`, `invulnerable: true` - 접촉 시 플레이어 피해, 파괴 불가 |
| `mini` | 낮은 HP, 빠른 소멸 |
| `amber` | 주황색 상위 접시. 무한 웨이브(15+)에서 점진 도입 |

#### 데미지 설정

```json
{
  "damage": {
    "playerDamage": 10,    // 플레이어가 접시에 주는 기본 데미지
    "damageInterval": 200  // 데미지 적용 간격 (ms). 커서가 접시 위에 있을 때
  }
}
```

`dishes.damage`는 접시 커서 공격뿐 아니라, 인게임에서 커서가 보스와 겹칠 때의 보스 주기 피해(기본 피해/치명타/틱 간격), 그리고 전기 충격/금구슬/블랙홀의 치명타 판정(접시 및 블랙홀 보스 틱 피해)에도 동일하게 사용됩니다.

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
    "early": { "common": 25, "rare": 15, "epic": 8, "legendary": 4 },
    "mid": { "common": 25, "rare": 15, "epic": 8, "legendary": 5 },
    "late": { "common": 24, "rare": 14, "epic": 8, "legendary": 7 },
    "endgame": { "common": 22, "rare": 14, "epic": 10, "legendary": 8 }
  },
  "rarityThresholds": {
    "early": 2,   // 0~2회: early
    "mid": 5,     // 3~5회: mid
    "late": 8     // 6~8회: late, 9회+: endgame
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
      "name": "매우 큰 머리",
      "description": "커서 판정 범위 및 데미지 증가",
      "descriptionTemplate": "커서 판정 범위가 {sizeBonus}% 증가하고, 데미지가 {damage} 증가하며, 미사일 굵기가 {missileThicknessBonus}% 증가합니다.",
      "rarity": "common",
      "effectType": "cursorSizeBonus",
      "previewDisplay": {
        "stats": [
          { "id": "sizeBonus", "labelKey": "upgrade.stat.cursor_area_pct" },
          { "id": "cursorRadiusPx", "labelKey": "upgrade.stat.cursor_radius_px" },
          { "id": "damage", "labelKey": "upgrade.stat.damage" },
          { "id": "missileThicknessBonus", "labelKey": "upgrade.stat.missile_thickness_pct" }
        ]
      },
      "levels": [
        { "sizeBonus": 0.4, "damage": 3, "missileThicknessBonus": 0.25 },
        { "sizeBonus": 0.5, "damage": 5, "missileThicknessBonus": 0.5 },
        { "sizeBonus": 0.5, "damage": 10, "missileThicknessBonus": 1.0 }
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
- `previewDisplay`는 시스템 업그레이드에서 필수이며, 누락 시 런타임 에러로 처리됨

**previewDisplay 규칙**:
- `stats`: 카드에 표시할 후보 수치 목록 (`id`, `labelKey`)
- 카드에는 `delta !== 0`인 항목만 표시
- 직접 수치 + 파생 수치 모두 지원:
  - `cursorRadiusPx = baseRadius * (1 + sizeBonus)`
  - `orbFinalSizeWithMagnet = orbSize * (1 + magnetLevel * 0.2)`

**previewDisplay.stats.id 허용값**:
- `sizeBonus`, `cursorRadiusPx`, `damage`, `missileThicknessBonus`, `criticalChance`
- `radius`, `force`, `count`, `hpBonus`, `dropChanceBonus`, `speed`, `size`
- `orbFinalSizeWithMagnet`, `damageInterval`, `spawnInterval`, `spawnCount`

**로케일 연동 규칙**:
- `previewDisplay.stats[].labelKey`는 `data/locales.json`의 `upgrade.stat.*`에 반드시 존재해야 함
- 카드 공용 포맷 키:
  - `upgrade.card.level_transition`
  - `upgrade.card.delta_format`
- 선택창 전용 보조 문구(선택):
  - `upgrade.<id>.selection_hint`
  - 키가 없으면 선택 카드에서 문구를 렌더하지 않음

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
| `orbiting_orb` | `count` | 구슬 개수 |
| | `damage` | 구슬 타격 피해량 |
| | `speed` | 기본 회전 속도 (deg/s) |
| | `radius` | 궤도 반경 (px) |
| | `size` | 구슬 기본 크기 (px) |
| | `overclockDurationMs` | 폭탄 제거 후 오버클럭 지속 시간 (ms) |
| | `overclockSpeedMultiplier` | 오버클럭 1스택당 회전 속도 배율 |
| | `overclockMaxStacks` | 오버클럭 최대 중첩 수 |
| `black_hole` | `damageInterval` | 블랙홀 피해 틱 간격 (ms) |
| | `damage` | 블랙홀 피해 틱 당 피해량 |
| | `force` | 블랙홀 끌어당김 힘 (px/sec) |
| | `spawnInterval` | 새 블랙홀 생성 주기 (ms) |
| | `duration` | 개별 블랙홀 유지 시간 (ms, duration > spawnInterval이면 여러 세대 공존) |
| | `spawnCount` | 주기당 생성 개수 |
| | `radius` | 블랙홀 반경 (px) |
| | `bombConsumeRadiusRatio` | 폭탄 제거 중심 반경 비율 (`radius * ratio`, 0~1) |
| | `consumeRadiusGrowthRatio` | 제거 1회당 반경 비율 증가율 (0.1 = 10%) |
| | `consumeRadiusGrowthFlat` | 제거 1회당 반경 고정 증가량 (px) |
| | `consumeDamageGrowth` | 제거 1회당 블랙홀 틱 피해 증가량 |
| | `consumeDurationGrowth` | 제거 1회당 유지 시간 증가량 (ms) |

`electric_shock`는 접시 처치가 아니라 **커서 직격으로 발생한 `DISH_DAMAGED` 틱마다** 발동합니다.
어빌리티 소스(`byAbility=true`)로 발생한 피해에서는 전기 충격이 다시 발동하지 않습니다.

`orbiting_orb`는 폭탄을 구슬로 제거하면 오버클럭이 발동합니다.
오버클럭은 `overclockDurationMs` 동안 유지되며, 폭탄 추가 제거 시 스택이 1씩 증가(최대 `overclockMaxStacks`)하고 지속시간이 갱신됩니다.
회전 속도는 `1 + (overclockSpeedMultiplier - 1) * stack` 배율로 계산되어 짧은 버프형 템포 상승을 제공합니다.

`black_hole`는 중심 좌표와 반경이 모두 화면 안에 들어오도록 생성됩니다.
또한 폭탄 접시는 `bombConsumeRadiusRatio`로 계산된 중심 영역에 진입하면 `byAbility=true` 경로로 즉시 제거됩니다.
폭탄을 흡수하거나 블랙홀 틱 피해로 일반 접시를 처치하면, 해당 블랙홀 인스턴스의 반경/틱 피해/유지 시간이 즉시 증가합니다.
반경 증가 계산식은 `currentRadius * (1 + consumeRadiusGrowthRatio) + consumeRadiusGrowthFlat`이며, 각 블랙홀은 `duration` 만큼 독립적으로 유지된 후 소멸합니다.
새 블랙홀이 스폰되어도 기존 블랙홀의 남은 유지 시간은 보장됩니다.

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
      "duration": 7600,
      "spawnCount": 1,
      "radius": 150,
      "bombConsumeRadiusRatio": 0.3,
      "consumeRadiusGrowthRatio": 0,
      "consumeRadiusGrowthFlat": 5,
      "consumeDamageGrowth": 1,
      "consumeDurationGrowth": 500
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
  "moveSpeed": 206,       // 이동 속도 (px/sec, 하단 -> 상단)
  "visualSize": 28,       // 시각적 크기 (px)
  "hitboxSize": 35,       // 히트박스 크기 (px) - 클수록 획득 쉬움
  "cooldown": 15000,      // 스폰 쿨다운 (ms)
  "maxActive": 1,         // 동시에 존재 가능한 최대 개수
  "baseSpawnChance": 0.04, // 스폰 체크 1회당 기본 확률
  "checkInterval": 5000,  // 스폰 확률 체크 간격 (ms)
  "preMissWarningDistance": 120, // 화면 상단 이탈 전 경고 이벤트 트리거 거리(px, 소멸선 기준)
  "preMissWarningTextOffsetY": 14 // 경고 텍스트 Y 오프셋(px, 힐팩 기준, 양수일수록 아래)
}
```

---

### falling-bomb.json

낙하 폭탄 시스템을 설정합니다. 화면 상단에서 하단으로 떨어지는 위험 오브젝트입니다.

```json
{
  "moveSpeed": 80,           // 이동 속도 (px/sec, 상단 -> 하단)
  "visualSize": 24,          // 시각적 크기 (px)
  "hitboxSize": 30,          // 히트박스 크기 (px)
  "cooldown": 12000,         // 스폰 쿨다운 (ms)
  "maxActive": 2,            // 동시에 존재 가능한 최대 개수
  "baseSpawnChance": 0.06,   // 스폰 체크 1회당 기본 확률
  "checkInterval": 4000,     // 스폰 확률 체크 간격 (ms)
  "playerDamage": 1,         // 커서 접촉 시 플레이어 데미지
  "resetCombo": true,        // 커서 접촉 시 콤보 리셋 여부
  "minWave": 4               // 최소 등장 웨이브 (이 웨이브 이전에는 스폰 안 됨)
}
```

**특성**:
- 금구슬(`OrbSystem`)과 블랙홀(`BlackHoleSystem`)에 의해 `byAbility=true`로 제거 가능
- 기존 폭탄 접시와 동일한 제거 규칙(오버클럭 발동, 블랙홀 성장) 적용
- 화면 하단 이탈 시 데미지 없이 사라짐
- 외형은 `DishRenderer.renderDangerDish()` 재사용

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

#### 보스 공격 충전 에너지 수렴 (`bossAttack.charge.energyConverge`)

미사일 공격 충전 단계에서 커서 바깥쪽 백색 에너지가 안쪽으로 모이는 연출입니다.

```json
{
  "bossAttack": {
    "charge": {
      "energyConverge": {
        "color": "#ffffff",
        "particleCount": 56,
        "outerRadiusMultiplier": 3.6,
        "outerRadiusPadding": 92,
        "innerRadius": 3,
        "minParticleRadius": 2.4,
        "maxParticleRadius": 8.0,
        "swirlTurns": 3.8,
        "alphaMin": 0.35,
        "alphaMax": 1.0,
        "wobbleRadius": 20,
        "angleJitter": 1.1,
        "radiusJitter": 34,
        "alphaFlicker": 0.45,
        "chaosRateMin": 7,
        "chaosRateMax": 22
      }
    }
  }
}
```

- `color`: 수렴 입자 색상
- `particleCount`: 수렴 입자 개수
- `outerRadiusMultiplier`: 시작 반경 계산 시 `cursorRadius * multiplier` 계수
- `outerRadiusPadding`: 시작 반경 계산 시 `cursorRadius + padding` 여유값
- `innerRadius`: 충전 완료 시 입자가 모이는 반경
- `minParticleRadius`/`maxParticleRadius`: 입자 크기 범위
- `swirlTurns`: 충전 동안 입자가 회전하는 총 바퀴 수
- `alphaMin`/`alphaMax`: 충전 진행도에 따른 알파 범위
- `wobbleRadius`: 수렴 중 진동(노이즈) 반경
- `angleJitter`: 각도 불규칙 흔들림 강도 (라디안)
- `radiusJitter`: 반경 불규칙 흔들림 강도 (px)
- `alphaFlicker`: 알파 깜빡임 강도 (0~1)
- `chaosRateMin`/`chaosRateMax`: 불규칙 진동 속도 범위

#### 미사일 발사 직전 커서 글로우 (`bossAttack.fire.preFireGlow`)

미사일이 발사되기 직전, 커서 주변에 짧은 백색 글로우 펄스를 표시합니다.

```json
{
  "bossAttack": {
    "fire": {
      "preFireGlow": {
        "color": "#ffffff",
        "duration": 90,
        "outerRadiusMultiplier": 1.25,
        "outerRadiusPadding": 12,
        "maxScale": 1.35,
        "alpha": 0.45,
        "ringWidth": 2,
        "ringAlpha": 0.9
      }
    }
  }
}
```

- `color`: 발사 직전 글로우 색상
- `duration`: 글로우 펄스 지속 시간(ms)
- `outerRadiusMultiplier`: 기본 시작 반경 계수 (`cursorRadius * multiplier`)
- `outerRadiusPadding`: 시작 반경 여유값 (`cursorRadius + padding`)
- `maxScale`: 펄스 종료 시 반경 확장 배율
- `alpha`: 채움 글로우 최대 알파
- `ringWidth`: 외곽 링 두께
- `ringAlpha`: 외곽 링 최대 알파

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
