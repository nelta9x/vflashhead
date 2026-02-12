# 🗺️ CODEMAP: FLASHEAD Project Structure

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
  - 연결 지점: `PlayerTickSystem.renderCursor()`에서 현재/최대 HP를 `CursorRenderer.renderAttackIndicator()`로 전달
  - 설정 파일: `data/game-config.json`의 `player.hpRing`
- **보스 HP 표시**
  - 렌더링 위치: `src/effects/BossRenderer.ts` (호출 지점: `EntityRenderSystem` → `BossRenderer`)
  - 데이터 소스: `MonsterSystem`가 발행하는 `MONSTER_HP_CHANGED` (`bossId`, `current`, `max`, `ratio`)
  - 세그먼트 계산: `src/entities/bossHpSegments.ts`의 `resolveBossHpSegmentState()`
  - 설정 파일: `data/boss.json`의 `visual.armor`, `visual.armor.hpSegments`
  - 동작 원칙: **아머 실루엣 조각 개수 자체가 HP 슬롯 수**를 표현하며, 규칙은 **100 HP = 1 슬롯(올림)** 입니다.
- **주의**
  - `data/game-config.json`의 `hud.hpDisplay`는 현재 상단 하트 UI 렌더링에 사용되지 않습니다(레거시/예약 설정).

### 1. 진입점 및 씬 (Scenes)

- **`src/main.ts`**: 게임 인스턴스 생성 및 씬 등록 (`Boot`, `Menu`, `Game`, `GameOver`).
- **`src/scenes/BootScene.ts`**: 초기 로딩 화면. 에셋 프리로딩(오디오, SVG 아이콘), 프로그레스 바 표시.
- **`src/scenes/MenuScene.ts`**: 메인 메뉴 오케스트레이터. 타이틀/시작 UI와 배경 렌더러를 구성하고, 언어 위젯/입력/앰비언트 시뮬레이션은 보조 모듈에 위임합니다.
- **`src/scenes/GameScene.ts`**: **핵심 게임 루프 오케스트레이터**. 시스템/렌더러를 초기화하고 `update()`에서 파이프라인을 실행합니다.
  - **update() 4단계 구조**: 입력 처리(`processKeyboardInput`) → pause 체크 → `entitySystemPipeline.run(delta)` → scene 비주얼(`updateSceneVisuals`).
  - **World.context 동기화**: `syncWorldContext()`에서 gameTime/currentWave/playerId를 한 번만 갱신. 시스템은 `world.context`에서 직접 읽음.
  - **모든 tick 로직은 파이프라인 안**: 개별 시스템의 tick/update를 Scene에서 직접 호출하지 않음. 게임 레벨 시스템(Wave/Combo/StatusEffect/BossCoordinator/Mod)도 래퍼 EntitySystem으로 파이프라인에 통합.
  - **입력 안정화**: 키보드 축 이동 적용은 Scene에서 수행하되, 리스너 바인딩/해제는 `SceneInputAdapter`로 위임합니다.
  - **전투/접시 규칙 위임**: 보스 전투, 플레이어 특수공격, 접시 라이프사이클은 전용 모듈로 분리되어 Scene은 호출만 담당합니다.
- **`src/scenes/GameOverScene.ts`**: 게임 오버 화면. 최종 스탯(최대 콤보, 웨이브, 생존 시간) 표시, 재시작 안내, 페이드 전환.

### 1.5 GameScene 보조 모듈 (`src/scenes/game/`)

- **`BossCombatCoordinator.ts`**: 멀티 보스 동기화, 보스 스폰 배치, 레이저 스케줄/취소/충돌, 보스 접촉 데미지, 보스 스냅샷 제공. `forEachBoss(cb)` 로 활성 보스 엔티티를 외부에 노출 (ECS 시스템 순회용).
  - 내부 분해: `boss/BossRosterSync.ts`, `boss/BossLaserController.ts`, `boss/BossContactDamageController.ts`
- **`PlayerAttackController.ts`**: 게이지 공격(차지/순차 미사일/재타겟), 미사일 경로 접시 제거, 치명타 시 레이저 취소 처리.
- **`DishLifecycleController.ts`**: `DISH_DESTROYED/DISH_DAMAGED/DISH_MISSED` 처리, 접시 스폰(폭탄 경고 포함), 전기 충격(직접 커서 히트 기반)/자기장/커서 범위 판정.
  - 내부 분해: `dish/DishSpawnService.ts`, `dish/DishResolutionService.ts`, `dish/DishFieldEffectService.ts`
