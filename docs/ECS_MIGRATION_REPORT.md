# ECS 마이그레이션 보고서

> 최종 수정: 2026-02-11
> 현재 Phaser 버전: `4.0.0-rc.6` (Phase 1 완료)

---

## 1. Phaser 4 현재 상태

### 릴리스 타임라인

| 날짜 | 버전 | 비고 |
|------|------|------|
| 2024-11 | v4.0.0-beta.1 | 첫 베타 |
| 2025-01~03 | Beta 4~8 | |
| 2025-04~05 | RC1~RC4 | |
| 2025-08 | RC5 | |
| 2025-12 | RC6 | "final RC", production-ready 선언 |
| **2026-02** | **아직 stable 없음** | npm `latest` = 3.90.0 |

### 핵심 사실

- **Phaser 4는 아직 stable 릴리스가 없다.** npm `latest` 태그는 여전히 3.90.0.
- RC6를 "production-ready"라고 했지만 최종 `4.0.0` 태그는 미발행.
- `npm install phaser@beta`로 RC6 설치 가능.
- 공식 마이그레이션 가이드가 **아직 없다** (약속만 반복됨).

---

## 2. bitECS 내장 확인

**확인됨: Phaser 4는 bitECS를 내부적으로 사용한다.**

(Dev Log 257, 260에서 확인)

- 모든 Game Object가 bitECS entity ID를 부여받음
- 내장 컴포넌트: Transform, Color, Permissions, Hierarchy
- TypedArray 기반 컨티구어스 메모리 → 캐시 친화적 이터레이션
- **OOP API는 그대로 보존됨** (`this.add.sprite(...)` 동일)
- 커스텀 컴포넌트/쿼리 생성 가능 (opt-in)
- 기존 코드를 수정하지 않아도 동작하며, ECS는 점진적으로 채택 가능

### FLASHEAD에 대한 의미

기존 Entity/ObjectPool/EventBus 패턴이 그대로 동작한다.
ECS 채택은 선택사항이며, 성능이 중요한 경로부터 점진적으로 적용 가능.

---

## 3. Phaser 3 → 4 Breaking Changes

### 3.1 FLASHEAD에 영향 없는 변경

| 변경 | 이유 |
|------|------|
| Mesh/Plane Game Object 제거 | 사용하지 않음 |
| `Phaser.Structs.Set` → native `Set` | 사용하지 않음 |
| `Geom.Point` 제거 (→ `Vector2`) | 사용하지 않음 (Circle/Rectangle만 사용) |
| `Math.TAU`/`Math.PI2` 의미 변경 | 사용하지 않음 |
| BitmapMask 제거 (→ Filter) | 사용하지 않음 |
| Impact Physics 제거 | 이미 3.23에서 제거됨 |
| Create Palettes/GenerateTexture 제거 | 사용하지 않음 |
| IE9 폴리필 제거 | 해당 없음 |

### 3.2 검증 필요한 변경

| 변경 | FLASHEAD 사용 현황 | 위험도 |
|------|-------------------|:---:|
| **WebGL 렌더러 전면 교체** (Pipeline → RenderNode) | 커스텀 파이프라인 미사용. Graphics 기반 렌더링만 사용 | 낮음 |
| **Graphics 성능 특성 변경** | 13개 파일에서 89회 사용 (Renderer 패턴). `pathDetailThreshold` 새 속성으로 성능 개선 가능 | 낮음 |
| **BlendModes** | 3곳 (`ParticleManager`, `GridRenderer`, `BossRenderer`). ADD/SCREEN 블렌드 모드 → v4 호환 확인 필요 | 중간 |
| **Container 성능** | Entity extends Container. v4에서 Shape+Sprite 혼합 시 batch 깨짐 이슈. FLASHEAD는 Graphics 기반이라 직접 영향 적을 수 있음 | 중간 |
| **`Phaser.Display.Color.HexStringToColor`** | 5개 파일 9회 사용 | 낮음 (API 보존) |
| **DynamicTexture** | 사용 안 함 | 없음 |
| **TileSprite 크롭 제거** | 사용 안 함 | 없음 |
| **Camera matrix 변경** | 직접 matrix 접근 없음 | 없음 |

