# 🗺️ CODEMAP: FLASHHEAD Project Structure

이 문서는 개발자와 AI 에이전트가 프로젝트의 구조를 빠르게 파악하고 필요한 기능을 찾을 수 있도록 돕기 위해 작성되었습니다.

- 디자인 철학 참고:
  - `GAME_DESIGN_PHILOSOPHY.md` (인게임 통합 UI, 최소 UI 노출)
  - `VISUAL_STYLE_GUIDELINES.md` (보스 HP 실루엣, 형태/스타일 제약)

## 🏗️ 전체 아키텍처 및 흐름

### 0. 설계 원칙: 외형과 로직의 분리

본 프로젝트는 **관심사의 분리(SoC)**를 위해 로직 제어층과 시각 렌더링층을 엄격히 분리합니다.

- **Scene/System**: 게임의 상태(State)와 규칙(Rule)을 관리합니다. "무엇이 어디에 있는가?"와 "무슨 일이 일어나는가?"를 결정합니다.
- **Renderer (src/effects/)**: 전달받은 상태를 바탕으로 화면에 그립니다. "어떻게 보이는가?"를 결정하며, `Phaser.Graphics` API를 전담하여 사용합니다.
- **이점**: 로직의 변경 없이 Renderer만 교체하여 게임의 테마나 그래픽 스타일을 완전히 바꿀 수 있습니다.

### 0.5 빠른 탐색: 체력 표시(중요)

이 프로젝트의 체력 표시는 일반적인 "상단 가로 바"가 아니라 **인게임 오브젝트 통합형**입니다.

- **플레이어 HP 표시**
  - 렌더링 위치: `src/effects/CursorRenderer.ts`의 `drawHpRing()`
  - 데이터 소스: `HealthSystem` (`getHp()`, `getMaxHp()`)
  - 연결 지점: `src/scenes/GameScene.ts`의 `updateAttackRangeIndicator()`에서 현재/최대 HP를 `CursorRenderer.renderAttackIndicator()`로 전달
  - 설정 파일: `data/game-config.json`의 `player.hpRing`
- **보스 HP 표시**
  - 렌더링 위치: `src/effects/BossRenderer.ts` (호출 지점: `src/entities/Boss.ts`)
  - 데이터 소스: `MonsterSystem`가 발행하는 `MONSTER_HP_CHANGED` (`bossId`, `current`, `max`, `ratio`)
  - 세그먼트 계산: `src/entities/bossHpSegments.ts`의 `resolveBossHpSegmentState()`
  - 설정 파일: `data/boss.json`의 `visual.armor`, `visual.armor.hpSegments`
  - 동작 원칙: **아머 실루엣 조각 개수 자체가 HP 슬롯 수**를 표현하며, 규칙은 **100 HP = 1 슬롯(올림)** 입니다.
- **주의**
  - `data/game-config.json`의 `hud.hpDisplay`는 현재 상단 하트 UI 렌더링에 사용되지 않습니다(레거시/예약 설정).

### 1. 진입점 및 씬 (Scenes)

- **`src/main.ts`**: 게임 인스턴스 생성 및 씬 등록 (`Boot`, `Menu`, `Game`, `GameOver`).
- **`src/scenes/BootScene.ts`**: 초기 로딩 화면. 에셋 프리로딩(오디오, SVG 아이콘), 프로그레스 바 표시.
- **`src/scenes/MenuScene.ts`**: 메인 메뉴. 타이틀, 시작 버튼, 별 배경, 보스 애니메이션, 그리드 효과, 언어 선택 UI 처리.
- **`src/scenes/GameScene.ts`**: **핵심 게임 루프**. 모든 시스템을 초기화하고 조율합니다.
  - **플레이어 공격**: 게이지 완충 시 기 모으기(Charge) 및 순차 미사일(Sequential Missiles) 발사 로직을 관리하며, 시각 연출은 `PlayerAttackRenderer`에 위임합니다.
  - **보스 공격**: 멀티 보스(`Map<string, Boss>`) 기준으로 보스별 레이저 타이밍/취소/재개를 독립 제어합니다.
  - **블랙홀 어빌리티**: `BlackHoleSystem`의 흡인/피해 로직과 `BlackHoleRenderer`의 시각 연출을 매 프레임 동기화합니다.
  - **보스 타겟팅**: 미사일은 발사 시점의 nearest alive boss를 선택하고, 비행 중 타겟 사망 시 nearest alive boss로 재타겟합니다.
  - **충돌 감지**: 커서 범위 공격, 레이저 피격, 힐팩 수집, 보스 겹침(보스 주기 피해/플레이어 무피해) 등의 실시간 충돌을 판정합니다.