- **`GameSceneEventBinder.ts`**: `EventBus` 구독/해제 일원화 및 payload 라우팅.
- **`SceneInputAdapter.ts`**: pointer/ESC/blur/visibility/gameout 입력 리스너 등록·해제 전담.
- **`GameSceneContracts.ts`**: 모듈 간 공유 타입 및 최소 게이트웨이 인터페이스(`BossInteractionGateway`, `DishSpawnDelegate`) 정의.
- **`CursorPositionProvider.ts`**: Scene/포인터/명시 provider 우선순위로 커서 좌표를 해석하는 공용 유틸.
- **`src/scenes/menu/`**:
  - `LanguageSelectorWidget.ts`: 언어 토글 UI + safe area 판정
  - `MenuInputController.ts`: native `pointerdown`(마우스+터치+펜 통합) 입력 브릿지 및 리스너 정리
  - `MenuAmbientController.ts`: 메뉴 커서 추적/배경 접시 시뮬레이션

### 2. 핵심 게임 로직 (Systems)

`src/systems/` 디렉토리에는 특정 기능을 담당하는 독립적인 클래스들이 위치합니다.

- **`WaveSystem.ts`**: 웨이브 오케스트레이터. 내부 계산은 `systems/wave/*` 모듈에 위임합니다.
  - `wave/WaveConfigResolver.ts`: 웨이브/무한/피버 구성 계산 (`infiniteScaling`의 amber 도입 램프와 dish weight 정규화 포함)
  - `wave/WavePhaseController.ts`: waiting/countdown/spawning 상태와 카운트다운 이벤트 틱
  - `wave/WaveSpawnPlanner.ts`: 접시 타입 롤 + 스폰 위치 제약 검증(보스/접시 거리)
- **`waveBossConfig.ts`**: 웨이브별 보스 구성 해석 유틸리티. `bossTotalHp`/`hpWeight` 분배, 무한 웨이브 보스 수/총 HP 스케일링(`bossTotalHpIncrease`, `infiniteBossCount`)을 공용 계산합니다.
- **`ComboSystem.ts`**: 콤보 증가, 타임아웃 처리, 마일스톤 관리. 콤보 수치에 따라 `COMBO_MILESTONE` 이벤트를 발생시켜 연출을 트리거합니다.
- **`UpgradeSystem.ts`**: 업그레이드 파사드. 내부 상태/선택/설명/카드 프리뷰 모델 생성을 분리 모듈로 위임합니다.
  - `upgrades/UpgradeStateStore.ts`: 스택 상태 저장
  - `upgrades/UpgradeRarityRoller.ts`: 희귀도 가중치 기반 선택
  - `upgrades/UpgradeDescriptionFormatter.ts`: 로케일 템플릿 기반 설명 문자열 생성
  - `upgrades/UpgradePreviewModelBuilder.ts`: `previewDisplay` 스키마 기반 카드 프리뷰 모델(`현재 -> 다음`, 델타/직접+간접 수치) 생성