### 3.3 보존된 API (FLASHEAD 핵심 사용)

| API | 사용량 | v4 상태 |
|-----|------:|--------|
| **Scene lifecycle** (create/update/init) | 4 Scene | 동일 |
| **Arcade Physics** | Entity constructor, body 조작 | 보존 (버그 수정됨) |
| **Tweens** (`scene.tweens.add`) | Entity, BossEntityBehavior, PlayerAttack 등 | 동일 |
| **Timers** (`scene.time.addEvent/delayedCall`) | Entity, WaveSystem 등 | 동일 |
| **Sound** | SoundSystem | 동일 |
| **`Phaser.Math.*`** | 100+ 사용 (Clamp, Distance.Between, Angle.Between, Between, FloatBetween, DegToRad, RadToDeg, Linear) | 동일 |
| **`Phaser.Geom.Circle/Rectangle`** | Entity, HealthPack, UI | 보존 |
| **Graphics** (`fillStyle`, `fillCircle`, `beginPath`, `arc`, `clear` 등) | 13개 렌더러 파일 | 보존 + 개선 |
| **Text** (`scene.add.text`, setFontSize, setColor 등) | 5개 UI 파일 | 보존 |
| **Input** (`scene.input`, pointer, activePointer) | SceneInputAdapter, Entity | 보존 |

---

## 4. FLASHEAD Phaser API 사용 감사 요약

### 코드베이스 규모
- 총 17,785줄 TypeScript (src/)
- 최대 파일: GameScene.ts (765줄), Entity.ts (696줄)

### Phaser API 사용 분포

| 카테고리 | 파일 수 | 사용 횟수 | v4 위험도 |
|---------|------:|--------:|:---:|
| Math 유틸리티 | ~20 | 100+ | 없음 |
| Graphics 렌더링 | 13 | 89 | 낮음 |
| Container/Transform | ~15 | 다수 | 낮음 |
| Tweens | ~8 | ~30 | 없음 |
| Timers | ~5 | ~10 | 없음 |
| Sound | 1 | ~5 | 없음 |
| Text/Style | 5 | 23 | 없음 |
| Geom (Circle/Rectangle) | ~8 | ~20 | 없음 |
| Color 유틸 | 5 | 9 | 낮음 |
| BlendModes | 3 | 3 | 중간 |
| Physics (Arcade) | ~3 | ~10 | 낮음 |
| Input | ~4 | ~15 | 없음 |

---

## 5. 마이그레이션 비용/이득 최종 평가

### 비용

| 항목 | 설명 |
|------|------|
| **Phaser 3 → 4 엔진 전환** | 대부분 "drop-in" 가능. BlendModes 3곳, Container 성능 프로파일링 필요. 총 ~10파일 수정 예상 |
| **ECS 도입 (Entity 컴포넌트 분해)** | Entity.ts 696줄 전면 재구조화. 45+ 파일 변경, 20+ 신규 파일. 308개 테스트 상당수 재작성 |
| **Phaser↔bitECS 브릿지** | Phaser 4가 내장 제공하므로 직접 구축 불필요 → 비용 대폭 감소 |

### 이득

| 이득 | 수준 |
|------|:---:|
| MOD 확장성 (커스텀 컴포넌트/시스템/쿼리) | 높음 |
| 엔티티 간 상호작용 (힐러 적, 버프 등) | 높음 |
| 플레이어 엔티티 통합 | 중간 |
| 테스트 용이성 (순수 데이터 컴포넌트) | 중간 |
| 성능 (bitECS TypedArray) | 낮음 (엔티티 ~50개 규모) |

### 리스크

