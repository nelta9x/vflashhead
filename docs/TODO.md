# 게임 속도 밸런스 조정 TODO

> **목표**: 게임이 "너무 빠르다"는 피드백 해결. 접시 파괴 후 시각적 여유를 주고, 중반 난이도 급상승을 완만하게 조정.
> **원칙**: 각 단계 적용 후 `npm run test:run` 및 `npm run build`로 검증. 플레이테스트 후 다음 단계 진행.

---

## 단계 1: fillSpawn 쿨다운 완화

> **파일**: `data/spawn.json`
> **이유**: 현재 50ms 쿨다운으로 접시 파괴 즉시 보충됨 → 파괴 보상감 없음. 300ms로 늘려서 파괴 후 잠깐의 여유 제공.

- [x] `data/spawn.json`의 `fillSpawn.cooldownMs`를 `50` → `300`으로 변경

---

## 단계 2: dishCount 곡선 완만화

> **파일**: `data/waves.json`의 각 웨이브 `dishCount` 필드
> **이유**: 웨이브 4→5에서 dishCount가 5→8로 60% 급증. +1씩 균일하게 증가하도록 수정.

- [x] 웨이브별 `dishCount` 수정 (아래 표 참고)

| 웨이브 | 현재 dishCount | 변경 dishCount |
|--------|---------------|---------------|
| 1 | 3 | 3 (유지) |
| 2 | 4 | 4 (유지) |
| 3 | 5 | 5 (유지) |
| 4 | 5 | 5 (유지) |
| 5 | 8 | **6** |
| 6 | 8 | **7** |
| 7 | 9 | **8** |
| 8 | 10 | **9** |
| 9 | 11 | **10** |
| 10 | 12 | **11** |
| 11 | 13 | **12** |
| 12 | 14 | **13** |

---

## 단계 3: spawnInterval 전체 상향

> **파일**: `data/waves.json`의 각 웨이브 `spawnInterval` 필드
> **이유**: 전반적으로 약 1.5배로 늘려서 접시 간 호흡 제공. 특히 중반(웨이브 5~10) 구간의 급격한 감소를 완화.

- [x] 웨이브별 `spawnInterval` 수정 (아래 표 참고)

| 웨이브 | 현재 spawnInterval (ms) | 변경 spawnInterval (ms) |
|--------|------------------------|------------------------|
| 1 | 1000 | **1200** |
| 2 | 900 | **1100** |
| 3 | 800 | **1000** |
| 4 | 700 | **900** |
| 5 | 600 | **800** |
| 6 | 500 | **700** |
| 7 | 400 | **600** |
| 8 | 350 | **500** |
| 9 | 300 | **450** |
| 10 | 250 | **400** |
| 11 | 220 | **350** |
| 12 | 200 | **300** |

---

## 단계 4: 콤보 타임아웃 완화

> **파일**: `data/combo.json`의 `timeout` 섹션
> **이유**: 웨이브당 80ms 감소가 너무 공격적. 콤보 유지 압박이 "더 빠르게 플레이" 강요 → 체감 속도 상승.

- [x] `data/combo.json`의 `timeout` 필드 수정:
  - `base`: `1500` → `1800`
  - `comboReduction`: `15` → `12`
  - `waveReduction`: `80` → `50`
  - `minimum`: `600` → `700`
- [x] `tests/ComboSystem.test.ts` 테스트 값 갱신 (새 공식: `max(700, 1800 - combo*12 - wave*50)`)

---

## 단계 5: 접시 HP/lifetime 조정 및 무한 스케일링 완화

> **파일**: `data/dishes.json`, `data/waves.json`의 `infiniteScaling` 섹션
> **이유**: 접시가 너무 빨리 죽고 사라져서 화면 턴오버가 빠름. lifetime을 늘려 여유 제공. 무한 스케일링도 너무 공격적이라 완화.

### 5-1. 접시 스탯 조정 (`data/dishes.json`)

- [x] `basic`: `lifetime`을 `3000` → `4000`으로 변경
- [x] `golden`: `hp`를 `20` → `25`, `lifetime`을 `3000` → `4000`으로 변경
- [x] `crystal`: `hp`를 `15` → `20`, `lifetime`을 `3300` → `4500`으로 변경
- [x] `bomb`: `lifetime`을 `1200` → `1800`으로 변경