- **`HealthSystem.ts`**: 플레이어 HP 관리. 데미지 수신 시 `HP_CHANGED` 이벤트를 발행하며, 현재 HP는 `GameScene -> CursorRenderer` 경로로 커서 통합형 링에 반영됩니다. HP가 0이 되면 `GAME_OVER` 발생.
- **`MonsterSystem.ts`**: 보스 몬스터 HP/사망 상태를 `bossId`별 `Map`으로 관리합니다. 웨이브 시작 시 `bossTotalHp`를 가중치(`hpWeight`) 기반으로 분배하고, `MONSTER_HP_CHANGED`/`MONSTER_DIED`를 `bossId` 스냅샷 payload로 발행합니다. `destroy()` 메서드로 EventBus 리스너 해제.
- **`OrbSystem.ts`**: `EntitySystem` 구현. 플레이어 주변을 회전하는 보호 오브(Orb)의 로직 처리. World query로 접시/폭탄 충돌을 판정하며, 업그레이드 레벨에 따른 개수/속도/데미지 계산 및 자석(Magnet) 업그레이드와의 시너지(크기 증가)를 관리합니다. 또한 오브가 폭탄을 제거하면 짧은 오버클럭 버프를 발동해 회전 속도를 일시적으로 가속하며, 버프는 스택/지속시간 데이터(`overclockDurationMs`, `overclockSpeedMultiplier`, `overclockMaxStacks`)로 제어됩니다.
- **`BlackHoleSystem.ts`**: `EntitySystem` 구현. 블랙홀 어빌리티 로직 처리. World query로 접시·폭탄을 조회하며, 레벨 데이터(`spawnInterval`, `spawnCount`, `radius`, `force`, `damageInterval`, `damage`, `bombConsumeRadiusRatio`, `consumeRadiusGrowthRatio`, `consumeRadiusGrowthFlat`, `consumeDamageGrowth`) 기반으로 주기적 랜덤 블랙홀을 생성/교체하고, 접시·폭탄 흡인, 중심 반경 진입 폭탄의 `byAbility` 제거, 접시/보스 피해 틱을 적용합니다. 각 블랙홀은 폭탄을 흡수하거나 블랙홀 틱 피해로 접시를 처치하면 개별적으로 반경/틱 피해가 증가하며, 다음 스폰 교체 시 기본 수치로 초기화됩니다.
- **`PlayerCursorInputController.ts`**: `GameScene` 전용 입력 컨트롤러. 디지털 키 입력을 축(axis)으로 변환하고, 키다운 시 축 가속(0→1), 포인터 최신 입력 우선 유예, 입력 리셋/리스너 해제를 단일 책임으로 관리합니다.
- **`GaugeSystem.ts`**: 콤보 수치에 따라 공격 게이지를 충전합니다. 게이지가 100%가 되면 `PLAYER_ATTACK` 이벤트를 발생시킵니다.
- **`ScoreSystem.ts`**: 접시 파괴 시 점수 계산 및 콤보 배율 적용.
- **`SoundSystem.ts`**: Phaser Sound API 및 Web Audio API 기반 사운드 시스템. 오디오 파일 재생을 우선하며, 부재 시 코드로 사운드를 합성(Fallback)합니다. 마스터 볼륨 제어, 일시정지 상태 복구 지원.
- **`FeedbackSystem.ts`**: 시각적/청각적 피드백을 조율. `ParticleManager`, `ScreenShake`, `DamageText`를 통합 제어하여 타격감을 생성합니다. 보스 아머 파괴 및 플레이어 필살기 연출을 총괄합니다.
- **`HealthPackSystem.ts`**: `EntitySystem` 구현. World query(`C_HealthPack`, `C_Transform`)로 힐팩 엔티티를 관리합니다. 기본 확률과 업그레이드 보너스를 기반으로 힐팩을 스폰하며, Phaser Container를 직접 생성하고 World에 컴포넌트로 등록합니다.
- **`FallingBombSystem.ts`**: `EntitySystem` 구현. World query(`C_FallingBomb`, `C_Transform`)로 낙하 폭탄 엔티티를 관리합니다. 특정 웨이브(`minWave`) 이후부터 화면 위에서 아래로 떨어지는 낙하 폭탄을 확률 기반으로 스폰합니다. 커서 접촉 시 데미지를 주며, 금구슬(`OrbSystem`)와 블랙홀(`BlackHoleSystem`)에 의해 제거될 수 있습니다.

### 2.5 MOD 인프라

MOD가 커스텀 상태효과, 크로스 엔티티 상호작용, 매 프레임 시스템을 등록할 수 있는 경량 기반.