| 리스크 | 심각도 |
|--------|:---:|
| **Phaser 4 stable 미출시** (RC6까지만) | 높음 |
| **공식 마이그레이션 가이드 부재** | 중간 |
| **기능 변경 없는 대규모 재작성 → 회귀 버그** | 높음 |
| **308개 테스트 재작성 중 커버리지 하락** | 중간 |

---

## 6. 결론 및 권장

### 원래 계획 검증 결과

원래 계획의 핵심 가정이 **대부분 정확**하다:

1. **bitECS 내장** → 확인됨. 자체 브릿지 불필요.
2. **OOP API 호환** → 확인됨. 점진적 ECS 채택 가능.
3. **대부분의 API 보존** → 확인됨. FLASHEAD의 핵심 API는 모두 보존.

### 수정이 필요한 가정

1. **"Phaser 4는 이미 출시됨"** → RC6까지만 있고 stable은 미출시. npm `latest`는 3.90.0.
2. **마이그레이션 가이드 존재** → 공식 가이드 없음. 분산된 릴리스 노트만 존재.

### 권장 경로 (수정판)

**Phase 0 완료. Phase 1 완료. Phase 2 (경량 MOD 인프라) 완료. Phase 2.1 (배관 연결 + freeze/slow 마이그레이션) 완료. Phase 2.2 (Entity.update() → ECS 스타일 시스템 분리) 완료. Phase 2.2 보완 (Data-driven Pipeline + 갭 수정) 완료. Phase 3 (MOD Loader & Lifecycle) 완료.**

### Phase 1 실행 결과 (2026-02-11)

- `phaser: "^3.70.0"` → `"4.0.0-rc.6"` 버전 고정
- **타입 에러 2건만 발생**: `fillPoints`/`strokePoints`가 `{x,y}` 리터럴 대신 `Phaser.Math.Vector2` 인스턴스를 요구
  - 수정 파일: `MenuBossRenderer.ts`, `ParticleManager.ts`
- BlendModes (`ADD`, `SCREEN`): 변경 없이 동작 (v4에서 열거형 보존)
- `generateTexture`: 변경 없이 동작 (v4에서 API 보존)
- 308 테스트 전체 통과 (mock 수정 불필요)
- lint, build 모두 통과

```
Phase 1: Phaser 3 → 4 엔진 전환 ✅ 완료
       ↓
Phase 2: 경량 MOD 인프라 ✅ 완료
  - StatusEffectManager (상태효과 부착/틱/만료)
  - ModSystemRegistry (MOD 커스텀 시스템 등록/실행)
  - EntityManager 쿼리 확장 (반경/조건 검색)
       ↓
Phase 2.1: 배관 연결 ✅ 완료
  - EntityQueryService (dishPool 읽기 전용 파사드 → ModSystemContext.entities)
  - Entity freeze/slow → StatusEffectManager 위임
  - statusEffectManager.tick() 호출 순서 최적화
       ↓
Phase 2.2: Entity.update() → ECS 스타일 시스템 분리 ✅ 완료
  - Entity.update() 제거, 5개 독립 시스템으로 분리
  - EntityStatusSystem / EntityTimingSystem / EntityMovementSystem / EntityVisualSystem / EntityRenderSystem
  - BossCombatCoordinator.updateBosses() 제거 → forEachBoss() 추가
       ↓
Phase 2.2 보완: Data-driven Pipeline + 갭 수정 ✅ 완료
  - EntitySystem 공통 인터페이스 (id, enabled, tick)
  - EntitySystemPipeline (game-config.json SSOT 순서)
  - EntityQueryService.setBossProvider() (보스 포함 쿼리)
       ↓
Phase 3: MOD Loader & Lifecycle ✅ 완료
  - ModRegistry (스냅샷 diff 추적 + 일괄 해제)
  - ScopedEventBusWrapper (MOD별 EventBus 구독 추적)
  - ModLoader (Factory 해석 + 에러 격리)
  - PluginRegistry unregister API
       ↓
Phase 4: 플레이어 Entity 통합
```

### Phase 2 실행 결과 (2026-02-11)