- **`src/scenes/GameOverScene.ts`**: 게임 오버 화면. 최종 스탯(최대 콤보, 웨이브, 생존 시간) 표시, 재시작 안내, 페이드 전환.

### 2. 핵심 게임 로직 (Systems)

`src/systems/` 디렉토리에는 특정 기능을 담당하는 독립적인 클래스들이 위치합니다.

- **`WaveSystem.ts`**: 웨이브 구성, 적 스폰 타이밍, 카운트다운 관리. `waves.json` 설정(`bosses`, `bossSpawnMinDistance` 포함)을 기반으로 하며, 접시 스폰 시 활성 보스 전체와의 거리 검증을 수행합니다.
- **`waveBossConfig.ts`**: 웨이브별 보스 구성 해석 유틸리티. `bossTotalHp`/`hpWeight` 분배, 무한 웨이브 보스 수/총 HP 스케일링(`bossTotalHpIncrease`, `infiniteBossCount`)을 공용 계산합니다.
- **`ComboSystem.ts`**: 콤보 증가, 타임아웃 처리, 마일스톤 관리. 콤보 수치에 따라 `COMBO_MILESTONE` 이벤트를 발생시켜 연출을 트리거합니다.
- **`UpgradeSystem.ts`**: 플레이어 어빌리티 관리 및 업그레이드 효과 적용. `upgrades.json`의 확률 기반으로 선택지를 생성합니다. 다국어 템플릿 치환 로직 포함.
- **`HealthSystem.ts`**: 플레이어 HP 관리. 데미지 수신 시 `HP_CHANGED` 이벤트를 발행하며, 현재 HP는 `GameScene -> CursorRenderer` 경로로 커서 통합형 링에 반영됩니다. HP가 0이 되면 `GAME_OVER` 발생.
- **`MonsterSystem.ts`**: 보스 몬스터 HP/사망 상태를 `bossId`별 `Map`으로 관리합니다. 웨이브 시작 시 `bossTotalHp`를 가중치(`hpWeight`) 기반으로 분배하고, `MONSTER_HP_CHANGED`/`MONSTER_DIED`를 `bossId` 스냅샷 payload로 발행합니다.
- **`OrbSystem.ts`**: 플레이어 주변을 회전하는 보호 오브(Orb)의 로직 처리. 업그레이드 레벨에 따른 개수/속도/데미지 계산 및 자석(Magnet) 업그레이드와의 시너지(크기 증가)를 관리합니다.
- **`BlackHoleSystem.ts`**: 블랙홀 어빌리티 로직 처리. 레벨 데이터(`spawnInterval`, `spawnCount`, `radius`, `force`, `damageInterval`, `damage`) 기반으로 주기적 랜덤 블랙홀을 생성/교체하고, 접시·폭탄 흡인 및 접시/보스 피해 틱을 적용합니다.
- **`GaugeSystem.ts`**: 콤보 수치에 따라 공격 게이지를 충전합니다. 게이지가 100%가 되면 `PLAYER_ATTACK` 이벤트를 발생시킵니다.
- **`ScoreSystem.ts`**: 접시 파괴 시 점수 계산 및 콤보 배율 적용.
- **`SoundSystem.ts`**: Phaser Sound API 및 Web Audio API 기반 사운드 시스템. 오디오 파일 재생을 우선하며, 부재 시 코드로 사운드를 합성(Fallback)합니다. 마스터 볼륨 제어, 일시정지 상태 복구 지원.
- **`FeedbackSystem.ts`**: 시각적/청각적 피드백을 조율. `ParticleManager`, `ScreenShake`, `DamageText`를 통합 제어하여 타격감을 생성합니다. 보스 아머 파괴 및 플레이어 필살기 연출을 총괄합니다.
- **`HealthPackSystem.ts`**: 기본 확률과 업그레이드 보너스를 기반으로 힐팩을 스폰합니다.

### 3. 엔티티 및 오브젝트 (Entities)