- **`StatusEffectManager.ts`** (`src/systems/`): 엔티티별 상태효과 관리. `applyEffect(entityId, effect)`, `removeEffect(entityId, effectId)`, `tick(delta)` (만료 자동 제거 + `onExpire` 콜백), `clearEntity(entityId)` (엔티티 비활성화 시 전체 제거). **내장 효과**: `freeze` (Infinity 지속, 수동 제거), `slow` (유한 지속, factor 데이터). MOD가 커스텀 `StatusEffect` 구현체를 등록하여 새로운 상태효과를 추가할 수 있다.
- **`EntityQueryService.ts`** (`src/systems/`): dishPool(`ObjectPool<Entity>`)을 감싸는 읽기 전용 쿼리 파사드. `getActiveEntities()`, `forEachActive(cb)`, `getEntitiesInRadius(x, y, r)`, `getEntitiesWithCondition(pred)`. `setBossProvider(provider)` 호출 시 보스 엔티티도 포함하여 조회. MOD에 엔티티 접근을 제공한다.
- **`ModSystemRegistry.ts`** (`src/plugins/`): MOD 커스텀 시스템 등록/실행 레지스트리. `registerSystem(id, tickFn, priority?)` → `runAll(delta, context)`. context로 `{ entities: EntityQueryService, statusEffectManager, eventBus }` 제공. GameScene.update() 끝에서 호출.
- **`entity-systems/`** (`src/systems/entity-systems/`): 13개 독립 ECS 시스템으로 분리. 각 시스템은 `EntitySystem` 인터페이스(`id`, `enabled`, `tick(delta)`)를 구현하며 World 스토어를 직접 쿼리하여 단일 관심사만 처리.
  - `EntitySystem.ts`: 공통 인터페이스 (`id: string`, `enabled: boolean`, `tick(delta): void`)
  - `EntityStatusSystem` (`core:entity_status`): SEM → freeze/slow 캐시 파생
  - `EntityTimingSystem` (`core:entity_timing`): effectiveDelta, 시간 누적, lifetime 만료
  - **`PlayerTickSystem` (`core:player`)**: Player entity의 위치 보간(smoothing), 커서 트레일, 커서 렌더링 처리. World store에서 읽고 CursorRenderer/CursorTrail에 위임. `renderOnly(delta)` 메서드로 pause 시 visual만 실행.
  - `EntityMovementSystem` (`core:entity_movement`): 이동 전략 실행 + 보스 오프셋 / wobble
  - `BossReactionSystem` (`core:boss_reaction`): `BossStateComponent` 기반 보스 피격/사망 리액션 트윈
  - `MagnetSystem` (`core:magnet`): 자석 어빌리티 접시 흡인 로직 (World query 기반)
  - `CursorAttackSystem` (`core:cursor_attack`): 커서 DPS/접촉/폭발 상호작용 (World query 기반)
  - `EntityVisualSystem` (`core:entity_visual`): pull/hitFlash/blink/dangerVibration
  - `EntityRenderSystem` (`core:entity_render`): World → Phaser Container 동기화 + DishRenderer/BossRenderer 렌더 + typePlugin.onUpdate
- **`src/systems/`의 EntitySystem 구현들**: 파이프라인에 참여하는 4개 시스템이 root systems에 위치.
  - `BlackHoleSystem` (`core:black_hole`): World query로 접시/폭탄 흡인 + 피해 + 렌더링
  - `OrbSystem` (`core:orb`): World query로 접시/폭탄 충돌 판정 + 렌더링
  - `FallingBombSystem` (`core:falling_bomb`): World query로 낙하 폭탄 스폰/이동/충돌 + 커서 충돌 체크
  - `HealthPackSystem` (`core:health_pack`): World query로 힐팩 스폰/이동/충돌 + 수집 체크
- **게임 레벨 래퍼 시스템들** (`src/systems/entity-systems/`): 기존 게임 레벨 로직을 EntitySystem 인터페이스로 감싸 파이프라인에 통합.
  - `WaveTickSystem` (`core:wave`): WaveSystem.update() + currentWave 동기화
  - `ComboTickSystem` (`core:combo`): ComboSystem.setWave() + update()
  - `StatusEffectTickSystem` (`core:status_effect_tick`): StatusEffectManager.tick()
  - `BossCoordinatorSystem` (`core:boss_coordinator`): BossCombatCoordinator.update()
  - `ModTickSystem` (`core:mod_tick`): ModSystemRegistry.runAll()
- **`EntitySystemPipeline.ts`** (`src/systems/`): data-driven 엔티티 시스템 실행 파이프라인. `game-config.json`의 `entityPipeline` 배열이 실행 순서의 SSOT (18개 시스템). `register(system)`, `unregister(id)`, `setEnabled(id, enabled)`, `run(delta)`. config 순서대로 배치 → config에 없는 등록 시스템은 끝에 추가. `getMissingSystems()`, `getUnmappedSystems()`, `getRegisteredIds()` 진단 메서드 제공.
  - GameScene 호출 순서: `syncWorldContext()` → `entitySystemPipeline.run(delta)` (18개 시스템 순차, 모든 tick 로직 포함)
  - 파이프라인 순서: wave → combo → status_effect_tick → entity_status → entity_timing → player → entity_movement → boss_reaction → boss_coordinator → magnet → cursor_attack → black_hole → orb → falling_bomb → health_pack → entity_visual → entity_render → mod_tick
- **`builtin/systems/GameLevelSystemsPlugin.ts`**: ComboTickSystem + StatusEffectTickSystem을 파이프라인에 등록하는 SystemPlugin.
- **`Entity.ts` 연동**: 경량 Phaser wrapper (~182줄). `deactivate()` 시 `StatusEffectManager.clearEntity()` 및 `World.destroyEntity()` 자동 호출로 풀 반환 시 잔류 효과/컴포넌트 방지. `spawn()` 시 `EntitySpawnInitializer`를 통해 World 컴포넌트를 초기화. freeze/slow는 StatusEffectManager로 위임. 모든 tick 로직은 외부 ECS 시스템이 World 스토어를 직접 읽어 처리.

