# Lessons Learned

프로젝트 개발 중 반복적으로 발생한 버그와 설계 교훈을 **주제별로 통합**한 문서입니다.
각 항목의 원본 상세(증상/원인/해결 코드)는 [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)에 보존되어 있습니다.

---

## 1. 난이도 설계

### 원칙
- 신규 위협 축(레이저/낙하폭탄/신규 접시)은 등장 시점을 최소 1~2웨이브 간격으로 분리
- 한 웨이브에 큰 변화(새 접시/새 기믹/보스 수 증가)는 1개만 배치
- 레이저 간격 같은 연속 수치는 웨이브 간 Δ를 일정 범위 이내로 유지
- 고정 웨이브 조정 후 무한 스케일링도 같은 기울기로 맞춰야 스파이크 재발 방지

### 사례 요약
- W3에 레이저+낙하폭탄 동시 등장 → 낙하폭탄 minWave를 5로 이동해 학습 구간 확보
- W10에 2보스+amber+가속 중첩 → 보스 수 변화만 남기고 나머지는 후속 웨이브로 분산
- W7~8 crystal+bomb 비중 동시 증가 → 도입 시점 분리, 무한 스케일링 기울기도 함께 완화

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 2. 비동기/타이밍 안전성

### 원칙
- `delayedCall`/tween 콜백은 실행 시점 기준으로 상태 가드(`isGameOver`, `waveNumber`) 필수
- tween `onComplete`에는 `if (!this.scene) return` 또는 `if (!this.active) return` 가드 포함
- 풀 순회는 **스냅샷 수집 → 별도 단계 처리** (2단계 패턴)
- 상태 변경은 애니메이션 시작 전에 즉시 수행
- 주기형 어빌리티는 `delayedCall`보다 `update` 기반 누적 타이머가 안전
- 조건부 `return`으로 빠져나갈 때도 리소스(게임 오브젝트) 정리는 수행해야 함
- EventBus 리스너는 **클래스 필드로 저장** → `destroy()`에서 `EventBus.off()` 호출 (메모리 누수 방지)
- 익명 화살표 함수를 EventBus에 등록하면 해제 불가 → 반드시 필드 참조 사용

### 사례 요약
- W3 `delayedCall`이 웨이브 전환 후 실행 → `waveNumber` 클로저 캡처 + 정리 경로 분리로 해결
- 업그레이드 선택 시 `hide()` 애니메이션 중 다중 호출 → `visible` 즉시 `false` 처리
- 블랙홀 스폰/피해를 비동기 콜백에서 동기적 누적 타이머(교체형)로 전환
- 미사일/레이저 콜백에 `isGameOver` + `waveNumber snapshot` 가드 추가

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 3. 이벤트 의미 & byAbility

### 원칙
- `byAbility` 같은 이벤트 플래그는 단순 메타데이터가 아니라 **게임 규칙 스위치** (콤보/피해/리셋 분기)
- 신규 파괴/제거 소스 추가 시 `byAbility` 의미를 먼저 설계
- 어빌리티 트리거는 UI/설명 문구가 기준으로 삼는 이벤트(`hit` vs `destroy`)와 정확히 일치
- 이벤트 데이터는 객체 참조가 아닌 **값 스냅샷**으로 전달
- 소비되지 않는 도메인 필드(`chainReaction` 등)는 즉시 제거

### 사례 요약
- 미사일 경로 파괴 추가 시 `byAbility` 미설계 → 콤보/폭탄 규칙 충돌 위험 발견
- 전기 충격을 `DISH_DESTROYED` → `onDishDamaged` + `byAbility` 게이트로 이동해 재귀 안정성 확보
- 블랙홀 폭탄 제거를 `forceDestroy(true)` 경로로 강제해 규칙 보존
- 멀티 보스 전환 시 `bossId` 없는 이벤트가 도메인 버그의 시작점이었음

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 4. 피해 기믹 피드백 일관성

### 원칙
- 동일 유형 기믹의 동일 결과는 발생 경로와 무관하게 같은 피드백(색상/텍스트)을 사용
- 새 피해 기믹 추가 시 기존 동종 기믹의 피드백 색상·텍스트를 먼저 확인 후 통일
- 피드백 텍스트 표시는 한 곳(호출자 또는 FeedbackSystem)에서만 담당 — 중복 표시 금지

### 사례 요약
- 일반 폭탄 제거(CYAN) vs 낙하폭탄 제거(빨강) 색상 불일치 → FeedbackSystem 중복 텍스트 제거 + 낙하폭탄에 CYAN 텍스트 추가로 통일
- 원인: DishResolutionService가 CYAN 텍스트를 표시한 뒤 FeedbackSystem이 빨간 텍스트를 중복 표시

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 5. ObjectPool 안전성

### 원칙
- `active` 플래그와 `activeObjects` Set 이중 추적 금지 → `acquire()`에서 두 조건 모두 체크
- 비활성화는 비동기 애니메이션에 의존하지 않고 **즉시** 수행, 시각 효과는 별도 객체로 처리
- 상태를 여러 곳에서 추적하면 동기화 문제 발생 → SSOT(ObjectPool) 직접 참조

