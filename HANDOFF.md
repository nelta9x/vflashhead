# HANDOFF - Extensibility Findings (P1~P5)

작성일: 2026-02-15  
대상 프로젝트: `/Users/nelta/Projects/vibeshooter`

## 0) 목적과 사용법

이 문서는 "확장성 리뷰에서 나온 P1~P5 이슈/결정/완료 상태"를, 컨텍스트를 잃은 뒤에도 빠르게 복구할 수 있도록 정리한 핸드오프 문서다.

- 이 문서만 읽어도 아래를 알 수 있어야 한다.
1. 왜 이것이 확장성 이슈인지
2. 어떤 파일/라인에서 근거를 확인해야 하는지
3. 무엇을 바꾸면 되는지(방향)
4. 무엇이 완료 기준인지

- 검토 범위
1. "코어 코드 수정 없이 콘텐츠를 추가할 수 있는가?" 관점
2. AGENTS 원칙(플러그인 우선, data-driven, ECS pipeline SSOT)과 실제 구현의 일치 여부

- 참고 문서
1. `docs/CODEMAP.md`
2. `docs/PLUGIN_ARCHITECTURE.md`
3. `AGENTS.md`

---

## 1) 우선순위 정의

- `P1`: 신규 콘텐츠 추가 시 구조적 병목이 되어, 실질적으로 "코어 수정 없는 확장"을 막는 이슈
- `P2`: 확장 과정에서 누락/누수/드리프트를 만들 가능성이 높은 구조적 리스크
- `P3`: 즉시 장애는 아니지만, 확장 작업의 반복 비용과 문서 신뢰도를 떨어뜨리는 이슈

## 1-1) 합의된 작업 체크리스트 (P1 단일 PR)

아래는 "작업하기로 합의된 P1 범위"를 추적하기 위한 체크리스트다.

- [x] `UpgradeSystem` 전용 getter 제거, 공통 조회 API(`getAbilityLevel`, `getEffectValue`, `getLevelData`, `getSystemUpgrade`)로 일괄 컷오버
- [x] `AbilityEffectCatalog` 도입으로 abilityId/effect key 상수 SSOT화
- [x] `CurseEffectMath`로 저주(글래스 캐논/광전사/변동성) 복합 계산 분리
- [x] 런타임 호출부(`PlayerAttackController`, `Boss*`, `Dish*`, `PlayerTickSystem`, `OrbSystem`, `BlackHoleSystem` 등) 공통 API 기반으로 전환
- [x] `AbilityTickSystem` 추가 및 `entityPipeline`에 `core:ability_tick` 등록 (`core:player` 직후)
- [x] `WaveBossConfig.entityTypeId` 필수화 + `BossConfig.defaultEntityTypeId` 추가
- [x] `waves[].bosses[]` 및 `infiniteBossTemplate[]` 전 항목에 `entityTypeId` 반영
- [x] `waveBossConfig`/`WaveSystem`에서 `entityTypeId` clone/fallback 경로 보존
- [x] `BossRosterSync`의 `gatekeeper_spaceship` 하드코딩 제거, `entityTypeId` 기반 plugin lookup + 미등록 즉시 예외
- [x] 테스트 전환: 기존 전용 getter 기반 테스트/mocks를 공통 API 기준으로 교체
- [x] 신규 테스트 추가: `AbilityTickSystem.test.ts`, `BossRosterSync.test.ts`
- [x] 문서 동기화: `docs/CODEMAP.md`, `docs/PLUGIN_ARCHITECTURE.md`, `docs/LESSONS.md`
- [x] 필수 검증 통과: `npm run lint`, `npm run test:run`, `npm run build`

## 1-2) P2 실행 체크리스트

아래는 P2 항목을 실제 구현 작업으로 옮길 때의 체크리스트다.