### 2.7 ECS World & 컴포넌트 (Phase 4~5)

`src/world/` 디렉토리에는 컴포넌트 기반 ECS 인프라가 위치합니다.

- **`ComponentDef.ts`**: `ComponentDef<T>` 토큰 인터페이스 + `defineComponent<T>(name)` 팩토리. MOD가 커스텀 컴포넌트를 정의할 수 있음.
- **`ComponentStore.ts`**: `Map<string, T>` 기반 제네릭 컴포넌트 저장소. `set`/`get`/`getRequired`/`has`/`delete`/`forEach`/`entities`/`size`/`clear` API.
- **`components.ts`**: 17개 컴포넌트 인터페이스 + `C_Xxx` Def 토큰 정의.
  - 태그 (2): `C_DishTag`, `C_BossTag`
  - Entity용 (C1~C11): `C_Identity`, `C_Transform`, `C_Health`, `C_StatusCache`, `C_Lifetime`, `C_DishProps`, `C_CursorInteraction`, `C_VisualState`, `C_Movement`, `C_PhaserNode`, `C_BossState`
  - 특수 엔티티용 (2): `C_FallingBomb`, `C_HealthPack`
  - Player용 (P1~P2): `C_PlayerInput`, `C_PlayerRender`
- **`archetypes.ts`**: `ArchetypeDefinition` (ComponentDef 토큰 배열), `ArchetypeRegistry` (등록/조회/해제), 빌트인 5개 아키타입 (player/dish/boss/fallingBomb/healthPack).
- **`World.ts`**: 동적 스토어 레지스트리 + entity lifecycle 관리 + `context: GameContext` (gameTime/currentWave/playerId 글로벌 상태). `register(def)`/`store(def)`/`getStoreByName()`/`unregisterStore()` + `spawnFromArchetype()` + `archetypeRegistry` + `query()` 제너레이터. 빌트인 17개 스토어는 typed property로 직접 접근 가능 (기존 호환). `query(C_DishTag, C_DishProps, C_Transform)` → `[id, ...components]` 튜플 제너레이터.
- **`GameContext.ts`**: `GameContext` 인터페이스 정의. 시스템이 `setContext()` 대신 `world.context`에서 글로벌 게임 상태를 직접 읽음.
- **시스템 파이프라인**: 13개 시스템이 World 스토어를 직접 읽음 (Entity tick 메서드 없음). 모든 컴포넌트는 순수 데이터 (클래스 인스턴스 없음). `MovementComponent`는 `{type, homeX, homeY, drift}` 순수 데이터.
- **GameScene 연결**: `initializeSystems()`에서 World 생성 + `spawnFromArchetype()` 기반 player 등록, `cleanup()`에서 `world.clear()` 호출. 커서 위치는 `world.transform.get('player')` 에서 읽음.

### 2.6 플러그인 아키텍처

`src/plugins/` 디렉토리에는 확장 가능한 플러그인 시스템이 위치합니다. 코어 코드 수정 없이 새 콘텐츠를 추가할 수 있도록 설계되었습니다.

- **`PluginRegistry.ts`**: 어빌리티 및 엔티티 타입 플러그인을 등록/조회하는 싱글톤. `unregisterAbility(id)` / `unregisterEntityType(typeId)` 메서드로 MOD teardown 시 등록 해제 지원.
- **`types/`**: 플러그인 인터페이스 정의.
  - `AbilityPlugin.ts`: 어빌리티 플러그인 인터페이스, `UpgradeSystemCore`, `AbilityContext`, `DerivedStatEntry`.
  - `EntityTypePlugin.ts`: 엔티티 타입 플러그인 인터페이스, `EntityTypeRenderer`, `DamageSource`.
  - `MovementStrategy.ts`: 이동 전략 인터페이스 (DriftMovement 등).
  - `AttackPattern.ts`: 공격 패턴 인터페이스 (LaserAttackPattern 등).
  - `ModTypes.ts`: MOD 계약 인터페이스. `ModModule` (MOD 진입점), `ModContext` (레지스트리 + `world` + `archetypeRegistry` 전달), `ModFactory` (지연 생성), `ScopedEventBus` (구독 추적 인터페이스).
