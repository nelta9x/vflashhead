# Claude Code 지침

## 프로젝트 개요
FLASHEAD - Phaser 4 기반 웹 슈팅 게임

## 기술 스택
- TypeScript
- Phaser 4 (RC6)
- Vite
- Vitest

## 주요 명령어
- `npm run dev` - 개발 서버 실행
- `npm run lint` - 린트
- `npm run test:run` - 테스트 1회 실행
- `npm run build` - 타입체크 + 프로덕션 빌드

## 우선 참고 문서
1. `docs/CODEMAP.md` - 구조/이벤트 흐름/책임 경계
2. `docs/LESSONS.md` - 재발 방지 교훈
3. `data/README.md` - 데이터 필드/밸런스 가이드
4. `docs/GAME_DESIGN_PHILOSOPHY.md` - 게임/UI 철학 (통합 UI, 최소 UI 노출)
5. `docs/VISUAL_STYLE_GUIDELINES.md` - 비주얼 원칙 (보스 HP 실루엣, 형태/스타일 제약)

## AI 에이전트 핵심 원칙 (필수)

### 1) 데이터 우선 + SSOT
- 밸런스/연출/텍스트/색상은 코드 하드코딩 금지.
- 먼저 `data/*.json`에 정의하고, 코드에서는 `DataManager`를 통해 사용.
- 다국어 텍스트는 `data/locales.json`에서 관리.

### 2) 로직/외형 분리 (SoC)
- 로직: `scenes/`, `systems/`, `entities/`가 상태/수치/흐름 담당.
- 외형: `src/effects/*Renderer.ts`가 `Phaser.Graphics` 드로잉 담당.
- Scene/Entity에서 복잡 드로잉 직접 구현 금지, Renderer로 위임.

### 5) Renderer 공용화 우선
- 메뉴/인게임이 같은 비주얼 언어를 쓰면 전용 렌더러 분리보다 공용 렌더러 확장을 우선.
- 새 렌더러 추가 전, 기존 렌더러 재사용 가능성 먼저 검토.

### 6) EventBus 중심 통신
- 시스템 간 직접 결합보다 `EventBus`를 우선 사용.
- 이벤트 payload는 객체 참조 대신 값 스냅샷(좌표/수치) 전달.

### 7) ObjectPool/비동기 안정성
- Pool의 활성 상태와 실제 객체 상태 불일치 금지.
- `delayedCall`/Tween 콜백은 웨이브·씬 전환 후에도 안전하도록 상태 가드 포함.

### 8) 타입 안정성
- `any` 사용 금지. 필요 시 구체 타입 또는 `unknown` 사용.
- 외부 라이브러리 호환으로 불가피한 경우에만 최소 범위 예외 처리.

### 9) 디버그 로그 정리
- `console.log`는 디버깅 용도로만 사용.
- 작업 완료 전 프로덕션 코드에서 전부 제거.

### 10) 완료 기준 (필수 검증)
작업 완료 전 아래 3개를 모두 통과해야 함.
- `npm run lint`
- `npm run test:run`
- `npm run build`

### 11) 문서 동기화
구조/책임/규칙 변경 시 코드와 같은 변경 단위에서 문서를 함께 갱신.
- `docs/CODEMAP.md` - 구조/연결/책임
- `docs/LESSONS.md` - 교훈/재발 방지
- `AGENTS.md` - 작업 규칙
- `docs/REFACTORING_GUIDELINES.md` - 리팩토링 기준/절차(상세)
- `docs/GAME_DESIGN_PHILOSOPHY.md` - 게임/UI 철학 변경 시
- `docs/VISUAL_STYLE_GUIDELINES.md` - 비주얼 스타일 변경 시

### 13) ECS 파이프라인 규칙 (필수)
- `GameScene.update()`에 `entitySystemPipeline.run(delta)` 외의 tick/update 호출 금지.
- 새 tick 로직은 반드시 `EntitySystem` 구현 + 파이프라인 등록으로 추가.
- 시스템은 `setContext()`로 외부 상태를 받지 않는다. `World.context` 또는 생성자 주입을 사용.
- `GameScene.update()`는 4단계만: 입력 처리 → pause 체크 → pipeline.run() → scene 비주얼.
- 시스템 실행 순서는 `data/game-config.json`의 `entityPipeline`이 SSOT.

### 12) 주기적 리팩토링 (요약 규칙)
- 신규 기능 2~3개 구현마다 구조 점검을 수행한다. (출시 직전 핫픽스 구간은 예외)
- 아래 중 하나라도 만족하면 분리를 우선 검토한다.
  - 단일 파일에 독립 책임 3개 이상이 공존
  - 파일 길이 800~1000 라인 이상
  - 단일 메서드 길이 80 라인 이상
  - 테스트가 private 구현에 과도하게 결합
- 분리 단위는 \"상태 + 타이밍 + 이벤트\"가 함께 움직이는 기능 덩어리를 기준으로 한다.
- Scene는 오케스트레이션(`create/update/cleanup`, 상위 상태 전환) 중심으로 유지한다.
- 상세 기준/예시/반례는 `docs/REFACTORING_GUIDELINES.md`를 따른다.

## 작업 프로토콜 (권장)
1. 문서 확인: `docs/CODEMAP.md` → `docs/LESSONS.md` → 관련 JSON → (UI 작업 시) `docs/GAME_DESIGN_PHILOSOPHY.md` → (비주얼 작업 시) `docs/VISUAL_STYLE_GUIDELINES.md`
2. 변경 설계: 데이터 변경 여부, Event 영향 범위, SoC 경계 확정
3. 구현: 데이터 정의 → 타입 정의 → 로직 구현 → 렌더러 구현/연결
4. 검증: `lint` → `test:run` → `build`
5. 문서 반영: 구조 변화/교훈/규칙 변경 동기화

## PR/완료 체크리스트
- [ ] 데이터가 JSON(SSOT)에 먼저 반영되었는가
- [ ] 로직/외형 분리가 지켜졌는가
- [ ] 주기적 리팩토링 트리거를 점검했는가 (해당 시 분리 수행/기록)
- [ ] 공용 Renderer 우선 원칙을 검토했는가
- [ ] EventBus payload가 값 스냅샷인가
- [ ] ObjectPool/비동기 콜백 안전 가드가 있는가
- [ ] `any` 없이 타입 안정성을 유지했는가
- [ ] `console.log`를 제거했는가
- [ ] `npm run lint` 통과
- [ ] `npm run test:run` 통과
- [ ] `npm run build` 통과
- [ ] 필요한 문서를 함께 업데이트했는가