- [x] P2-A 파이프라인 fail-fast 도입: `GameScene.initializeSystems()`에서 `getMissingSystems()`/`getUnmappedSystems()` 검사 추가
- [x] P2-A 실패 정책 확정: 누락/미매핑 발견 시 즉시 `throw` (환경별 정책 결정 반영)
- [x] P2-A 회귀 테스트 추가: 정상 config는 통과, 오타/누락 config는 초기화 실패 검증
- [x] P2-B `ModSystemContext.eventBus` 타입을 raw bus가 아닌 `ScopedEventBus`로 축소
- [x] P2-B `GameWrappersSystemPlugin` 주입 경로에서 scoped bus 사용으로 교체
- [x] P2-B unload 시 리스너 누수 방지 테스트 추가 (MOD unload 후 잔존 구독 0 확인)
- [x] P2 문서 동기화: `docs/CODEMAP.md`, `docs/PLUGIN_ARCHITECTURE.md`, `docs/LESSONS.md`
- [x] P2 검증 통과: `npm run lint`, `npm run test:run`, `npm run build`

## 1-3) P3 실행 체크리스트

아래는 P3 항목(반복 비용/문서 신뢰도)을 정리하기 위한 체크리스트다.

- [x] P3-A BootScene 아이콘 프리로드를 data-driven으로 전환 (`abilities.json.active[].icon` 기반)
- [x] P3-A 아이콘 누락 fallback 정책 적용 (에셋 없음 시 안전 기본 아이콘 처리)
- [x] P3-A 신규 Ability 추가 시 BootScene 코드 수정 불필요함을 테스트/수동 검증
- [x] P3-B 문서의 `resetInstance`/초기화 시퀀스를 실제 코드와 일치하도록 정정
- [x] P3-B 등록 순서 불변 조건(서비스 → abilities/entityTypes 등록 → system plugin 생성)을 문서에 명시
- [x] P3 검증 통과: `npm run lint`, `npm run test:run`, `npm run build`

## 1-4) 오픈 이슈 결정 체크리스트

아래 항목은 모두 결정 완료되었고 코드에 반영됐다.

- [x] Ability 일반화 전략: `UpgradeSystem` 제거 + 플러그인 중심 조회(`AbilityRuntimeQueryService`)로 전면 전환
- [x] 보스 타입 스키마 기준점: `waves[].bosses[].entityTypeId` 고정 + fallback은 `boss.defaultEntityTypeId`
- [x] 파이프라인 fail-fast 범위: 개발/테스트/프로덕션 공통 즉시 예외

## 1-5) P4 실행 체크리스트 (abilities.json 브레이킹 전환)

- [x] `data/abilities.json` 신설 (`id`, `pluginId`, `upgradeId`, `icon` 명시 매핑형)
- [x] `data/game-config.json.abilities` 제거(하위호환 레이어 없음)
- [x] `GameConfig` 타입에서 `abilities` 제거 + `DataManager.abilities` 추가
- [x] `registerBuiltinAbilities` 입력을 `AbilityDefinition[]`로 변경 + `pluginId` lookup strict 검증
- [x] `UpgradeSystem`/`UpgradeDescriptionFormatter`/`UpgradePreviewModelBuilder`를 ability→upgrade 매핑 경유 조회로 통일
- [x] `BootScene` 아이콘 preload를 `abilities.active[].icon` 기반으로 전환
- [x] UI 아이콘 lookup(`InGameUpgradeUI`, `AbilitySummaryWidget`)을 ability 아이콘 key 매핑 기반으로 전환
- [x] `AbilityConfigSyncValidator` 추가 및 `GameScene.initializeSystems()`에서 fail-fast 호출
- [x] 신규 테스트 추가: `AbilityConfigSyncValidator.test.ts`, `AbilityDataConfig.test.ts`
- [x] 기존 테스트/문서 동기화: `AbilityIconPreloadResolver.test.ts`, `UpgradeIconCatalog.test.ts`, `CODEMAP`, `PLUGIN_ARCHITECTURE`, `LESSONS`, `data/README`
- [x] P4 검증 통과: `npm run lint`, `npm run test:run`, `npm run build`

## 1-6) P5 실행 체크리스트 (Ability 일반화 최종 컷오버)