- **`ModRegistry.ts`**: MOD 라이프사이클 관리자. **스냅샷 diff**로 `registerMod()` 전후 레지스트리 상태를 비교하여 MOD가 등록한 ability/entityType/modSystem/entitySystem/archetype/store를 추적. `unloadMod()` / `unloadAll()` 시 diff 기반 일괄 해제 + ScopedEventBus 구독 정리.
- **`ScopedEventBusWrapper.ts`**: MOD별 EventBus 구독 추적 래퍼. `on()`/`once()`/`off()` 위임 + 내부 tracking, `removeAll()`로 일괄 해제.
- **`ModLoader.ts`**: MOD 모듈 해석 + 에러 격리 전담. `ModFactory` → `ModModule` 변환, `load()` (단일), `loadMultiple()` (순차, 실패 건너뜀) 제공.
- **`builtin/abilities/`**: 내장 어빌리티 플러그인 (CursorSize, CriticalChance, Missile, HealthPack, Magnet, ElectricShock, Orb, BlackHole).
- **`builtin/entities/`**: 내장 엔티티 타입 플러그인 (BasicDish, BombDish, StandardBoss).
- **`builtin/movement/DriftMovement.ts`**: Boss 사인파 드리프트 이동 전략.
- **`AbilityManager.ts`** (`src/systems/`): 어빌리티 플러그인의 init/update/clear/destroy 라이프사이클 통합 관리.

### 3. 엔티티 및 오브젝트 (Entities)

`src/entities/` 디렉토리에는 Dish/Boss용 Phaser wrapper 엔티티가 위치하며, `ObjectPool<Entity>`에 의해 재사용됩니다. FallingBomb과 HealthPack은 각각의 시스템(`FallingBombSystem`, `HealthPackSystem`)이 World 컴포넌트로 직접 관리합니다.

- **`Entity.ts`**: Dish + Boss를 통합하는 경량 Phaser wrapper (~182줄). `EntityTypePlugin`을 통해 행동을 주입받으며, `Poolable`을 구현합니다. 모든 상태는 World 스토어에 저장되며, Entity 자체는 Phaser Container/Graphics/Body 참조만 보유합니다. `spawn()` 시 `EntitySpawnInitializer`를 통해 World 컴포넌트를 초기화하고, `deactivate()` 시 `World.destroyEntity()` + `StatusEffectManager.clearEntity()` 호출.
- **`EntitySpawnInitializer.ts`**: Entity spawn 시 World 컴포넌트 초기화를 담당하는 순수 함수.
- **`EntitySnapshot.ts`**: 이벤트 payload에 사용되는 엔티티 값 스냅샷 타입. 객체 참조 대신 좌표/수치를 복사하여 전달.
- **`EntityTypes.ts`**: `DishUpgradeOptions` 인터페이스 정의.
- **`bossHpSegments.ts`**: 보스 HP 세그먼트 상태 계산 유틸리티.

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
  - **`PlayerAttackRenderer.ts`**: 플레이어 필살기(충전 글로우/커서 외곽 백색 에너지 수렴/발사 직전 커서 글로우/전기 스파크/미사일 트레일/폭탄 경고) 연출 렌더러.
  - **`CursorRenderer.ts`**: 메뉴/인게임 커서 외형, 공격 게이지, 자기장/전기 충격 범위, 그리고 플레이어 HP 세그먼트 링을 통합 렌더링.
  - **`ParticleManager.ts`**: 커서 좌표 조회를 `CursorPositionProvider` 기반으로 통합해 Scene duck-typing 중복을 제거.
- **`src/ui/`**:
  - `HUD`: HUD 오케스트레이터. 매 프레임 컨텍스트(커서 위치, 업그레이드 선택 상태)를 받아 표시 정책을 적용하며, 도크바 hover 진행도(기본 1.2초 누적 정지)를 씬에 제공합니다.
  - `hud/AbilitySummaryWidget`: 보유 어빌리티 슬롯 렌더링, 도크 영역(맥OS 스타일 오버레이/게이지/재개 힌트) 렌더링, hover 영역 계산(기본 폭 또는 어빌리티 수에 따라 확장), 슬롯 hover 툴팁 카드(아이콘/이름/레벨/설명) 렌더링을 담당합니다. 도크가 열린 동안에만 슬롯과 슬롯 툴팁을 표시합니다.
  - `hud/AbilityDockRenderer.ts`: 도크 오버레이/정지 게이지 드로잉 전용 렌더 유틸.
  - `hud/AbilityTooltipLayout.ts`: 툴팁 화면 내 배치(clamp) 계산 유틸.
  - `hud/DockPauseController`: 도크바 hover 누적 시간(기본 1200ms) 기반으로 게임 일시정지 조건을 계산하는 상태 컨트롤러.
  - `hud/WaveTimerWidget`: 웨이브/생존 시간 텍스트와 피버 상태 렌더링.
  - `hud/WaveTimerVisibilityPolicy`: 웨이브/생존 시간 노출 규칙(업그레이드 페이즈 우선, hover 기반 표시) 판단.
  - `InGameUpgradeUI`: 웨이브 사이 업그레이드 선택 화면 (3개 선택지, 호버 프로그레스 바, 레어리티 색상, 구조화된 능력치 비교 카드 렌더 호출).
  - `upgrade/UpgradeSelectionRenderer.ts`: 업그레이드 카드 배경/진행바 렌더 및 안전 Y 위치 계산 유틸.
  - `upgrade/UpgradeCardContentRenderer.ts`: 카드 본문 렌더 전담 (`Lv.cur -> Lv.next`, 변경 수치 행 리스트).
  - `DamageText`: 타격 시 데미지 수치 팝업 (오브젝트 풀링, 크리티컬 색상 처리).
  - `WaveCountdownUI`: 다음 웨이브 시작 전 카운트다운 표시.
  - `upgrade/UpgradeIconCatalog.ts`: 업그레이드 fallback 아이콘/심볼 SSOT.

