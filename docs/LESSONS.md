# Lessons Learned

프로젝트 개발 중 반복적으로 발생한 버그와 설계 교훈을 **주제별로 통합**한 문서입니다.
각 항목의 원본 상세(증상/원인/해결 코드)는 [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)에 보존되어 있습니다.

> **발생 횟수(occurrences)**: 같은 유형의 이슈가 재발할 때마다 숫자를 증가시킨다.

---

## 1. 난이도 설계 `occurrences: 1`

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

## 2. 비동기/타이밍 안전성 `occurrences: 1`

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

## 3. 이벤트 의미 & byAbility `occurrences: 1`

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

## 4. ObjectPool 안전성 `occurrences: 1`

### 원칙
- `active` 플래그와 `activeObjects` Set 이중 추적 금지 → `acquire()`에서 두 조건 모두 체크
- 비활성화는 비동기 애니메이션에 의존하지 않고 **즉시** 수행, 시각 효과는 별도 객체로 처리
- 상태를 여러 곳에서 추적하면 동기화 문제 발생 → SSOT(ObjectPool) 직접 참조

### 사례 요약
- `onTimeout()` tween 콜백이 재사용된 객체를 비활성화 → 좀비 객체 발생, 즉시 `deactivate()` 패턴으로 해결
- `activeDishPositions` 이벤트 기반 추적 → ObjectPool 직접 조회로 교체

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 5. UI/입력 `occurrences: 1`

### 원칙
- UI 상태 변경(`visible`)은 애니메이션 시작 **전**에 즉시 수행, guard clause는 함수 최상단
- 키보드 폴링 기반 이동(`isDown`)은 항상 **상태 리셋 경로**(blur/visibility/gameout/pause)를 함께 설계
- 혼합 입력(포인터+키보드)에서는 입력 장치 우선순위를 데이터 기반으로 명시
- 입력 정책(우선순위/가속/리셋)은 전용 컨트롤러(`PlayerCursorInputController`)로 캡슐화
- 키보드 입력은 `targetX/Y`만 갱신하고, `transform.x/y`는 `PlayerTickSystem`의 스무딩이 유일하게 기록해야 한다. 양쪽 경로(키보드/포인터)가 동일한 target→smoothing→transform 흐름을 따라야 이산적 점프 없이 매끄러운 이동이 보장된다.

### 사례 요약
- `hide()` tween 중 `selectUpgrade` 다중 호출 → stack 폭주, `visible` 즉시 변경으로 해결
- `keyup` 누락으로 한 방향 자동 이동 → `resetMovementInput()` + 다중 리셋 경로 추가
- 축 가속 도입 시 포인터 우선 유예 중 축 누적 금지를 명시적으로 처리
- 메뉴 `mousedown`이 모바일 터치 무시 → `pointerdown`(`PointerEvent`)으로 교체해 마우스+터치+펜 통합
- 게임 컨테이너에 `touch-action: none` CSS 누락 → 브라우저가 터치를 스크롤/줌으로 가로챔, CSS + Phaser `input.touch.capture: true` 이중 방어로 해결
- 키보드 `processKeyboardInput()`이 `transform.x/y`와 `targetX/Y`를 동시에 동일 값으로 설정 → 스무딩 거리 0, no-op → 이산적 점프. `targetX/Y`만 갱신하도록 수정해 키보드/포인터 모두 동일 스무딩 경로를 통과하게 해결

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 6. 데이터 SSOT `occurrences: 2`

### 원칙
- 동작 의미가 바뀌는 리팩토링은 데이터 키 명명까지 함께 맞춤
- 미사용 데이터 필드는 같은 변경 단위에서 제거
- 성장 공식/증가량/임계값은 코드 상수가 아니라 JSON SSOT로 관리
- 프리뷰는 문장 생성이 아니라 **비교 모델 생성 문제** → `previewDisplay` 스키마로 강제
- **두 JSON 파일이 같은 엔티티를 정의하면 값이 묵시적으로 분기**한다. 마이그레이션이 계획되면 즉시 완료하고 레거시 파일을 제거해야 한다
- Fallback 조회 패턴(`A.json → B.json`)은 불완전한 SSOT 마이그레이션을 은폐한다. 기존 데이터는 동작하지만 신규 엔티티가 primary 소스에 없으면 조회 실패