bitECS 검토 결과, 현재 규모(~50 엔티티)에서는 경량 확장이 동일한 MOD 시나리오를 1/5 비용으로 커버한다고 판단하여, 전면 ECS 도입 대신 경량 MOD 인프라를 구축했다.

**신규 파일:**
- `src/systems/StatusEffectManager.ts`: 엔티티별 상태효과(독/화상/버프/실드) 관리. `applyEffect`/`removeEffect`/`tick`/`clearEntity` API. MOD가 커스텀 StatusEffect를 구현하여 등록 가능.
- `src/plugins/ModSystemRegistry.ts`: MOD 커스텀 시스템 등록/우선순위 실행. `registerSystem(id, tickFn, priority)` → `runAll(delta, context)`.
- `tests/StatusEffectManager.test.ts`: 17 테스트
- `tests/ModSystemRegistry.test.ts`: 9 테스트

**수정 파일:**
- `src/systems/EntityManager.ts`: `getEntitiesInRadius(x, y, r)`, `getEntitiesWithCondition(predicate)` 쿼리 메서드 추가
- `src/entities/Entity.ts`: `deactivate()` 시 `StatusEffectManager.clearEntity()` 호출 (static 연결)
- `src/scenes/GameScene.ts`: `create()`에서 StatusEffectManager + ModSystemRegistry 초기화, `update()` 끝에서 `statusEffectManager.tick()` + `modSystemRegistry.runAll()` 호출, `cleanup()`에서 정리

**검증:**
- 334 테스트 전체 통과 (308 기존 + 26 신규)
- lint, build 모두 통과
- 기존 20+ 소비 파일 변경 없음

### Phase 2.1 실행 결과 (2026-02-11)

MOD 인프라 배관 연결 + Entity freeze/slow의 StatusEffectManager 마이그레이션.

**목표 달성:**
1. `ModSystemContext.entities`로 MOD가 활성 엔티티를 조회할 수 있게 연결
2. Entity의 하드코딩된 freeze/slow를 StatusEffectManager로 마이그레이션
3. `statusEffectManager.tick(delta)` 호출 순서를 엔티티 업데이트 **앞**으로 이동

**신규 파일:**
- `src/systems/EntityQueryService.ts`: dishPool 감싸는 읽기 전용 쿼리 파사드. `getActiveEntities()`, `forEachActive(cb)`, `getEntitiesInRadius(x, y, r)`, `getEntitiesWithCondition(pred)`.
- `tests/EntityQueryService.test.ts`: 10 테스트

**수정 파일:**
- `src/entities/Entity.ts`: `applySlow()`/`freeze()`/`unfreeze()` → StatusEffectManager 위임. `update()` 시작 시 SEM에서 `_isFrozen`/`slowFactor` 캐시 파생. `slowEndTime` 필드 제거.
- `src/plugins/ModSystemRegistry.ts`: `ModSystemContext.entityManager: EntityManager | null` → `entities: EntityQueryService`
- `src/scenes/GameScene.ts`: EntityQueryService 생성, `getModSystemContext()`에서 entities 제공, `statusEffectManager.tick(delta)` 호출을 엔티티 업데이트 **앞**으로 이동
- `tests/StatusEffectManager.test.ts`: freeze/slow 내장 효과 시나리오 7개 추가
- `tests/ModSystemRegistry.test.ts`: ModSystemContext mock 업데이트

**호출 순서 변경:**
```
이전: dish.update → ... → statusEffectManager.tick → modSystemRegistry.runAll
이후: statusEffectManager.tick → dish.update → ... → modSystemRegistry.runAll
```

**호출자 영향 없음:** BossLaserController, BossRosterSync, DishLike 인터페이스 — 공개 API 시그니처 동일.

**검증:**
- 351 테스트 전체 통과 (334 기존 + 17 신규)
- lint, build 모두 통과

### Phase 2.2 실행 결과 (2026-02-11)