---

## 💾 데이터 및 설정 (Data Management)

모든 설정은 **Data-Driven** 방식으로 관리됩니다. 코드에 숫자를 하드코딩하지 마십시오.

- **`src/data/DataManager.ts`**: 모든 JSON 데이터를 로드하여 타입 안전하게 제공하는 싱글톤 (`Data` 상수로 내보냄). 다국어 번역(`t()`) 및 템플릿 치환(`formatTemplate()`) 기능 포함.
- **`src/data/types.ts`**: 모든 JSON 데이터 구조에 대한 TypeScript 인터페이스 정의.
- **`src/data/types/`**: 도메인별 타입 진입점 (`gameConfig.ts`, `feedback.ts`, `waves.ts`, `upgrades.ts`, `index.ts`).
- **`src/data/constants.ts`**: JSON 기반 데이터 중 코드에서 자주 쓰이는 물리/기하학적 상수.
- **`src/data/game.config.ts`**: Phaser 엔진 기술 설정 (물리, 렌더링, 스케일, 오디오 등).
- **데이터 파일 목록 (`data/*.json`)**:
  - `game-config.json`: 전역 설정, 기본 언어(`defaultLanguage`), 플레이어 스탯, UI 레이아웃, 폰트 설정, 레이저 공격, 자기장 설정, **렌더 레이어 깊이(`depths`)** — 모든 `setDepth()` 값의 SSOT. **`entityPipeline`**: 18개 엔티티 시스템 실행 순서 배열 (게임 레벨 5개 + 엔티티 13개). **`systemPlugins`**: 서비스/시스템 플러그인 활성화 목록.
  - `locales.json`: 다국어(EN, KO) 번역 데이터 및 업그레이드 설명/카드 라벨 템플릿 (`upgrade.stat.*`, `upgrade.card.*`).
  - `main-menu.json`: 메인 메뉴 씬 설정 (별 배경, 보스 애니메이션, 메뉴 접시 스폰, 언어 UI 설정).
  - `colors.json`: 게임 내 모든 색상 팔레트 및 테마 (숫자값/hex).
  - `entities.json` (신규): dishes.json + boss.json을 통합한 엔티티 타입 정의. 접시/보스 모두 동일한 스키마로 관리하며, `cursorInteraction`, `isGatekeeper`, `movement`, `visual` 등 타입별 설정 포함.
  - `dishes.json`: 적 종류별 체력, 크기, 수명, 특수 속성 설정 (레거시, entities.json으로 마이그레이션 예정).
  - `waves.json`: 웨이브별 구성, 난이도 곡선, 멀티 보스 구성(`bossTotalHp`, `bosses[]`, `bossSpawnMinDistance`), 무한 웨이브 스케일링 설정(`infiniteBossCount`, `amberStart*`, `maxAmberWeight`, `dishTypeScaling[]` 포함).
  - `boss.json`: 보스 비주얼 및 공격 설정 (레거시, entities.json으로 마이그레이션 예정).
  - `upgrades.json`: 업그레이드 어빌리티 정의, 확률(Rarity), 효과 수치, 카드 프리뷰 표시 스키마(`previewDisplay`).
  - `feedback.json`: 연출용 수치 (흔들림 강도, 파티클 개수, 슬로우모션 강도, 커서 트레일 설정).
  - `combo.json`: 콤보 타임아웃, 마일스톤, 배율 공식, 게이지 보너스.
  - `health-pack.json`: 힐팩 기본 스폰 확률, 이동 속도 등 설정.
  - `falling-bomb.json`: 낙하 폭탄 이동 속도, 스폰 확률, 피해, 최소 등장 웨이브 등 설정.
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
|                   | `HEALTH_PACK_UPGRADED`  | 힐팩 업그레이드 적용 시        | `UpgradeSystem`   | `GameScene` (최대 HP 증가 로직)        |
| **힐팩**          | `HEALTH_PACK_SPAWNED`   | 힐팩 스폰 시                   | `HealthPack`      | —                                      |
|                   | `HEALTH_PACK_PASSING`   | 힐팩 상단 이탈 직전            | `HealthPack`      | `GameScene` (피드백 텍스트)            |
|                   | `HEALTH_PACK_COLLECTED` | 힐팩 획득 시                   | `HealthPack`      | `HealthPackSystem`, `GameScene`        |
|                   | `HEALTH_PACK_MISSED`    | 힐팩 놓쳤을 때                 | `HealthPack`      | `HealthPackSystem`                     |
| **낙하 폭탄**     | `FALLING_BOMB_SPAWNED`  | 낙하 폭탄 스폰 시             | `FallingBomb`     | —                                      |
|                   | `FALLING_BOMB_DESTROYED`| 낙하 폭탄 제거 시             | `FallingBomb`     | `FallingBombSystem`, `GameScene`       |
|                   | `FALLING_BOMB_MISSED`   | 낙하 폭탄 하단 이탈 시        | `FallingBomb`     | `FallingBombSystem`                    |
| **보스 & 게이지** | `MONSTER_HP_CHANGED`    | `bossId`별 보스 HP 변화 시     | `MonsterSystem`   | `Boss`, `GameScene`                    |
|                   | `MONSTER_DIED`          | `bossId`별 보스 사망 시        | `MonsterSystem`   | `Boss`, `GameScene`                    |
|                   | `GAUGE_UPDATED`         | 게이지 수치 변경 시            | `GaugeSystem`     | `GameScene`                            |
|                   | `PLAYER_ATTACK`         | 게이지 완충 후 공격 시         | `GaugeSystem`     | `GameScene`                            |
| **블랙홀**        | `BLACK_HOLE_CONSUMED`   | 블랙홀이 폭탄/접시 흡수 시     | `BlackHoleSystem` | `GameScene` (피드백 텍스트)            |