- [x] `AbilityPlugin` 컨텍스트를 `upgradeSystem`에서 `abilityState`/`abilityData` 리더 계약으로 전환
- [x] 신규 서비스 계층 도입: `AbilityDataRepository`, `AbilityProgressionService`, `AbilityRuntimeQueryService`, `AbilityPresentationService`
- [x] 런타임 시스템/컨트롤러의 효과 조회를 `AbilityRuntimeQueryService` 단일 경로로 통일
- [x] 레벨/선택 상태 조회 및 적용을 `AbilityProgressionService`로 통일
- [x] UI(HUD/UpgradeUI/요약 위젯) 설명/프리뷰를 `AbilityPresentationService` 경로로 전환
- [x] `AbilityManager` strict API 추가: `getPluginOrThrow`, `getEffectValueOrThrow`
- [x] `UpgradeSystem` 제거 및 프로덕션 코드에서 `UpgradeSystem` 참조 0건 달성
- [x] 신규 테스트 추가: `AbilityRuntimeQueryService.test.ts`, `AbilityProgressionService.test.ts`, `AbilityPresentationService.test.ts`, `AbilityEffects.test.ts`
- [x] 기존 테스트 전환: `UpgradeEffects.test.ts`/`UpgradePreviewModelBuilder.test.ts` 제거 후 새 서비스 기준 검증으로 교체
- [x] 문서 동기화: `docs/CODEMAP.md`, `docs/PLUGIN_ARCHITECTURE.md`, `docs/LESSONS.md`, `HANDOFF.md`
- [x] P5 검증 통과: `npm run lint`, `npm run test:run`, `npm run build`

---

## 참고: 아래 P1~P3 본문은 "발견 당시 진단 기록"이다

현재 코드 기준 완료 상태와 acceptance는 상단 체크리스트(1-1~1-6) 및 하단 P4/P5 결정사항 섹션을 우선 기준으로 본다.

## 2) P1 - 핵심 확장 경로가 하드코딩에 묶여 있음

## P1-A) Ability 확장이 플러그인 계약보다 `UpgradeSystem` 하드코딩에 의존

### 증상

Ability는 `AbilityPlugin` 인터페이스를 가지지만, 실제 게임 로직 다수가 `UpgradeSystem`의 능력별 getter 하드코딩에 의존한다.  
결과적으로 새 어빌리티를 추가할 때 플러그인만 추가해서 끝나지 않고, 여러 코어/서비스 코드의 수정이 필요해진다.

### 근거 위치 (필수 확인 파일)

- 능력별 getter 하드코딩 집중:
  - `src/plugins/builtin/services/UpgradeSystem.ts:150`
  - `src/plugins/builtin/services/UpgradeSystem.ts:260`
- 시스템이 AbilityPlugin 일반 계약이 아니라 전용 getter를 직접 호출:
  - `src/plugins/builtin/systems/PlayerTickSystem.ts:81`
- AbilityManager의 `update` 경로가 실제 프레임 루프에서 호출되지 않음:
  - `src/systems/AbilityManager.ts:20`
  - `src/scenes/GameScene.ts:166`

### 왜 확장성 문제인가

새 Ability를 추가할 때 이상적인 경로는 다음이어야 한다.

1. `data/upgrades.json` 데이터 추가
2. `AbilityPlugin` 구현 추가
3. 팩토리 맵 등록
4. `game-config.json` ID 추가

하지만 현재는 대체로 아래가 추가로 필요하다.

1. `UpgradeSystem`에 신규 getter 추가
2. 관련 시스템(`PlayerTickSystem`, `MagnetSystem`, `OrbSystem`, `BlackHoleSystem`, 기타 서비스) 수정
3. 프리뷰/UI 계산기 쪽 동기화

즉 "플러그인 기반 확장"이 아닌 "코어 코드 확장"으로 변질될 가능성이 높다.

### 빠른 재확인 방법

아래 검색으로 능력 ID 하드코딩 분포를 확인한다.

```bash
rg -n "cursor_size|critical_chance|electric_shock|magnet|missile|health_pack|orbiting_orb|black_hole|glass_cannon|berserker|volatility" src
```

`UpgradeSystem.ts` 및 복수 시스템 파일에서 능력별 문자열/전용 getter 결합이 확인되면, 이 이슈가 유효하다.

### 권장 수정 방향