`src/entities/` 디렉토리에는 물리적인 게임 오브젝트가 위치하며, `Dish`와 `HealthPack`은 `ObjectPool`에 의해 재사용됩니다.

- **`Dish.ts`**: 주요 적인 '접시'.
  - `spawn()`: 초기화 및 애니메이션 시작.
  - `applyDamage()`: HP 감소 및 파괴 로직.
  - `update()`: 생존 시간 체크 및 이동 로직.
  - 외형 렌더링: `DishRenderer`에 위임 (인게임/메뉴 공용 스타일).
- **`Boss.ts`**: 보스 몬스터의 로직 엔티티. 각 인스턴스는 자신의 `bossId` 이벤트(`MONSTER_HP_CHANGED`/`MONSTER_DIED`)만 처리하며, 시각화는 `BossRenderer`에 위임합니다.
- **`HealthPack.ts`**: 낙하하는 힐 아이템 오브젝트. 커서와 충돌 시 `HEALTH_PACK_COLLECTED` 이벤트를 발생시키며, 외형 렌더링은 `HealthPackRenderer`에 위임합니다.

### 4. 시각 효과 및 UI (Effects & UI)

- **`src/effects/`**:
  - `ParticleManager`: 폭발 및 피격 파티클 생성.
  - `ScreenShake`: 카메라 흔들림 효과.
  - `CursorTrail`: 커서의 움직임을 따라가는 잔상 효과.
  - `StarBackground`: 별 배경 애니메이션 (반짝임, 수직 스크롤).
  - **`GridRenderer.ts`**: 배경 그리드의 원근감 렌더링 로직 (공유 가능).
  - **`LaserRenderer.ts`**: 보스의 레이저 공격 경고 및 발사 연출 렌더러.
  - **`BossRenderer.ts`**: 인게임 보스 코어/아머/글로우 렌더링 전담 클래스. `Boss` 엔티티가 상태를 전달해 그리기를 위임합니다.
  - **`OrbRenderer.ts`**: 플레이어 보호 오브의 글로우 및 전기 스파크 연출 렌더러.
  - **`BlackHoleRenderer.ts`**: 블랙홀 코어/링/글로우/아크 노이즈를 렌더링하는 전용 렌더러.
  - **`MenuBossRenderer.ts`**: 메인 메뉴 보스의 화려한 애니메이션 렌더링.
  - **`DishRenderer.ts`**: 접시 외형 렌더링 전담 클래스. `Dish` 엔티티의 인게임 접시 및 `MenuScene` 배경 접시를 공용 렌더링합니다.
  - **`HealthPackRenderer.ts`**: 힐팩 외형 렌더링 전담 클래스.
  - **`PlayerAttackRenderer.ts`**: 플레이어 필살기(충전 글로우/전기 스파크/미사일 트레일/폭탄 경고) 연출 렌더러.
  - **`CursorRenderer.ts`**: 메뉴/인게임 커서 외형, 공격 게이지, 자기장/전기 충격 범위, 그리고 플레이어 HP 세그먼트 링을 통합 렌더링.
- **`src/ui/`**:
  - `HUD`: HUD 오케스트레이터. 매 프레임 컨텍스트(커서 위치, 업그레이드 선택 상태)를 받아 표시 정책을 적용하며, 도크바 hover 진행도(기본 1.2초 누적 정지)를 씬에 제공합니다.
  - `hud/AbilitySummaryWidget`: 보유 어빌리티 슬롯 렌더링, 도크 영역(맥OS 스타일 오버레이/게이지/재개 힌트) 렌더링, hover 영역 계산(기본 폭 또는 어빌리티 수에 따라 확장), 슬롯 hover 툴팁 카드(아이콘/이름/레벨/설명) 렌더링을 담당합니다. 도크가 열린 동안에만 슬롯과 슬롯 툴팁을 표시합니다.
  - `hud/DockPauseController`: 도크바 hover 누적 시간(기본 1200ms) 기반으로 게임 일시정지 조건을 계산하는 상태 컨트롤러.
  - `hud/WaveTimerWidget`: 웨이브/생존 시간 텍스트와 피버 상태 렌더링.
  - `hud/WaveTimerVisibilityPolicy`: 웨이브/생존 시간 노출 규칙(업그레이드 페이즈 우선, hover 기반 표시) 판단.
  - `InGameUpgradeUI`: 웨이브 사이 업그레이드 선택 화면 (3개 선택지, 호버 프로그레스 바, 레어리티 색상).
  - `DamageText`: 타격 시 데미지 수치 팝업 (오브젝트 풀링, 크리티컬 색상 처리).
  - `WaveCountdownUI`: 다음 웨이브 시작 전 카운트다운 표시.