---

## 🛠️ 주요 유틸리티

- **`ObjectPool.ts`**: 빈번하게 생성/삭제되는 `Entity` (Dish/Boss) 리소스를 관리하여 가비지 컬렉션 부하를 줄임. FallingBomb/HealthPack은 World 컴포넌트로 관리되어 ObjectPool을 사용하지 않음.
- **`EventBus.ts`**: 전역 이벤트 발행/구독 시스템 및 모든 게임 이벤트 상수(`GameEvents`)가 정의된 곳.
- **`cursorSmoothing.ts`**: 적응형 커서 스무딩 순수 함수. 거리 기반 lerp 보간 + 프레임 독립 보정을 수행하며, `snapRadius(= max(convergenceThreshold, deadZone))` 이하에서 즉시 snap하여 정지 버그를 방지합니다.

---

## 💡 새로운 기능 추가 가이드

1. **데이터 정의**: `data/*.json`에 필요한 상수나 설정을 먼저 추가합니다.
2. **타입 정의**: `src/data/types.ts`에 새 데이터 구조의 인터페이스를 정의합니다.
3. **시스템 작성/수정**: `src/systems/`에 로직을 구현합니다.
4. **이벤트 연결**: 새로운 상태 변화가 있다면 `GameEvents`에 추가하고 `EventBus`로 알립니다.
5. **파이프라인 등록**: 새 tick 로직은 `EntitySystem` 구현 + `game-config.json`의 `entityPipeline`에 등록. `GameScene.update()`에 직접 호출 추가 금지.
6. **테스트 작성**: `tests/` 디렉토리에 Vitest 기반의 단위 테스트를 추가합니다.
7. **문서 최신화**: 변경 사항이 구조적이라면(시스템/렌더러 추가, 이벤트 변경 등) 반드시 `CODEMAP.md`를 업데이트합니다.

---

## 🧪 테스트 실행

```bash
npm test              # Watch 모드 (개발 중 자동 재실행)
npm run test:run      # 1회 실행 (CI/검증용)
npm test -- <path>    # 특정 파일만 테스트
```