1. 능력 효과 조회를 `AbilityPlugin` 중심(일반화된 key 기반 조회)으로 이동
2. 시스템이 `UpgradeSystem` 전용 getter 대신 능력 효과 리졸버(또는 능력 상태 캐시)만 참조하도록 전환
3. 단계적 전환:
   - Step 1: 신규 Ability부터 일반 경로 사용
   - Step 2: 기존 Ability를 점진 이관
   - Step 3: 전용 getter 축소/정리

### 완료 기준

1. 새 Ability 1개를 `UpgradeSystem` 수정 없이 추가 가능
2. 해당 Ability 효과가 시스템/UI에 반영됨
3. 기존 Ability 동작 회귀 없음 (`test:run`, `build` 통과)

---

## P1-B) 보스 타입이 `gatekeeper_spaceship`로 고정되어 보스 플러그인 확장성이 낮음

### 증상

보스 스폰 동기화에서 엔티티 타입 ID를 문자열 `'gatekeeper_spaceship'`로 고정 조회/주입한다.

### 근거 위치

- 보스 플러그인 고정 조회:
  - `src/plugins/builtin/services/boss/BossRosterSync.ts:99`
- 스폰 config의 `entityType`도 고정:
  - `src/plugins/builtin/services/boss/BossRosterSync.ts:114`

### 왜 확장성 문제인가

보스 타입을 늘리거나 교체할 때, 데이터(`game-config.json`/wave 설정)만 수정해서는 동작하지 않고 `BossRosterSync` 코드 수정이 필요해진다.  
이는 "콘텐츠 추가 = 플러그인 + 데이터" 원칙과 충돌한다.

### 빠른 재확인 방법

```bash
rg -n "getEntityType\\('gatekeeper_spaceship'\\)|entityType: 'gatekeeper_spaceship'" src/plugins/builtin/services/boss
```

### 권장 수정 방향

1. wave/boss 설정에서 사용할 `entityTypeId`를 데이터로 받도록 변경
2. `BossRosterSync`는 그 ID를 사용해 plugin lookup
3. fallback 정책(미지정 시 기본값)을 데이터 레벨에서 명시

### 완료 기준

1. 코드 변경 없이 보스 타입 ID를 교체해 스폰 가능
2. 보스별 렌더/공격 패턴이 플러그인 계약으로 정상 동작

---

## 3) P2 - 확장 시 드리프트/누수 가능성이 높은 구조 리스크

## P2-A) Entity pipeline 드리프트가 런타임에서 강제 검증되지 않음

### 증상

`EntitySystemPipeline`에는 누락/미매핑 진단 메서드가 있으나, 씬 초기화 경로에서 이를 실패 조건으로 사용하지 않는다.

### 근거 위치

- 진단 API 존재:
  - `src/systems/EntitySystemPipeline.ts:63`
  - `src/systems/EntitySystemPipeline.ts:68`
- 초기화 경로에서 강제 검증 미사용:
  - `src/scenes/GameScene.ts:136`

### 왜 확장성 문제인가

`systemPlugins`와 `entityPipeline`을 동시에 다루는 구조에서 ID 오타/누락이 생기면 일부 시스템이 조용히 빠질 수 있다.  
확장 작업(신규 시스템 추가/순서 조정) 중 디버깅 비용이 급격히 증가한다.

### 빠른 재확인 방법

```bash
rg -n "getMissingSystems|getUnmappedSystems" src --glob '!src/systems/EntitySystemPipeline.ts'
```

검색 결과가 없다면, 진단 메서드가 실제로 강제되지 않는 상태다.

### 권장 수정 방향

1. `GameScene.initializeSystems()`에서 `startAll()` 직전 검증 실행
2. `missing/unmapped`가 있으면 에러 throw(개발/CI에서 fail-fast)
3. 운영 환경 정책이 필요하면 "경고 허용 목록"을 데이터로 분리

### 완료 기준

1. 파이프라인 ID 오타를 넣으면 즉시 초기화 실패
2. 정상 설정에서는 기존 실행과 동일

---

## P2-B) MOD tick 컨텍스트가 raw `EventBus`를 노출하여 Scoped 추적을 우회 가능

### 증상

MOD 전용 시스템 컨텍스트가 `EventBus` 인스턴스를 직접 제공한다.

### 근거 위치

- 타입 레벨 raw bus 노출:
  - `src/plugins/ModSystemRegistry.ts:10`