### 5-2. 무한 스케일링 완화 (`data/waves.json`의 `infiniteScaling`)

- [x] `spawnIntervalReduction`: `20` → `10`
- [x] `minSpawnInterval`: `150` → `200`
- [x] `bombWeightIncrease`: `0.02` → `0.015`
- [x] `maxBombWeight`: `0.35` → `0.30`
- [x] `goldenWeightDecrease`: `0.01` → `0.005`
- [x] `minGoldenWeight`: `0.2` → `0.25`
- [x] `maxMinDishCount`: `20` → `16`

---

## 검증 체크리스트

- [x] `npm run test:run` — 전체 118개 테스트 통과
- [ ] `npm run dev` — 실행 후 플레이테스트
- [ ] 웨이브 5 도달 시 체감 확인: "정신없다" → "조금 어려워졌다" 수준인지
- [ ] 접시 파괴 후 시각적 여유가 느껴지는지

---

# Performance Optimization TODO

## 1. Spatial Grid (공간 분할) — O(n²) → O(n)
- [x] `SpatialGrid` 유틸리티 클래스 구현 (`src/utils/SpatialGrid.ts`)
- [x] `BlackHoleSystem` — 그리드 기반 근접 엔티티 조회로 전환
- [x] `OrbSystem` — 그리드 기반 충돌 감지로 전환
- [x] `CursorAttackSystem` — 그리드 기반 범위 조회로 전환
- [x] `MagnetSystem` — 그리드 기반 범위 조회로 전환
- [x] `SpaceshipAISystem.findNearestDish()` — 그리드 기반 최근접 검색
- [x] 테스트 작성

## 2. Dirty Flag 렌더링 — 불필요 redraw 80%+ 감소
- [x] `DishRenderer` — 시각 상태 해시 비교, 변경 시만 redraw
- [x] `BossRenderer` — dirty flag 도입
- [ ] `SpaceshipRenderer` — dirty flag 도입
- [x] `CursorRenderer` — 매 프레임 애니메이션이므로 skip (electric sparks)
- [x] `BlackHoleRenderer` — 매 프레임 애니메이션이므로 skip (rotation)
- [x] `GridRenderer` — offset 양자화 기반 dirty flag
- [x] `HealthPackRenderer` — dirty flag 도입
- [ ] `FallingBombSystem` 렌더링 — dirty flag 도입 (DishRenderer.renderDangerDish 적용 완료)

## 3. Query 튜플 최적화 — push 오버헤드 제거
- [x] `World.query()` — pre-sized array + indexed assignment (push 리사이즈 오버헤드 제거)
- [x] 테스트 통과 확인

## 4. Graphics 오브젝트 풀 — GC 스파이크 제거
- [x] `ParticleManager` — Graphics 오브젝트 풀 도입 (acquireGraphics/releaseGraphics, 50개 상한)
- [ ] `BossShatterEffect` — Graphics 풀 재사용

## 5. splice → swap-and-pop — 핫 루프 O(n) → O(1)
- [x] `StatusEffectManager.tick()` — swap-and-pop 패턴
- [x] `StarBackground` 유성 제거 — swap-and-pop
- [x] `SpaceshipProjectileSystem` 발사체 제거 — swap-and-pop

## 6. 이중 쿼리 제거 — 불필요 할당 50% 감소
- [x] `MagnetSystem` — Spatial Grid 통합 시 해결 (단일 패스)
- [x] `BlackHoleSystem.applyDamageTickForHole()` — Spatial Grid 통합 시 해결

## 7. 기타 캐싱
- [x] `CursorTrail` — 색상 파싱 1회 캐싱 (cachedColor 필드)
- [x] `ObjectPool.acquire()` — free list(freeStack) 도입, O(n) → O(1)
- [x] `WaveSpawnPlanner` — 제곱 거리 비교로 전환 (sqrt 제거)
- [x] `OrbRenderer` — Math.random() → 결정적 sin/cos 기반 jitter
- [x] `DamageText` — 풀 크기 상한 설정 (MAX_COMBO_POOL_SIZE = 40)
