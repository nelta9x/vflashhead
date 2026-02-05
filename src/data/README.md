# 게임 데이터 가이드

이 디렉토리의 JSON 파일을 수정하여 게임 밸런스를 조절할 수 있습니다.

---

## 목차

1. [빠른 시작: 무엇을 수정하려면?](#빠른-시작-무엇을-수정하려면)
2. [파일별 상세 가이드](#파일별-상세-가이드)
   - [game-config.json](#game-configjson)
   - [waves.json](#wavesjson)
   - [dishes.json](#dishesjson)
   - [combo.json](#combojson)
   - [upgrades.json](#upgradesjson)
   - [health-pack.json](#health-packjson)
   - [feedback.json](#feedbackjson)
   - [spawn.json](#spawnjson)
   - [colors.json](#colorsjson)
   - [weapons.json](#weaponsjson)

---

## 빠른 시작: 무엇을 수정하려면?

| 수정 목표 | 파일 | 필드 |
|----------|------|------|
| **전체 난이도 조절** | `waves.json` | `spawnInterval`, `dishTypes` |
| **접시 체력/점수** | `dishes.json` | `hp`, `points` |
| **접시 생존 시간** | `dishes.json` | `lifetime` |
| **콤보 타임아웃** | `combo.json` | `timeout.base`, `timeout.minimum` |
| **콤보 배율** | `combo.json` | `multiplier.factor` |
| **업그레이드 출현율** | `upgrades.json` | `rarityWeights` |
| **업그레이드 효과** | `upgrades.json` | `weapon`, `system` |
| **힐팩 스폰 확률** | `health-pack.json` | `spawnChanceByHp` |
| **플레이어 초기 HP** | `game-config.json` | `player.initialHp` |
| **커서 크기** | `game-config.json` | `player.cursorHitbox.baseRadius` |
| **웨이브 지속 시간** | `waves.json` | `duration` |
| **콤보 이펙트 강도** | `feedback.json` | `comboMilestones` |

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
    }
  },
  "upgradeUI": {
    "boxWidth": 200,    // 업그레이드 선택 박스 너비
    "boxHeight": 100,   // 업그레이드 선택 박스 높이
    "boxSpacing": 30,   // 박스 간 간격
    "hoverDuration": 300, // 호버 후 선택까지 시간 (ms)
    "boxYOffset": 120   // 화면 하단에서의 거리
  },
  "waveTransition": {
    "countdownDuration": 3000  // 웨이브 시작 전 카운트다운 (ms)
  },
  "magnet": {
    "baseRadius": 70,       // 자기장 기본 범위 (px)
    "radiusPerLevel": 25,   // 레벨당 추가 범위
    "baseForce": 30,        // 기본 당기는 힘 (px/sec)
    "forcePerLevel": 20,    // 레벨당 추가 힘
    "minPullDistance": 30   // 최소 당김 거리
  }
}
```

---

### waves.json

웨이브 시스템과 난이도 곡선을 설정합니다.

#### 최상위 필드

| 필드 | 설명 |
|------|------|
| `duration` | 각 웨이브 지속 시간 (ms). 현재 20000 = 20초 |
| `waves` | 웨이브 1~12 설정 배열 |
| `fever` | 피버 타임 설정 |
| `infiniteScaling` | 웨이브 12 이후 무한 스케일링 공식 |

#### 개별 웨이브 설정

```json
{
  "number": 1,           // 웨이브 번호
  "name": "시작",        // 표시 이름
  "dishCount": 3,        // 한 번에 활성화되는 최대 접시 수 (현재 미사용)
  "spawnInterval": 1000, // 접시 스폰 간격 (ms). 낮을수록 빠름
  "dishTypes": [         // 접시 종류별 출현 가중치
    { "type": "basic", "weight": 0.8 },
    { "type": "golden", "weight": 0.1 },
    { "type": "bomb", "weight": 0.1 }
  ]
}
```

**dishTypes 가중치 계산**: 모든 weight의 합 대비 각 weight의 비율이 출현 확률
- 예: basic=0.8, golden=0.1, bomb=0.1 → basic 80%, golden 10%, bomb 10%

#### 무한 스케일링 (웨이브 12 이후)

```json
{
  "spawnIntervalReduction": 20,  // 웨이브당 스폰 간격 감소 (ms)
  "minSpawnInterval": 150,       // 최소 스폰 간격
  "bombWeightIncrease": 0.02,    // 웨이브당 폭탄 가중치 증가
  "maxBombWeight": 0.35,         // 폭탄 최대 가중치
  "goldenWeightDecrease": 0.01,  // 웨이브당 골든 가중치 감소
  "minGoldenWeight": 0.2         // 골든 최소 가중치
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
    "points": 100,          // 파괴 시 획득 점수
    "speed": 110,           // 이동 속도 (현재 미사용)
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
| `golden` | 높은 점수, 높은 HP |
| `crystal` | `chainReaction: true` - 파괴 시 주변 접시에 영향 |
| `bomb` | `dangerous: true`, `invulnerable: true` - 접촉 시 플레이어 피해, 파괴 불가 |
| `mini` | 낮은 HP, 빠른 소멸 |
| `boss` | 매우 높은 HP, 높은 점수 |

#### 데미지 설정

```json
{
  "damage": {
    "playerDamage": 10,    // 플레이어가 접시에 주는 기본 데미지
    "damageInterval": 200  // 데미지 적용 간격 (ms). 커서가 접시 위에 있을 때
  }
}
```

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

#### 무기 업그레이드

```json
{
  "weapon": {
    "common": [
      {
        "id": "rapid_fire",          // 고유 ID
        "name": "연사력 증가",        // 표시 이름
        "description": "발사 속도가 25% 증가합니다.",
        "stat": "fireRate",          // 영향받는 스탯
        "multiply": 1.25,            // 배율 (곱연산)
        "maxStack": 5                // 최대 중첩 횟수
      },
      {
        "id": "flat_damage",
        "stat": "damage",
        "add": 5,                    // 가산 (덧셈)
        "maxStack": 10
      }
    ]
  }
}
```

**스탯 종류**: `damage`, `fireRate`, `projectileSpeed`, `projectileCount`, `criticalChance`, `criticalMultiplier`

**특수 업그레이드**:
```json
{
  "special": "piercing",  // 특수 효과: piercing, explosive, homing
  "maxStack": 1
}
```

**콤보 업그레이드** (여러 효과 동시 적용):
```json
{
  "combo": [
    { "stat": "damage", "add": 50 },
    { "stat": "fireRate", "multiply": 2 }
  ]
}
```

#### 시스템 업그레이드

```json
{
  "system": [
    {
      "id": "cursor_size",
      "name": "넓은 타격",
      "description": "커서 판정 범위가 6% 증가합니다.",
      "rarity": "rare",
      "effectType": "cursorSizeBonus",  // 효과 타입
      "value": 0.06,                    // 적용 값
      "maxStack": 5
    }
  ]
}
```

**effectType 종류**:
- `cursorSizeBonus`: 커서 크기 증가 (value = 비율)
- `electricShockLevel`: 전기 충격 레벨 (value = 레벨 증가량)
- `magnetLevel`: 자기장 레벨 (value = 레벨 증가량)

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
  "spawnChanceByHp": {    // HP별 초당 스폰 확률
    "5": 0,               // HP 5: 0% (스폰 안 함)
    "4": 0.02,            // HP 4: 2%
    "3": 0.04,            // HP 3: 4%
    "2": 0.06,            // HP 2: 6%
    "1": 0.10             // HP 1: 10%
  }
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
      "shakeDuration": 200,
      "slowMotion": 0.3,    // 슬로우모션 속도 (0.3 = 30% 속도)
      "slowDuration": 500   // 슬로우모션 지속 시간 (ms)
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
  "dynamicSpawn": {
    "minActiveDishes": 2,     // 최소 유지할 활성 접시 수
    "emergencyInterval": 300, // 긴급 스폰 간격 (ms) - 접시가 너무 적을 때
    "lowActiveInterval": 500  // 저활성 스폰 간격 (ms)
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

## 밸런스 팁

1. **난이도 곡선**: `waves.json`의 `spawnInterval`을 조절. 웨이브 1은 1000ms, 웨이브 12는 200ms가 기본값.

2. **점수 경제**: `dishes.json`의 `points` 값을 조절. 현재 비율은 basic:golden:crystal = 1:4:2.5

3. **콤보 시스템**:
   - 쉽게 만들려면: `combo.json`의 `timeout.base` 증가, `timeout.minimum` 증가
   - 어렵게 만들려면: 반대로 조절

4. **업그레이드 파워**: `upgrades.json`에서 `multiply` 값을 조절. 1.25 = 25% 증가.

5. **생존성**: `health-pack.json`의 `spawnChanceByHp`를 조절하여 힐팩 출현율 변경.