- 실제 주입 시 `EventBus.getInstance()` 전달:
  - `src/plugins/builtin/systems/GameWrappersSystemPlugin.ts:25`

### 왜 확장성 문제인가

`ModRegistry`/`ScopedEventBusWrapper`는 모드 언로드 시 구독 정리를 보장하려는 구조다.  
하지만 MOD tick에서 raw EventBus를 쓰면 스코프 추적을 우회한 구독이 생길 수 있고, 언로드 후 리스너 잔존(메모리/행동 누수) 위험이 생긴다.

### 빠른 재확인 방법

```bash
rg -n "eventBus: EventBus|getInstance\\(\\)" src/plugins | head -n 40
```

### 권장 수정 방향

1. `ModSystemContext.eventBus` 타입을 `ScopedEventBus`로 축소
2. `ModRegistry.loadMod()`에서 생성한 scoped bus를 mod system context로 주입
3. raw bus 접근 경로 제거 또는 내부 전용으로 제한

### 완료 기준

1. MOD 코드가 raw bus에 직접 접근 불가
2. MOD unload 후 이벤트 리스너 잔존 없음(테스트로 검증)

---

## 4) P3 - 반복 비용과 문서 신뢰도 이슈

## P3-A) BootScene 아이콘 프리로드 하드코딩 의존 (해결 완료)

### 증상

과거에는 아이콘 에셋 목록이 코드 배열에 고정되어 있었고, 현재는 `abilities.json.active[].icon` 기반 data-driven 경로로 전환되었다.

### 근거 위치

- 하드코딩 배열:
  - `src/scenes/BootScene.ts:72`
  - `src/scenes/boot/AbilityIconPreloadResolver.ts:1`

### 왜 확장성 문제인가

신규 Ability 도입 시, 데이터/플러그인 등록 외에 BootScene 코드 수정을 누락하면 아이콘 로딩 실패가 발생한다.  
이는 "데이터 기반 확장" 흐름을 약화시키고 작업 누락 포인트를 만든다.

### 빠른 재확인 방법

```bash
sed -n '71,85p' src/scenes/BootScene.ts
```

### 권장 수정 방향

1. 아이콘 로드 대상을 `data/abilities.json.active[].icon` 기반으로 생성
2. 파일 존재 여부 검증과 fallback 아이콘 정책을 함께 정의

### 완료 기준

1. 신규 Ability 추가 시 BootScene 코드 수정이 필요 없음
2. 누락 아이콘이 있어도 게임이 안전하게 fallback 처리

---

## P3-B) 문서와 실제 초기화 흐름이 부분 불일치

### 증상

플러그인 아키텍처 문서 시퀀스에 `PluginRegistry.resetInstance()`가 기술되어 있으나, 실제 초기화 코드 경로에는 해당 호출이 없다.

### 근거 위치

- 문서:
  - `docs/PLUGIN_ARCHITECTURE.md:45`
- 실제 코드:
  - `src/scenes/GameScene.ts:100`

### 왜 확장성 문제인가

온보딩/리팩토링 시 문서 신뢰도가 낮아지고, 잘못된 초기화 가정을 전파한다.  
특히 플러그인 등록 순서 관련 버그 분석 시 혼선을 만든다.

### 빠른 재확인 방법

```bash
rg -n "resetInstance\\(" src/scenes src/plugins
```

문서 설명과 실제 코드 실행 경로를 대조한다.

### 권장 수정 방향

1. 문서를 실제 코드 기준으로 즉시 수정
2. 초기화 시퀀스 다이어그램을 `GameScene.initializeSystems()`와 일치시키기
3. 등록 순서 불변 조건을 문서에 명시

### 완료 기준

1. 문서 시퀀스와 실제 호출 경로가 일치
2. 새 기여자가 문서만 보고도 올바른 추가 절차 수행 가능

---

## 5) 구현/리팩토링 시 주의 사항 (AGENTS 원칙 연결)