### 사례 요약
- `onTimeout()` tween 콜백이 재사용된 객체를 비활성화 → 좀비 객체 발생, 즉시 `deactivate()` 패턴으로 해결
- `activeDishPositions` 이벤트 기반 추적 → ObjectPool 직접 조회로 교체

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 6. 리팩토링 원칙

### 원칙
- Scene은 흐름 오케스트레이션(`create/update/cleanup`), 규칙은 모듈로 분리
- 이벤트 바인딩은 전용 바인더(`GameSceneEventBinder`)로 일원화
- 테스트는 내부 구현(private)보다 공개 모듈 계약에 맞춰야 리팩토링 비용이 낮아짐
- Renderer 분리 시 `delayedCall`/이벤트 핸들러 내 콜백까지 전수 조사 필수
- 트윈은 목적별 핸들(`spawn/reaction/death`)을 분리해 수명 제어를 독립적으로 유지

### 사례 요약
- `GameScene` 1900+ 라인 → 5개 모듈로 분리 (BossCombatCoordinator, PlayerAttackController 등)
- `LaserRenderer` 도입 후 콜백 내 `this.laserGraphics` 유령 참조 → 런타임 크래시
- 보스 `killTweensOf(this)` 일괄 kill → 스폰 트윈 중단으로 투명 고정, 핸들 분리로 해결

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 7. UI/입력

### 원칙
- UI 상태 변경(`visible`)은 애니메이션 시작 **전**에 즉시 수행, guard clause는 함수 최상단
- 키보드 폴링 기반 이동(`isDown`)은 항상 **상태 리셋 경로**(blur/visibility/gameout/pause)를 함께 설계
- 혼합 입력(포인터+키보드)에서는 입력 장치 우선순위를 데이터 기반으로 명시
- 입력 정책(우선순위/가속/리셋)은 전용 컨트롤러(`PlayerCursorInputController`)로 캡슐화

### 사례 요약
- `hide()` tween 중 `selectUpgrade` 다중 호출 → stack 폭주, `visible` 즉시 변경으로 해결
- `keyup` 누락으로 한 방향 자동 이동 → `resetMovementInput()` + 다중 리셋 경로 추가
- 축 가속 도입 시 포인터 우선 유예 중 축 누적 금지를 명시적으로 처리
- 메뉴 `mousedown`이 모바일 터치 무시 → `pointerdown`(`PointerEvent`)으로 교체해 마우스+터치+펜 통합
- 게임 컨테이너에 `touch-action: none` CSS 누락 → 브라우저가 터치를 스크롤/줌으로 가로챔, CSS + Phaser `input.touch.capture: true` 이중 방어로 해결

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 8. 데이터 SSOT

### 원칙
- 동작 의미가 바뀌는 리팩토링은 데이터 키 명명까지 함께 맞춤
- 미사용 데이터 필드는 같은 변경 단위에서 제거
- 성장 공식/증가량/임계값은 코드 상수가 아니라 JSON SSOT로 관리
- 프리뷰는 문장 생성이 아니라 **비교 모델 생성 문제** → `previewDisplay` 스키마로 강제

### 사례 요약
- 헬스팩 방향 변경 후 속도 키가 과거 의미로 잔존 → `moveSpeed`로 리네이밍 + 미사용 필드 제거
- 블랙홀 성장 규칙을 레벨 데이터(`consumeRadiusGrowthRatio` 등)로 SSOT 이동
- 업그레이드 카드를 문자열 프리뷰에서 구조화 모델(`getPreviewCardModel()`)로 교체
- 처치형 템포 버프(오버클럭)는 스택/지속/상한/만료를 SSOT 데이터 세트로 정의

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 9. 렌더 레이어 깊이 중앙화

### 원칙
- 모든 `setDepth()` 값은 `data/game-config.json`의 `depths` 섹션에 정의하고, 소스에서는 `DEPTHS.xxx`로 참조
- 소스 코드에 숫자 리터럴 depth를 직접 작성하지 않음 — 레이어 순서 변경 시 JSON 한 곳만 수정
- 테스트 mock에 `DEPTHS`를 추가하는 것을 잊지 않도록 주의

### 사례 요약
- 8개 소스 파일에 흩어진 하드코딩 depth 값(−10 ~ 2510)을 `DEPTHS` SSOT로 일괄 마이그레이션
- DamageText 테스트가 `DEPTHS` mock 누락으로 17건 실패 → mock에 필요한 키 추가로 해결

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 10. 웨이브 상태 관리

### 원칙
- 게임 상태를 변경하는 **모든 경로**(성공/실패/타임아웃)에서 카운트 업데이트 필수
- 새 단계(웨이브) 시작 시 관련 **모든** 상태를 초기화
- 위치 추적 시스템의 제거 로직은 관대하게 설계 (누적 방지)

### 사례 요약
- 일반 접시 타임아웃 시 `dishesDestroyed` 미증가 → 웨이브 완료 조건 영원히 미달
- `activeDishPositions` 미초기화 → 이전 웨이브 데이터가 스폰 위치 탐색을 방해

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)