### 사례 요약
- 헬스팩 방향 변경 후 속도 키가 과거 의미로 잔존 → `moveSpeed`로 리네이밍 + 미사용 필드 제거
- 블랙홀 성장 규칙을 레벨 데이터(`consumeRadiusGrowthRatio` 등)로 SSOT 이동
- 업그레이드 카드를 문자열 프리뷰에서 구조화 모델(`getPreviewCardModel()`)로 교체
- 처치형 템포 버프(오버클럭)는 스택/지속/상한/만료를 SSOT 데이터 세트로 정의
- `dishes.json`과 `entities.json`이 접시 5종을 이중 정의 → `damageInterval` 300 vs 150 묵시적 분기, 우주선 `playerDamage` 조회 실패. dishes.json 제거 + entities.json 단일 SSOT로 해결

> 상세: [LESSONS_ARCHIVE.md](LESSONS_ARCHIVE.md)

---

## 7. 시스템 분리 시 결합 방식 선택 `occurrences: 1`

### 원칙
- 시스템 분리의 목적은 독립성 확보. 분리 후 closure 공유 배열/직접 메서드 호출로 재결합하면 분리 의미가 퇴색한다.
- CLAUDE.md 규칙 6 "시스템 간 직접 결합보다 EventBus를 우선 사용"은 같은 도메인/같은 플러그인에서 분리된 시스템에도 예외 없이 적용.
- "밀결합이었으니 분리 후에도 밀결합"이라는 추론은 오류. 원래 밀결합이었기 때문에 분리하는 것.

### 사례 요약
- SpaceshipProjectileSystem 분리 시, AI→Projectile 발사 트리거를 closure 공유 FireRequest[]로 설계 → EventBus 이벤트로 전환
- 공유 상태가 없으면 각 시스템이 완전히 독립적으로 테스트/교체 가능

---

## 8. drift 엔티티의 위치 판정 `occurrences: 4`

### 원칙
- drift amplitude가 크면 AI 판정(좌표 선택, 시각 일치, 타겟 안정성)이 전부 망가진다. 코드로 patch하는 건 끝이 없다.
- **해결: 우주선 drift amplitude를 0으로** (`entities.json`). transform = homeX/homeY가 되어 좌표 프레임 혼동 자체가 사라짐.
- AI 코드는 단순하게: 타겟 선택(homeX 기준, 잠금), 진입/범위 체크(transform 기준), chase(homeX 이동).

### 사례 요약
- 1~3차: eat 판정에 anchor/transform을 번갈아 사용하며 3회 연속 혼동
- 4~5차: 좌표 프레임 통일 시도 → 시각 불일치 또는 drift 중 먹기 문제
- 6차: drift 억제/복원/phase 리셋 → 코드 복잡도만 증가, 텔레포트 문제
- 7차: 타겟 잠금 + anchor 기반 선택 → drift가 시각적으로 chase를 완전히 가림
- 8차(확정): **drift amplitude = 0**. 근본 원인(drift) 제거. AI 코드 대폭 단순화
- 9차: entry 애니메이션(0.15/frame)과 AI chase(0.12/frame)가 같은 homeY를 역방향으로 수정 → 접시가 entry target 위에 있으면 우주선이 영원히 접시에 도달 불가. **해결: entry 중 AI 비활성화** (`isInEntry` 인터페이스 메서드 추가)

### 원칙 추가
- **같은 컴포넌트를 두 시스템이 같은 프레임에서 쓸 때**, 실행 순서(파이프라인 위치)에 따른 덮어쓰기 충돌을 반드시 검증
- 특히 entry/spawn 애니메이션과 AI가 같은 이동 데이터를 수정하면 교착 상태 발생 가능 → 애니메이션 중 AI 양보(또는 역순) 설계 필수