1. 밸런스/텍스트/색상 하드코딩 금지: `data/*.json` + `DataManager` SSOT 유지
2. 콘텐츠 추가 목적의 코어 수정 최소화: plugin + factory map + 데이터 SSOT(`abilities.json`, `game-config.json`) 경로 우선
3. `GameScene.update()`는 파이프라인 오케스트레이션 원칙 유지
4. EventBus payload는 객체 참조 대신 값 스냅샷 유지
5. 변경 후 필수 검증:
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`

---

## 6) 다음 작업 후보 (컨텍스트 복귀용)

1. MOD Ability 확장 계약 설계: `AbilityRuntimeQueryService` 기반 외부 플러그인 가이드/검증기 보강
2. Ability 프리뷰 템플릿 국제화 강화: `locales.json` 키 정합 검증 추가
3. 콘텐츠 스키마 일관성 강화: `abilities.json`/`waves.json`/`boss.json` 교차 validator 통합

---

## 7) 오픈 이슈 / 결정 필요 사항

현재 P1~P5 범위의 차단 이슈는 없다.  
향후 P6+ 후보는 6) 섹션 항목을 우선순위에 따라 선택해 진행한다.

---

## 8) P4 결정사항 / 완료 기준

### 확정된 결정사항

1. 어빌리티 SSOT는 `data/abilities.json`으로 고정한다.
2. `game-config.json.abilities`는 즉시 제거한다(브레이킹, 하위호환 없음).
3. 스키마는 명시 매핑형(`id`, `pluginId`, `upgradeId`, `icon`)으로 유지한다.
4. 설정 드리프트(`pluginId`, `upgradeId`, icon 메타)는 초기화 단계 fail-fast로 즉시 실패시킨다.
5. 아이콘 파일 누락은 경고 + UI fallback(`UpgradeIconCatalog`, 기본값 `★`)으로 처리한다.

### 완료 기준 (Acceptance)

1. `game-config.json`에 `abilities` 필드가 없고 런타임이 `abilities.json`만으로 능력 등록/매핑을 수행한다.
2. 신규 ability 활성화/아이콘/업그레이드 연결이 `abilities.json` 수정만으로 반영된다.
3. 잘못된 `pluginId`/`upgradeId`/icon 메타는 `GameScene.initializeSystems()`에서 즉시 예외로 실패한다.
4. 아이콘 에셋 누락 시 부팅이 중단되지 않고 경고 후 UI 심볼 폴백으로 진행된다.
5. 문서(`CODEMAP`, `PLUGIN_ARCHITECTURE`, `LESSONS`, `HANDOFF`)가 코드 경로와 일치한다.

---

## 9) P5 결정사항 / 완료 기준

### 확정된 결정사항

1. 능력 조회의 런타임 표면은 `abilityId` canonical ID만 노출하고 `upgradeId`는 내부 매핑으로 숨긴다.
2. 효과값 조회는 `AbilityRuntimeQueryService` 단일 경로로 강제한다.
3. 레벨/선택/적용은 `AbilityProgressionService`, 데이터 매핑은 `AbilityDataRepository`, UI 표현은 `AbilityPresentationService`로 분리한다.
4. `AbilityPlugin` 컨텍스트는 `upgradeSystem`을 제거하고 `abilityState`/`abilityData` 계약만 사용한다.
5. 미정의 abilityId/key/plugin/presentation 데이터는 완화(fallback) 없이 즉시 예외로 실패시킨다.
6. `UpgradeSystem`은 제거하고 하위호환 레이어를 제공하지 않는다(브레이킹 허용).

### 완료 기준 (Acceptance)

1. 프로덕션 코드에서 `UpgradeSystem` 참조가 0건이다.
2. 런타임 효과 조회가 `AbilityRuntimeQueryService` 경로로 통일되어 있다.
3. UI(업그레이드 선택/툴팁/HUD)가 `AbilityPresentationService` + `AbilityProgressionService` 경로로 동작한다.
4. 새 서비스 계층 단위 테스트(`AbilityRuntimeQueryService`, `AbilityProgressionService`, `AbilityPresentationService`, `AbilityEffects`)가 통과한다.
5. 문서(`CODEMAP`, `PLUGIN_ARCHITECTURE`, `LESSONS`, `HANDOFF`)가 P5 구조를 반영한다.
6. `npm run lint`, `npm run test:run`, `npm run build`가 모두 통과한다.