Entity.update() 메서드를 제거하고 5개 독립 ECS 스타일 시스템으로 분리. Entity는 데이터 중심 컨테이너로, 업데이트 로직은 외부 시스템들이 담당.

**설계:**
- Entity.update() (~80줄) 제거
- 6개 tick 메서드 + getIsDead() getter 추가
- 5개 독립 시스템이 각각 단일 관심사를 담당

**GameScene 호출 순서:**
```
1. statusEffectManager.tick(delta)           // 글로벌 SEM 틱
2. entityStatusSystem.tick(entities)         // 캐시 파생
3. entityTimingSystem.tick(entities, delta)  // 시간 + lifetime
4. entityMovementSystem.tick(entities, delta)// 이동
5. entityVisualSystem.tick(entities, delta)  // 시각 상태
6. entityRenderSystem.tick(entities, delta)  // 렌더 + 플러그인
7. modSystemRegistry.runAll(delta, ctx)      // MOD 시스템
```

**신규 파일:**
- `src/systems/entity-systems/EntityStatusSystem.ts`: SEM → freeze/slow 캐시 파생
- `src/systems/entity-systems/EntityTimingSystem.ts`: effectiveDelta, 시간 누적, lifetime 만료
- `src/systems/entity-systems/EntityMovementSystem.ts`: 이동 전략 + 보스 오프셋 / wobble
- `src/systems/entity-systems/EntityVisualSystem.ts`: pull/hitFlash/blink/dangerVibration
- `src/systems/entity-systems/EntityRenderSystem.ts`: drawEntity + typePlugin.onUpdate
- `src/systems/entity-systems/index.ts`: barrel export
- `tests/entity-systems/` 5개 테스트 파일 (17 테스트)

**수정 파일:**
- `src/entities/Entity.ts`: update() 제거, 6 tick 메서드 + getIsDead() 추가
- `src/scenes/GameScene.ts`: 5 시스템 생성, collectActiveEntities(), update() 순서 변경
- `src/scenes/game/BossCombatCoordinator.ts`: updateBosses() 제거, forEachBoss() 추가
- `src/systems/EntityManager.ts`: updateAll()에서 tick 메서드 호출로 변경
- `tests/BossCombatCoordinator.test.ts`: mock Entity 업데이트

**ECS 이점:**
- 각 시스템을 독립적으로 활성화/비활성화 가능
- MOD가 시스템 사이에 커스텀 시스템 삽입 가능
- 각 시스템을 독립적으로 테스트 가능
- 향후 bitECS 마이그레이션 시 1:1 매핑

**검증:**
- 368 테스트 전체 통과 (351 기존 + 17 신규)
- lint, build 모두 통과

### Phase 2.2 보완: Data-driven Entity System Pipeline (2026-02-11)

Phase 2.2의 3가지 갭을 해소: (1) MOD가 코어 시스템 사이에 삽입 불가, (2) EntityQueryService가 boss 미포함, (3) 시스템 enable/disable API 부재.

**설계 결정:**
- `game-config.json`의 `entityPipeline` 배열이 시스템 실행 순서의 SSOT
- 5개 기존 시스템에 `EntitySystem` 인터페이스(`id`, `enabled`, `tick`) 적용
- `EntitySystemPipeline`: config 순서 기반 lazy rebuild, register/unregister/setEnabled
- `EntityQueryService.setBossProvider()`: 보스 포함 쿼리 지원
- `statusEffectManager.tick(delta)`은 엔티티 순회 시스템이 아니므로 파이프라인 밖 별도 호출 유지

**신규 파일:**
- `src/systems/entity-systems/EntitySystem.ts`: 공통 인터페이스
- `src/systems/EntitySystemPipeline.ts`: data-driven 파이프라인
- `tests/EntitySystemPipeline.test.ts`: 16 테스트