---

## 💾 데이터 및 설정 (Data Management)

모든 설정은 **Data-Driven** 방식으로 관리됩니다. 코드에 숫자를 하드코딩하지 마십시오.

- **`src/data/DataManager.ts`**: 모든 JSON 데이터를 로드하여 타입 안전하게 제공하는 싱글톤 (`Data` 상수로 내보냄). 다국어 번역(`t()`) 및 템플릿 치환(`formatTemplate()`) 기능 포함.
- **`src/data/types.ts`**: 모든 JSON 데이터 구조에 대한 TypeScript 인터페이스 정의.
- **`src/data/constants.ts`**: JSON 기반 데이터 중 코드에서 자주 쓰이는 물리/기하학적 상수.
- **`src/data/game.config.ts`**: Phaser 엔진 기술 설정 (물리, 렌더링, 스케일, 오디오 등).
- **데이터 파일 목록 (`data/*.json`)**:
  - `game-config.json`: 전역 설정, 기본 언어(`defaultLanguage`), 플레이어 스탯, UI 레이아웃, 폰트 설정, 레이저 공격, 자기장 설정.
  - `locales.json`: 다국어(EN, KO) 번역 데이터 및 업그레이드 설명 템플릿.
  - `main-menu.json`: 메인 메뉴 씬 설정 (별 배경, 보스 애니메이션, 메뉴 접시 스폰, 언어 UI 설정).
  - `colors.json`: 게임 내 모든 색상 팔레트 및 테마 (숫자값/hex).
  - `dishes.json`: 적 종류별 체력, 크기, 수명, 특수 속성 설정.
  - `waves.json`: 웨이브별 구성, 난이도 곡선, 멀티 보스 구성(`bossTotalHp`, `bosses[]`, `bossSpawnMinDistance`), 무한 웨이브 스케일링 설정.
  - `boss.json`: 보스 비주얼 및 공격 설정 (코어 반지름, 아머 조각, 아머 HP 세그먼트 스케일링, 레이저 공격).
  - `upgrades.json`: 업그레이드 어빌리티 정의, 확률(Rarity), 효과 수치.
  - `feedback.json`: 연출용 수치 (흔들림 강도, 파티클 개수, 슬로우모션 강도, 커서 트레일 설정).
  - `combo.json`: 콤보 타임아웃, 마일스톤, 배율 공식, 게이지 보너스.
  - `health-pack.json`: 힐팩 기본 스폰 확률, 낙하 속도 등 설정.
  - `spawn.json`: 스폰 영역(Area) 및 로직 설정.
  - `weapons.json`: 무기(공격) 기본 데미지 및 관련 데이터.

---

## 📡 통신 맵 (EventBus)

시스템 간의 결합도를 낮추기 위해 `EventBus`를 통한 이벤트 기반 통신을 사용합니다.
모든 이벤트 정의는 `src/utils/EventBus.ts`의 `GameEvents` 객체에 있습니다.