**수정 파일:**
- `data/game-config.json`: `entityPipeline` 배열 추가
- `src/data/types.ts`: `GameConfig.entityPipeline` 필드
- `src/systems/entity-systems/*.ts`: 5개 시스템 → `implements EntitySystem`, `id`, `enabled`, `Entity[]` 시그니처
- `src/systems/entity-systems/index.ts`: `EntitySystem` type export 추가
- `src/systems/EntityQueryService.ts`: `setBossProvider()` 추가
- `src/scenes/GameScene.ts`: 5 필드 → `entitySystemPipeline` 1개, `pipeline.run()`, boss provider 연결, cleanup

**GameScene 호출 순서 (변경 후):**
```
1. statusEffectManager.tick(delta)           // 글로벌 SEM 틱
2. entitySystemPipeline.run(entities, delta) // data-driven 순차 실행
   ├─ core:entity_status
   ├─ core:entity_timing
   ├─ core:entity_movement
   ├─ core:entity_visual
   └─ core:entity_render
3. modSystemRegistry.runAll(delta, ctx)      // MOD 시스템
```

**갭 해소 결과:**
1. MOD 시스템 삽입: `entitySystemPipeline.register(customSystem)` → config에 없으면 끝에 추가, config에 있으면 해당 위치에 배치
2. 보스 포함 쿼리: `entityQueryService.setBossProvider(provider)` → 4개 쿼리 메서드 모두 보스 포함
3. 시스템 enable/disable: `entitySystemPipeline.setEnabled(id, enabled)` → 런타임 토글

**검증:**
- 393 테스트 전체 통과 (368 기존 + 25 신규)
- lint, build 모두 통과

### Phase 3: MOD Loader & Lifecycle 실행 결과 (2026-02-11)

MOD 등록/해제 라이프사이클을 관리하는 최소 인프라 구축. 스냅샷 diff로 MOD가 등록한 리소스를 추적하고, 씬 전환 시 일괄 해제.

**설계 결정:**
- `ModContext`에 원본 레지스트리 직접 전달 (보안 불필요한 게임이므로 좁은 인터페이스 불필요)
- **스냅샷 diff**로 `registerMod()` 전후 레지스트리 상태 비교하여 MOD 리소스 추적
- `ScopedEventBusWrapper`로 MOD별 EventBus 구독만 추적 (EventBus는 스냅샷 diff 불가)
- `ModLoader`와 `ModRegistry` 책임 분리: ModLoader는 Factory 해석 + 에러 격리, ModRegistry는 라이프사이클 추적

**신규 파일:**
- `src/plugins/types/ModTypes.ts`: MOD 계약 인터페이스 (ModModule, ModContext, ModFactory, ScopedEventBus)
- `src/plugins/ScopedEventBusWrapper.ts`: MOD별 EventBus 구독 추적 래퍼
- `src/plugins/ModRegistry.ts`: MOD 라이프사이클 관리 (스냅샷 diff + 일괄 해제)
- `src/plugins/ModLoader.ts`: MOD 모듈 해석 + 에러 격리 + 로딩 오케스트레이션
- `tests/PluginRegistry.test.ts`: unregister 8 테스트
- `tests/ScopedEventBusWrapper.test.ts`: 래퍼 11 테스트
- `tests/ModRegistry.test.ts`: MOD 라이프사이클 18 테스트
- `tests/ModLoader.test.ts`: 로더 9 테스트

**수정 파일:**
- `src/plugins/PluginRegistry.ts`: `unregisterAbility(id)`, `unregisterEntityType(typeId)` 추가
- `src/plugins/types/index.ts`: ModTypes barrel export 추가
- `src/systems/EntitySystemPipeline.ts`: `getRegisteredIds()` 메서드 추가
- `src/scenes/GameScene.ts`: ModRegistry 생성 (`initializeSystems()`), `modRegistry.unloadAll()` (`cleanup()`)

**검증:**
- 439 테스트 전체 통과 (393 기존 + 46 신규)
- lint, build 모두 통과

### Phase 4a: 컴포넌트 인프라 실행 결과 (2026-02-11)

Entity.ts(752줄)의 God Object를 해소하기 위한 컴포넌트 시스템 구축. ComponentStore + World + 13개 컴포넌트 인터페이스 + dual-write 마이그레이션.

**설계 결정:**
- String entityId: 코드베이스 전체가 이미 string ID 사용. ~50 엔티티에서 TypedArray 불필요
- ComponentStore<T>: `Map<string, T>` 기반 제네릭 store. getRequired()로 런타임 안전성 확보
- Dual-write: Entity가 기존 필드 + World store에 동시 기록. 기존 코드 무변경으로 점진적 전환

**신규 파일:**
- `src/world/ComponentStore.ts`: 제네릭 컴포넌트 저장소
- `src/world/components.ts`: 13개 컴포넌트 인터페이스 (C1~C11 Entity + P1~P2 Player)
- `src/world/World.ts`: store 보유 + entity lifecycle (create/destroy/markDead/flushDead/query)
- `src/world/index.ts`: barrel export
- `tests/world/ComponentStore.test.ts`: store 테스트 (13)
- `tests/world/World.test.ts`: world 테스트 (17)

**수정 파일:**
- `src/entities/Entity.ts`: `static setWorld()`, `syncToWorld()` dual-write, `deactivate()` 시 `world.destroyEntity()` 호출
- `src/scenes/GameScene.ts`: World 생성 (`initializeSystems()`), player entity 등록, `cleanup()`에서 `world.clear()` 호출

### Phase 4b: Player Entity 통합 실행 결과 (2026-02-11)

Player를 ECS World의 entity로 통합. 커서 위치가 World store에서 관리되고, PlayerTickSystem이 smoothing/trail/render를 처리.

**설계 결정:**
- Player entity ID: `'player'` (고정 string). Transform/Health/StatusCache/PlayerInput/PlayerRender 5개 store 사용
- PlayerTickSystem: EntitySystem 인터페이스 구현, pipeline에서 entity_timing과 entity_movement 사이에 배치
- GameScene cursorX/Y 제거: 모든 커서 좌표 참조를 `world.transform.get('player')` 경유로 전환
- `renderOnly(delta)`: pause/upgrade 상태에서 smoothing 없이 visual + cursor render만 수행

**신규 파일:**
- `src/systems/entity-systems/PlayerTickSystem.ts`: Player tick 시스템 (smoothing + trail + cursor render)
- `tests/PlayerTickSystem.test.ts`: 14 테스트

**수정 파일:**
- `src/systems/entity-systems/index.ts`: PlayerTickSystem export 추가
- `src/scenes/GameScene.ts`: cursorX/Y/targetCursorX/Y/gaugeRatio 필드 제거, playerTickSystem 추가, update() 리팩토링 (keyboard→pipeline→cursor-dependent systems), getPlayerTransform()/getPlayerInput()/snapPlayerToTarget() 추가, applyCursorPosition/applyKeyboardMovement/updateCursorSmoothing/updateAttackRangeIndicator 제거
- `data/game-config.json`: entityPipeline에 `core:player` 추가 (6개 시스템)

**검증:**
- 483 테스트 전체 통과 (469 기존 + 14 신규)
- lint, build 모두 통과

### Phase 4c: ComponentDef 토큰 + Archetype + 시스템 → World 스토어 읽기 (2026-02-11)

**완료 항목:**
1. `ComponentDef<T>` 토큰 인프라 (`defineComponent()`) — MOD가 커스텀 컴포넌트 정의 가능
2. World 동적 스토어 레지스트리 (`register/store/getStoreByName/unregisterStore`)
3. `ArchetypeRegistry` + 빌트인 3개 아키타입 (player/dish/boss)
4. `World.spawnFromArchetype()` — 아키타입 기반 엔티티 스폰
5. Entity.syncToWorld() 아키타입 기반 리팩토링, `handleTimeout()` public 추가
6. GameScene player 생성 → `spawnFromArchetype()` 1호출로 전환
7. 5개 시스템 World 스토어 직접 읽기 전환:
   - EntityStatusSystem: World.statusCache + SEM 기반 (player 포함)
   - EntityTimingSystem: World.lifetime 기반, entity.handleTimeout() 위임
   - EntityMovementSystem: World.movement/transform 기반, strategy.update() 직접 호출
   - EntityVisualSystem: World.visualState 기반, blink/hitFlash/pullPhase/boss 진동
   - EntityRenderSystem: World → Phaser Container 동기화, DishRenderer/BossRenderer 직접 호출