| 이벤트 카테고리   | 주요 이벤트             | 발생 시점                      | 발행자            | 주요 구독자                            |
| ----------------- | ----------------------- | ------------------------------ | ----------------- | -------------------------------------- |
| **접시(적)**      | `DISH_DESTROYED`        | 접시 파괴 시                   | `Dish`            | `GaugeSystem`, `GameScene`             |
|                   | `DISH_SPAWNED`          | 접시 스폰 시                   | `Dish`            | —                                      |
|                   | `DISH_DAMAGED`          | 접시 피격 시                   | `Dish`            | `GameScene`                            |
|                   | `DISH_MISSED`           | 접시가 놓쳤을 때 (수명 만료)   | `Dish`            | `GameScene`                            |
| **콤보**          | `COMBO_INCREASED`       | 콤보 증가 시                   | `ComboSystem`     | —                                      |
|                   | `COMBO_RESET`           | 콤보 리셋 시                   | `ComboSystem`     | —                                      |
|                   | `COMBO_MILESTONE`       | 특정 콤보 수 도달 시           | `ComboSystem`     | `GameScene`                            |
| **웨이브**        | `WAVE_STARTED`          | 웨이브 정식 시작 시            | `WaveSystem`      | `GameScene`, `MonsterSystem`, `GaugeSystem` |
|                   | `WAVE_COMPLETED`        | 모든 접시 처리 시              | `WaveSystem`      | `GameScene`                            |
|                   | `WAVE_COUNTDOWN_START`  | 카운트다운 시작 시             | `WaveSystem`      | —                                      |
|                   | `WAVE_COUNTDOWN_TICK`   | 카운트다운 틱마다              | `WaveSystem`      | `GameScene`                            |
|                   | `WAVE_READY`            | 카운트다운 완료, 웨이브 준비됨 | `WaveSystem`      | `GameScene`                            |
| **업그레이드**    | `UPGRADE_SELECTED`      | 업그레이드 선택 시             | `InGameUpgradeUI` | `GameScene`                            |
| **점수**          | `SCORE_CHANGED`         | 점수 갱신 시                   | `ScoreSystem`     | —                                      |
| **플레이어 상태** | `HP_CHANGED`            | 데미지/회복 발생 시            | `HealthSystem`    | `HealthPackSystem`, `GameScene`        |
|                   | `GAME_OVER`             | HP가 0이 될 때                 | `HealthSystem`    | `GameScene`                            |
|                   | `GAME_PAUSED`           | 게임 일시정지 시               | `GameScene`       | —                                      |
|                   | `GAME_RESUMED`          | 게임 재개 시                   | `GameScene`       | —                                      |
|                   | `HEALTH_PACK_UPGRADED`  | 힐팩 업그레이드 적용 시        | `UpgradeSystem`   | `GameScene` (최대 HP 증가 로직)        |
| **힐팩**          | `HEALTH_PACK_SPAWNED`   | 힐팩 스폰 시                   | `HealthPack`      | —                                      |
|                   | `HEALTH_PACK_COLLECTED` | 힐팩 획득 시                   | `HealthPack`      | `HealthPackSystem`, `GameScene`        |
|                   | `HEALTH_PACK_MISSED`    | 힐팩 놓쳤을 때                 | `HealthPack`      | `HealthPackSystem`                     |
| **보스 & 게이지** | `MONSTER_HP_CHANGED`    | `bossId`별 보스 HP 변화 시     | `MonsterSystem`   | `Boss`, `GameScene`                    |
|                   | `MONSTER_DIED`          | `bossId`별 보스 사망 시        | `MonsterSystem`   | `Boss`, `GameScene`                    |
|                   | `GAUGE_UPDATED`         | 게이지 수치 변경 시            | `GaugeSystem`     | `GameScene`                            |
|                   | `PLAYER_ATTACK`         | 게이지 완충 후 공격 시         | `GaugeSystem`     | `GameScene`                            |

---

## 🛠️ 주요 유틸리티

- **`ObjectPool.ts`**: 빈번하게 생성/삭제되는 `Dish`와 `HealthPack` 리소스를 관리하여 가비지 컬렉션 부하를 줄임.
- **`EventBus.ts`**: 전역 이벤트 발행/구독 시스템 및 모든 게임 이벤트 상수(`GameEvents`)가 정의된 곳.

---

## 💡 새로운 기능 추가 가이드

1. **데이터 정의**: `data/*.json`에 필요한 상수나 설정을 먼저 추가합니다.
2. **타입 정의**: `src/data/types.ts`에 새 데이터 구조의 인터페이스를 정의합니다.
3. **시스템 작성/수정**: `src/systems/`에 로직을 구현합니다.
4. **이벤트 연결**: 새로운 상태 변화가 있다면 `GameEvents`에 추가하고 `EventBus`로 알립니다.
5. **GameScene 연동**: `GameScene.initializeSystems()`에서 생성하고 `update()`에서 호출합니다.
6. **테스트 작성**: `tests/` 디렉토리에 Vitest 기반의 단위 테스트를 추가합니다.
7. **문서 최신화**: 변경 사항이 구조적이라면(시스템/렌더러 추가, 이벤트 변경 등) 반드시 `CODEMAP.md`를 업데이트합니다.

---

## 🧪 테스트 실행

```bash
npm test              # Watch 모드 (개발 중 자동 재실행)
npm run test:run      # 1회 실행 (CI/검증용)
npm test -- <path>    # 특정 파일만 테스트
```