8. PlayerTickSystem.syncStatusEffects() 제거 (EntityStatusSystem이 전역 처리)
9. ModContext에 `world` + `archetypeRegistry` 추가, ModRegistry 아키타입/스토어 추적+해제
10. Entity 데미지 → World 스토어 동기 (syncDamageToWorld)
11. Entity 레거시 tick 메서드 5개 제거 (tickStatusEffects/tickTimeDelta/tickMovement/tickVisual/tickRender)
12. EntityManager.updateAll() 레거시 경로 제거

**수치:** 521 테스트 통과, lint 0 에러, build 성공

**접근 패턴 3가지:**
| 사용자 | 접근 방식 | 타입 안전성 |
|--------|----------|------------|
| 빌트인 코드 | `world.transform.get(id)` | 완전 (기존 호환) |
| 새 코드/시스템 | `world.store(C_Transform).get(id)` | 완전 (Def 토큰 기반) |
| 아키타입 스폰 | `world.getStoreByName(name)` | unknown (내부만 사용) |

### Phase 5 후속: 불필요 태그 컴포넌트 제거 (2026-02-12)

`C_FallingBombTag`, `C_HealthPackTag` 태그 컴포넌트 삭제. `C_FallingBomb`, `C_HealthPack` 데이터 컴포넌트가 이미 엔티티 타입 식별 역할을 하므로 빈 태그는 중복이었음.

- **삭제**: `FallingBombTag`/`HealthPackTag` 타입 + `C_FallingBombTag`/`C_HealthPackTag` 토큰
- **World**: `fallingBombTag`/`healthPackTag` 프로퍼티 및 `register()` 호출 제거 (19 → 17 스토어)
- **아키타입**: `fallingBomb`/`healthPack` 아키타입에서 태그 제거 (4 → 3 컴포넌트)
- **쿼리**: `FallingBombSystem`, `HealthPackSystem`, `BlackHoleSystem`, `OrbSystem`에서 태그 제거 + destructuring 인덱스 조정
- **스폰 데이터**: `fallingBombTag: {}`, `healthPackTag: {}` 제거

### 다음 단계 (Phase 4d~4e, 별도 세션)

1. **Phase 4d**: Entity tick 메서드 제거 → Entity 경량화
2. **Phase 4e**: 외부 소비자(28파일) DishLike → store 읽기 전환

### Phaser 4 stable 출시 모니터링

- GitHub: https://github.com/phaserjs/phaser/releases
- npm: `npm view phaser versions --json | tail`
- 뉴스: https://phaser.io/news

---

## Appendix: 참고 자료

- [Phaser v3.87 and v4.0.0 Released](https://phaser.io/news/2024/11/phaser-v387-and-v400-released)
- [Phaser v4 RC4](https://phaser.io/news/2025/05/phaser-v4-release-candidate-4)
- [Phaser v4 RC6](https://phaser.io/news/2025/12/phaser-v4-release-candidate-6-is-out)
- [Phaser Mega Update](https://phaser.io/news/2025/05/phaser-mega-update)
- [Dev Log 257 - Direct Mode & ECS](https://phaser.io/devlogs/257)
- [Dev Log 260 - bitECS Architecture](https://phaser.io/devlogs/260)
- [Dev Log 290 - Project Zeus Physics](https://phaser.io/devlogs/290)
- [Migrating Phaser 3 Shaders to Phaser 4](https://phaser.io/news/2025/11/migrating-phaser-3-shaders-to-phaser-4)
