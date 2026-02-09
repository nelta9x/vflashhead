# Lessons Learned

프로젝트 개발 중 발견한 버그와 교훈을 기록합니다.

---

## 2026-02-09: 큰 변화(새 접시/새 기믹/보스 수 증가)는 한 웨이브에 1개만 배치해야 스파이크를 막을 수 있음

### 증상
- 웨이브 10에서 `2보스 전환 + amber 도입 + 레이저/스폰 가속`이 동시에 겹치며 체감 난이도가 급상승했음.
- 10~12와 무한 시작 구간에서 실패 원인이 섞여, 플레이어가 적응 포인트를 학습하기 어려웠음.

### 원인
- 신규 요소 도입(보스 수 증가, 신규 접시)을 같은 웨이브에 중첩해 난이도 변화량이 한 번에 커졌음.
- 무한 구간에서도 보스 수 증가와 신규 접시 확장이 겹치면 같은 문제가 반복될 수 있었음.

### 해결
- 웨이브 10은 `보스 수 1 -> 2`만 큰 변화로 적용하고, 접시 구성은 웨이브 9 계열로 유지함.
- 웨이브 11~12는 큰 변화 없이 수치만 점진 상승하도록 조정함.
- `amber`는 무한 웨이브(13+)에서 `amberStart*` 스케일링으로 단계 도입하고, 무한 보스 수는 2로 고정함.

### 교훈
- **난이도 설계에서 신규 위협 축은 웨이브당 1개만 열어야 플레이 학습과 실패 피드백이 분리된다.**
- **고정 웨이브뿐 아니라 무한 스케일링도 같은 원칙(큰 변화 1개)으로 설계해야 스파이크 재발을 막을 수 있다.**

---

## 2026-02-09: 전기 충격은 파괴 이벤트보다 히트 이벤트에 붙여야 의도와 재귀 안정성이 맞는다

### 증상
- 전기 충격이 `DISH_DESTROYED` 기반으로 구현되어, 전기 피해로 죽은 접시가 다시 전기 충격을 유발하는 연쇄가 발생할 수 있었음.
- 디자인 의도(커서 히트 기반 트리거)와 실제 동작(처치 기반 트리거)이 어긋나 플레이 체감과 설명 문구가 불일치했음.

### 원인
- 트리거 시점을 `onDishDestroyed`에 두면서 `byAbility` 가드 없이 전기 충격을 재호출했음.
- 체인 의미를 담던 `chainReaction` 필드는 더 이상 게임 규칙에 소비되지 않는데도 데이터/타입/이벤트에 잔존해 혼선을 만들었음.

### 해결
- 전기 충격 트리거를 `onDishDamaged`로 이동하고, `byAbility !== true`(직접 커서 히트)에서만 발동하도록 제한.
- 연쇄 플래그 전달 경로를 제거하고 `chainReaction` 도메인(데이터 필드/타입/이벤트 payload/메서드 인자)을 전면 삭제.
- 로케일/업그레이드 설명 및 문서를 히트 기반 규칙으로 동기화.

### 교훈
- **어빌리티 트리거는 UI/설명 문구가 기준으로 삼는 이벤트(`hit` vs `destroy`)와 정확히 일치해야 한다.**
- **재귀 위험이 있는 효과는 소스 게이트(`byAbility`)를 규칙으로 먼저 고정해야 안정성을 확보할 수 있다.**
- **더 이상 소비되지 않는 도메인 필드는 즉시 제거해야 SSOT/타입/문서의 의미가 유지된다.**

## 2026-02-09: 웨이브 중반 난이도 급변은 위험 타입 도입 시점을 분리해야 완화된다

### 증상
- 웨이브 7~8에서 `crystal`과 `bomb` 비중이 동시에 증가해 체감 난이도가 갑자기 치솟았음.
- 특정 웨이브(9)에서 위험 요소 조합이 한 번에 겹치면서 플레이 실패가 연속적으로 발생했음.

### 원인
- 중반 웨이브에서 신규 위협 타입(`crystal`) 도입과 기존 위협(`bomb`) 비중 증가가 같은 시점에 적용됨.
- 웨이브 10~12와 무한 구간의 상승 기울기가 커서 7~9 완화 이후에도 다시 급경사 구간이 생길 수 있었음.

### 해결
- 웨이브 7~8은 `basic/golden/bomb`만 유지하고 `crystal` 출현을 제거함.
- 웨이브 9에서 `crystal`을 낮은 비중으로 재도입하고, `bomb` 비중은 웨이브 8보다 낮게 설정함.
- 웨이브 10~12와 `infiniteScaling`의 스폰/폭탄/보스 HP 상승 폭을 함께 낮춰 전체 난이도 곡선을 점진적으로 재조정함.

### 교훈
- **중반 리밸런싱은 \"신규 위협 도입\"과 \"기존 위협 강화\"를 같은 웨이브에 겹치지 않는 것이 안전하다.**
- **고정 웨이브 조정 후에는 무한 스케일링까지 같은 기울기로 맞춰야 난이도 스파이크 재발을 막을 수 있다.**

---

## 2026-02-09: 힐팩 이동 방향을 바꿀 때 데이터 키 명도 함께 정리해야 혼선을 줄일 수 있음

### 증상
- 헬스팩 동작을 하단 -> 상단으로 변경한 뒤에도 데이터 키가 과거 의미로 남아 있으면, 코드 리뷰/밸런스 조정 시 의미 해석이 엇갈릴 수 있었음.
- 사용되지 않는 시간 필드가 남아 있으면 실제 동작과 데이터 문서가 불일치할 위험이 있었음.

### 원인
- 이동 방향 변경을 로직 수정으로만 처리하면 SSOT 스키마 명명과 문서가 과거 의미(낙하)에 고정된 채 남게 됨.
- 미사용 필드 정리를 같은 변경 단위에서 수행하지 않으면 유지보수 시 “사용 중인지 여부”를 반복 검증해야 함.

### 해결
- `health-pack.json`과 타입 정의에서 속도 키를 `moveSpeed`로 리네이밍함.
- 미사용 시간 필드를 제거하고, 문서(`CODEMAP`, `data/README`)를 하단 스폰/상단 소멸 규칙 기준으로 동기화함.

### 교훈
- **동작 의미가 바뀌는 리팩토링은 데이터 키 명명까지 함께 맞춰야 커뮤니케이션 비용이 줄어든다.**
- **미사용 데이터 필드는 같은 변경 단위에서 제거해야 SSOT 신뢰도를 유지할 수 있다.**

---

## 2026-02-09: 스폰 트윈과 피격 트윈을 같은 대상 kill하면 보스가 투명 상태로 고정될 수 있음

### 증상
- 블랙홀이 보스 스폰 위치와 겹칠 때, 보스가 등장 애니메이션 도중 피격되면 보스가 거의 보이지 않는 상태로 남는 현상이 발생함.

### 원인
- `Boss.spawnAt()`은 `alpha: 0 -> 1` 스폰 트윈을 사용해 페이드인하는데,
- `Boss.onDamage()`에서 `killTweensOf(this)`를 호출하면 피격 리액션 트윈뿐 아니라 스폰 트윈까지 함께 중단됨.
- 그 결과 스폰 트윈이 중간(낮은 alpha)에서 멈춰 가시성이 깨짐.

### 해결
- 보스 트윈 수명을 `spawn/reaction/death`로 분리 관리하고, 피격 시에는 reaction 트윈만 중단하도록 변경함.
- `deactivate()/die()/destroy()`에서 관리 중인 트윈만 명시적으로 정리해 잔존 트윈을 방지함.

### 교훈
- **등장 연출 트윈과 피격/상태 트윈을 동일 대상 일괄 kill로 관리하면 시각 회귀가 발생하기 쉽다.**
- **트윈은 목적별 핸들을 분리해 수명 제어를 독립적으로 유지해야 한다.**

---

## 2026-02-09: 블랙홀 중심 폭탄 제거는 `byAbility` 경로로 강제해야 규칙이 유지됨

### 증상
- 블랙홀 중심 도달 시 폭탄을 제거하는 규칙을 추가할 때, 제거 이벤트가 일반 파괴 경로로 흘러가면 플레이어 피해/콤보 리셋이 다시 발생할 위험이 있었음.
- 중심 판정 반경을 코드 상수로 두면 밸런스 조정 때 코드 수정이 반복될 수 있었음.

### 원인
- 폭탄 처리 규칙은 `DISH_DESTROYED.byAbility` 값에 따라 분기되는데, 파괴 소스가 늘어날 때 이 의미를 명시하지 않으면 기존 룰과 충돌하기 쉬움.
- 블랙홀 중심 판정 값이 SSOT 데이터가 아니면 기획 변경 시 회귀 가능성이 커짐.

### 해결
- 블랙홀 레벨 데이터에 `bombConsumeRadiusRatio`를 추가하고 `BlackHoleSystem`에서 매 프레임 clamp 후 사용.
- 중심 반경(`radius * bombConsumeRadiusRatio`)에 진입한 폭탄은 `forceDestroy(true)`로 제거해 `byAbility` 이벤트 경로를 강제.
- 이동 전/이동 후 모두 중심 반경 재판정해 같은 프레임 진입도 즉시 제거되도록 처리.

### 교훈
- **폭탄 제거 신규 소스는 반드시 `byAbility` 의미를 먼저 고정해야 플레이어 피해/콤보 규칙이 보존된다.**
- **밸런스 임계값(중심 제거 반경)은 코드가 아니라 업그레이드 데이터에 둬야 조정과 회귀 방지가 쉽다.**

---

## 2026-02-09: 업그레이드 카드는 배지보다 행 리스트 중심이 가독성이 높음

### 증상
- 구조화 카드 도입 후 `핵심 변화 배지`가 상단 공간을 차지하면서, 6~7행 어빌리티(`수호 구슬`, `블랙홀`)에서 하단 수치가 진행바와 겹치거나 잘리는 문제가 발생함.
- 긴 라벨이 있는 ko 로케일에서 텍스트 밀도가 높아지면 카드 내 수직 여유가 급격히 부족해졌음.

### 원인
- 정보 우선순위를 배지 + 행 리스트로 이중 표현해, 제한된 카드 높이에서 실제 필요한 “전체 변화 목록” 영역이 줄어들었음.
- `previewDisplay.primaryStatPriority`와 `primaryRow` 모델이 배지 렌더를 전제로 강결합되어 있었음.

### 해결
- `primaryStatPriority`, `primaryRow`, `readabilityCard.primaryBadge*` 경로를 제거하고 카드 본문을 `Lv.cur -> Lv.next` + 변경 행 리스트로 단순화.
- 카드 크기를 `340x440`으로 확대하고 `statListStartY`를 위로 조정해 긴 목록에서도 진행바 충돌을 방지.

### 교훈
- **좁은 카드에서는 대표 배지보다 전체 변화 리스트의 완전 표시가 우선**이다.
- **프리뷰 스키마는 최소 필드(`stats`) 중심으로 유지해야 UI 요구가 바뀔 때 파급이 작다.**

---

## 2026-02-09: 업그레이드 카드 프리뷰는 문자열보다 구조화 모델이 안전

### 증상
- 웨이브 클리어 업그레이드 카드가 단일 프리뷰 문자열(`upgrade.preview.*`)에 의존해, 실제 레벨 변화(현재 -> 다음)를 한눈에 파악하기 어려웠음.
- 직접 수치와 간접 시너지 수치(예: 자기장 레벨에 따른 구슬 최종 크기)가 누락되거나 일관되지 않게 표시될 여지가 있었음.

### 원인
- 프리뷰를 로케일 문자열 조합으로 처리하면서 카드 UI 요구(핵심 델타, 변화 항목 목록, 증감 방향 판정)를 타입/데이터로 강제하지 못했음.
- 업그레이드별 "무엇을 프리뷰할지"가 데이터 스키마로 명시되지 않아 코드 분기 확장 비용이 높았음.

### 해결
- `UpgradeSystem.getPreviewDescription()` 경로를 제거하고 `getPreviewCardModel()` 기반 구조화 모델로 교체.
- `upgrades.json`의 시스템 업그레이드에 `previewDisplay`를 필수화하고, 누락 시 런타임 에러로 즉시 실패하도록 강제.
- `UpgradePreviewModelBuilder`를 도입해 `delta !== 0` 필터, primary stat 우선순위, 역방향 개선 스탯(`damageInterval`, `spawnInterval`) 판정을 일원화.
- 카드 렌더를 `UpgradeCardContentRenderer`로 분리하여 `Lv.cur -> Lv.next`, 핵심 배지, 전체 변경 행을 데이터 기반으로 표시.

### 교훈
- **프리뷰는 문장 생성이 아니라 비교 모델 생성 문제**로 다뤄야 누락과 표현 불일치를 줄일 수 있다.
- **업그레이드 표시 규칙은 `previewDisplay` 같은 SSOT 스키마로 강제**해야 신규 어빌리티 추가 시 회귀를 막을 수 있다.
- **직접/간접 변화와 개선 방향 판정은 시스템 계층에서 계산하고 UI는 렌더링만 담당**해야 유지보수가 쉽다.

---

## 2026-02-09: GameScene 비대화 리팩토링에서 \"오케스트레이터 경계\" 유지

### 증상
- `GameScene.ts`가 1900+ 라인으로 커지면서, 보스/공격/접시/입력 변경이 한 파일에서 충돌해 회귀 추적이 어려웠음.
- 기존 테스트가 `GameScene` private 메서드에 강하게 결합되어 내부 구조 개선이 곧 테스트 붕괴로 이어졌음.

### 원인
- Scene 오케스트레이션 책임과 도메인 규칙 책임(보스 전투, 미사일, 접시 라이프사이클, 이벤트 바인딩, 입력 리스너)이 분리되지 않았음.
- `EventBus` 구독 등록이 Scene 본문에 밀집되어 이벤트 추가/삭제 시 영향 범위를 빠르게 파악하기 어려웠음.

### 해결
- `src/scenes/game/`로 책임을 분리:
  - `BossCombatCoordinator`: 보스 동기화/레이저/보스 접촉 데미지
  - `PlayerAttackController`: 차지/순차 미사일/재타겟/경로 파괴
  - `DishLifecycleController`: 접시 이벤트/스폰/전기충격/자기장/커서 범위
  - `GameSceneEventBinder`: EventBus 구독/해제 일원화
  - `SceneInputAdapter`: 입력 리스너 등록/해제 전담
- `GameScene`은 `create/update/cleanup`, pause 상태 전환, HUD 컨텍스트 조합 중심으로 축소.
- 기존 `GameScene` private 메서드 기반 테스트를 모듈 단위 테스트로 이관해 구조 변경 내성을 확보.

### 교훈
- **Scene은 흐름 오케스트레이션, 규칙은 모듈**로 분리해야 회귀 반경이 줄어든다.
- **이벤트 바인딩은 전용 바인더로 모으는 편이 안전**하다. (중복 등록/해제 누락 방지)
- **테스트는 내부 구현보다 공개 모듈 계약에 맞춰야** 리팩토링 비용이 낮아진다.

---

## 2026-02-08: 주기형 범위 어빌리티(블랙홀)에서 타이머/풀 순회 안전 패턴

### 증상
- 주기 스폰 + 주기 피해 틱 + 다중 대상 흡인을 한 번에 처리하는 범위 어빌리티는 타이밍 꼬임이 생기기 쉽습니다.
- `ObjectPool` 순회 중 즉시 파괴/비활성화가 섞이면 활성 Set 순회 안정성이 흔들릴 수 있습니다.
- `delayedCall` 기반 구현은 웨이브 전환/씬 전환 뒤에 콜백이 실행되면서 문맥이 어긋날 수 있습니다.

### 원인
- 스폰/피해를 비동기 콜백으로 분리하면 "예약 시점"과 "실행 시점" 상태가 달라질 수 있습니다.
- 풀 순회 중 상태 변경이 동시에 일어나면 순회 안정성이 저하됩니다.

### 해결
- 블랙홀은 `update(delta)` 내부의 **동기적 누적 타이머**(`timeSinceLastSpawn`, `timeSinceLastDamageTick`)로만 처리했습니다.
- 피해/흡인 대상은 `getActiveObjects()` 스냅샷 배열 기준으로 처리해 순회 중 변경 리스크를 줄였습니다.
- 주기 스폰은 누적형이 아니라 **교체형**으로 유지해 상태 공간을 단순화했습니다.

### 교훈
- **주기형 어빌리티는 `delayedCall`보다 update 기반 누적 타이머가 안전하다.**
- **풀 순회는 스냅샷 후 처리하는 2단계 패턴이 비동기/이벤트 혼합 환경에서 안정적이다.**
- **상태를 줄이는 설계(교체형)는 디버깅 비용을 크게 낮춘다.**

## 2026-02-08: 멀티 보스 전환 시 bossId 스냅샷과 비동기 가드

### 증상
- 레벨 10+ 멀티 보스 구조로 바꾸면, 단일 보스 전제 코드(이벤트 payload, 레이저 취소 범위, 미사일 타겟)가 즉시 꼬일 수 있었음.
- `WAVE_STARTED` 직후 `MonsterSystem`이 먼저 HP 이벤트를 발행하고 보스 엔티티가 나중에 생성되면 초기 HP 상태를 놓칠 수 있었음.
- 미사일/레이저 `delayedCall` 콜백이 웨이브 전환 이후에도 실행되면, 이전 웨이브 상태로 새 웨이브 보스를 건드릴 위험이 있었음.

### 원인
- 보스 식별자 없이 전역 단일 상태(`MONSTER_HP_CHANGED`, `MONSTER_DIED`)를 사용하던 구조.
- 비동기 콜백 실행 시점에 웨이브 문맥이 바뀌어도 캡처한 상태를 검증하지 않음.

### 해결
- `MonsterSystem` 상태를 `Map<bossId, BossState>`로 전환하고 이벤트 payload에 `bossId`를 포함.
- `GameScene`에서 멀티 보스를 동기화한 직후 `publishBossHpSnapshot(bossId)`로 초기 HP 이벤트를 재발행.
- 미사일/레이저 tween/타이머 콜백에 `isGameOver` + `waveNumber snapshot` 가드를 추가.
- 레이저 취소를 전역이 아니라 `cancelBossChargingLasers(bossId)` 범위로 축소.

### 교훈
- **멀티 엔티티 전환 시 식별자(`bossId`) 없는 이벤트는 도메인 버그의 시작점**이다.
- **비동기 콜백은 “예약 시점”이 아니라 “실행 시점”의 웨이브 문맥 검증이 필수**다.
- **초기화 이벤트 순서가 바뀌는 구조에서는 스냅샷 재발행 훅을 명시적으로 둬야 한다.**

## 2026-02-08: 미사일 경로 파괴 구현 시 이벤트 의미와 순회 안전성

### 증상
- 미사일 경로에서 접시를 즉시 파괴하는 기능을 추가할 때, 콤보/폭탄 피해 규칙이 의도와 다르게 동작할 위험이 있었음.
- `ObjectPool.forEach()` 순회 중 바로 파괴를 수행하면 순회 대상 변경(비활성화/릴리즈)과 이벤트 콜백이 겹치며 불안정해질 수 있었음.
- Tween `onUpdate`/`onComplete` 콜백은 게임오버 이후에도 실행될 수 있어 상태 전환 시 부작용 가능성이 있었음.

### 원인
**1. `byAbility`가 단순 메타데이터가 아니라 게임 규칙 분기점**

`DISH_DESTROYED` 이벤트의 `byAbility` 값은 `GameScene.onDishDestroyed()`에서 다음을 직접 결정:
- 일반 접시 콤보 증가 여부 (`if (!byAbility)`)
- 폭탄 파괴 시 플레이어 피해/콤보 리셋 적용 여부

즉, 신규 파괴 소스(미사일 경로)를 추가할 때 `byAbility` 의미를 명시적으로 설계하지 않으면 기존 규칙이 의도와 다르게 바뀔 수 있음.

**2. 풀 순회 중 파괴 실행**

파괴 메서드(`forceDestroy`)는 이벤트 발행과 오브젝트 비활성화/릴리즈 흐름을 트리거하므로,
풀 순회 중 즉시 파괴하면 순회 안정성이 떨어질 수 있음.

**3. 비동기 콜백의 실행 시점**

Tween/Timer 콜백은 예약 시점과 실행 시점의 게임 상태가 다를 수 있음.
게임오버/씬 전환 뒤에도 콜백이 실행되어 추가 파괴/데미지 적용이 일어날 수 있음.

### 해결
```typescript
// 1) byAbility를 호출부에서 명시
if (dish.isDangerous()) {
  dish.forceDestroy(true);   // 폭탄 제거 (피해 없음)
} else {
  dish.forceDestroy(false);  // 일반 접시 직접 처치 (콤보 증가 경로)
}

// 2) 순회 중 즉시 파괴하지 않고 후보 스냅샷 후 처리
const hitCandidates: Dish[] = [];
this.dishPool.forEach((dish) => {
  if (/* 경로 충돌 */) hitCandidates.push(dish);
});
for (const dish of hitCandidates) {
  if (!dish.active) continue;
  // 파괴 처리
}

// 3) 비동기 가드
if (this.isGameOver) return;
```

### 교훈
- **이벤트 payload 의미는 도메인 규칙 그 자체**: `byAbility` 같은 플래그는 단순 부가정보가 아니라 핵심 게임 규칙의 스위치일 수 있다. 신규 파괴/데미지 소스를 추가할 때는 이벤트 의미를 먼저 정의해야 한다.
- **풀 순회와 파괴는 분리**: 순회 단계에서는 후보만 수집하고, 파괴는 별도 단계에서 수행하는 2단계 패턴이 안전하다.
- **비동기 콜백은 항상 상태 가드**: `onUpdate`, `onComplete`, `delayedCall` 콜백 모두 실행 시점 기준으로 `isGameOver`/씬 상태를 검증해야 한다.

## 2024-02-04: 웨이브 시스템 버그 - 접시가 스폰되지 않음

### 증상
- 웨이브 3에서 접시가 전혀 스폰되지 않음
- 게임이 멈춘 것처럼 보임

### 원인
1. **일반 접시 타임아웃 시 카운트 누락**
   - `DISH_MISSED` 이벤트에서 `isDangerous`(지뢰)인 경우만 `dishesDestroyed++` 처리
   - 일반 접시가 타임아웃되면 카운트가 증가하지 않아 웨이브 완료 조건(`dishesDestroyed >= dishCount`)을 영원히 만족하지 못함
   - 웨이브가 완료되지 않으니 다음 웨이브로 넘어가지 않음

2. **위치 데이터 미정리**
   - `startWave()`에서 `activeDishPositions` 배열을 클리어하지 않음
   - 이전 웨이브의 위치 데이터가 남아서 `findValidSpawnPosition()`이 유효한 위치를 찾지 못할 수 있음

### 해결
```typescript
// 1. 모든 접시 타임아웃을 카운트하도록 수정
EventBus.getInstance().on(GameEvents.DISH_MISSED, (...args: unknown[]) => {
  const data = args[0] as { x: number; y: number; isDangerous: boolean };
  this.removeDishPosition(data.x, data.y);
  // 모든 접시 타임아웃을 "처리됨"으로 카운트 (웨이브 진행용)
  this.dishesDestroyed++;
  this.checkWaveComplete();
});

// 2. 웨이브 시작 시 위치 데이터 클리어
startWave(waveNumber: number): void {
  // ...
  this.activeDishPositions = []; // 이전 웨이브 위치 데이터 클리어
  // ...
}
```

### 교훈
- **상태 관리 완전성**: 게임 상태(웨이브, 스폰 카운트 등)를 변경하는 모든 경로를 확인해야 함. 성공 케이스(파괴)뿐 아니라 실패 케이스(타임아웃)도 상태 업데이트가 필요함.
- **상태 초기화**: 새로운 단계(웨이브)가 시작될 때 관련된 모든 상태를 초기화해야 함. 일부만 초기화하면 이전 상태가 새 단계에 영향을 줄 수 있음.
- **웨이브 완료 조건**: `dishesSpawned >= count && dishesDestroyed >= count` 조건에서 모든 접시 처리 경로(파괴, 타임아웃)가 `dishesDestroyed`를 증가시켜야 함.

---

## 2024-02-04: 웨이브 시스템 버그 - 이벤트 데이터 참조 문제

### 증상
- 웨이브 4 이후에서도 접시가 스폰되지 않음
- 이전 수정 후에도 여전히 발생

### 원인
1. **이벤트 데이터에서 객체 참조 사용**
   - `DISH_DESTROYED` 핸들러에서 `data.dish.x`, `data.dish.y` 사용
   - 이벤트 처리 시점에 dish 객체가 이미 `deactivate()`되어 좌표가 변경되었을 수 있음
   - 이벤트 데이터에는 `x`, `y`로 직접 좌표도 전달하고 있었음

2. **removeDishPosition()의 거리 체크가 너무 엄격**
   - 50px 이내일 때만 제거하도록 되어 있음
   - 좌표가 정확히 일치하지 않으면 `activeDishPositions`에서 제거되지 않음
   - 제거되지 않은 위치가 누적되어 `findValidSpawnPosition()`이 유효한 위치를 찾지 못함

### 해결
```typescript
// 1. 객체 참조 대신 직접 좌표 사용
EventBus.getInstance().on(GameEvents.DISH_DESTROYED, (...args: unknown[]) => {
  const data = args[0] as { x: number; y: number }; // dish.x 대신 x 직접 사용
  this.removeDishPosition(data.x, data.y);
  // ...
});

// 2. 거리 체크 제거 - 가장 가까운 것을 항상 제거
removeDishPosition(x: number, y: number): void {
  // ...
  if (closestIndex !== -1) { // 거리 체크 조건 제거
    this.activeDishPositions.splice(closestIndex, 1);
  }
}
```

### 교훈
- **이벤트 데이터는 스냅샷으로 전달**: 이벤트 발생 시점의 값을 직접 전달해야 함. 객체 참조를 전달하면 이벤트 처리 시점에 객체 상태가 변경되어 있을 수 있음.
- **위치 추적 시스템의 신뢰성**: 위치를 추적하는 시스템에서 제거 로직이 실패하면 데이터가 누적되어 전체 시스템이 멈출 수 있음. 제거 로직은 관대하게 설계해야 함.
- **전수조사의 중요성**: 한 웨이브에서 발생한 버그가 다른 웨이브에서도 발생할 수 있음. 비슷한 패턴을 모든 구간에서 점검해야 함.

---

## 2024-02-04: 웨이브 시스템 버그 - delayedCall과 상태 전환 충돌

### 증상
- 웨이브 4에서 접시가 스폰되지 않음
- 이전 수정 후에도 여전히 발생

### 원인
**`delayedCall`로 예약된 콜백이 웨이브 전환 후에 실행됨**

`destroyNearbyDishes()`에서 연쇄 파괴를 `delayedCall`로 예약:
```typescript
this.time.delayedCall(i * 50, () => {
  if (dish.active) {
    EventBus.emit(DISH_DESTROYED, ...);
  }
});
```

시나리오:
1. 웨이브 3의 마지막 접시 파괴
2. 연쇄 파괴로 다른 접시에 대해 50ms 후 파괴 예약
3. 웨이브 3 완료 → 웨이브 4 시작 (`dishesDestroyed = 0`으로 리셋)
4. 예약된 `delayedCall` 콜백 실행 → `DISH_DESTROYED` 이벤트 발생
5. WaveSystem에서 `dishesDestroyed++` (웨이브 4의 카운트가 1이 됨)
6. 카운트가 꼬여서 웨이브 완료 조건 이상 동작

### 해결
```typescript
// 콜백 예약 시 현재 웨이브 저장
const currentWave = this.waveSystem.getCurrentWave();

this.time.delayedCall(i * 50, () => {
  // 웨이브가 바뀌었으면 무시
  if (this.waveSystem.getCurrentWave() !== currentWave) {
    return;
  }
  if (dish.active) {
    EventBus.emit(DISH_DESTROYED, ...);
  }
});
```

### 추가 수정 (웨이브 6 멈춤)
위 수정에서 웨이브가 바뀌면 단순히 `return`했는데, 이 경우 접시가 화면에 남아서 나중에 타임아웃 이벤트 발생 → 카운트 꼬임.

**해결**: 웨이브가 바뀌어도 접시 정리는 수행해야 함 (이벤트만 발생시키지 않음)
```typescript
if (this.waveSystem.getCurrentWave() !== currentWave) {
  dish.deactivate();
  this.dishes.remove(dish);
  this.dishPool.release(dish);
  return; // 이벤트는 발생시키지 않음
}
```

### 교훈
- **비동기 콜백과 상태 전환**: `delayedCall`, `setTimeout`, Promise 등 비동기 콜백은 실행 시점에 상태가 변경되어 있을 수 있음. 콜백 내에서 상태 유효성을 검증해야 함.
- **클로저로 상태 캡처**: 콜백 예약 시점의 상태(웨이브 번호 등)를 클로저로 캡처하여 콜백 실행 시 비교할 수 있음.
- **게임 루프와 지연 실행의 충돌**: 게임 상태가 빠르게 전환될 때 지연 실행된 코드가 잘못된 컨텍스트에서 실행될 수 있음.
- **리소스 정리의 완전성**: 조건부 `return`으로 빠져나갈 때도 리소스(게임 오브젝트 등) 정리는 수행해야 함. 그렇지 않으면 좀비 오브젝트가 남아서 예상치 못한 이벤트를 발생시킴.

---

## 2024-02-04: 오브젝트 풀 - 좀비 객체와 상태 불일치

### 증상
- 특정 웨이브에서 접시 스폰이 멈춤
- `activePool: 1`이지만 화면에 접시가 보이지 않음

### 원인
**1. 오브젝트 풀의 이중 상태 추적 문제**

ObjectPool이 활성 객체를 두 가지 방식으로 추적:
- `obj.active` 플래그 (객체 자체)
- `activeObjects` Set (풀에서 관리)

`acquire()`는 `!obj.active`만 체크하고 `activeObjects`는 체크하지 않음:
```typescript
// 문제 코드
obj = this.pool.find((o) => !o.active);  // activeObjects 체크 안 함
```

시나리오:
1. 접시 A가 `destroy_dish()` → `active = false` (아직 release 전)
2. 이 시점에 `acquire()` 호출 → A를 반환 (active가 false니까)
3. A가 새 위치에서 활성화됨
4. 이벤트 핸들러에서 `release(A)` 호출 → A가 activeObjects에서 삭제
5. A는 화면에 있지만 `getActiveObjects()`에 포함되지 않음

**2. onTimeout()의 비동기 tween 콜백**

```typescript
// 문제 코드
private onTimeout(): void {
  this.active = false;
  emit(DISH_MISSED);      // → release() 호출, activeObjects에서 삭제

  this.scene.tweens.add({
    duration: 100,
    onComplete: () => {
      this.deactivate();  // 100ms 후에 active = false 다시 설정!
    },
  });
}
```

시나리오:
1. 접시 A 타임아웃 → `active = false`
2. `DISH_MISSED` 이벤트 → `release(A)` → activeObjects에서 삭제
3. tween 시작 (100ms)
4. 새 접시 스폰 → `acquire()`가 A를 재사용 → activeObjects에 추가, `active = true`
5. **100ms 후 tween 완료** → `A.deactivate()` → `A.active = false`
6. **A는 activeObjects에 있지만 active = false** → 좀비!

### 해결
```typescript
// 1. acquire()에서 activeObjects도 체크
acquire(): T | null {
  obj = this.pool.find((o) => !o.active && !this.activeObjects.has(o));
  // ...
}

// 2. onTimeout()에서 tween 제거, 즉시 deactivate()
private onTimeout(): void {
  if (!this.active) return;
  this.clearDamageTimer();

  const eventData = { /* 현재 상태 스냅샷 */ };
  this.deactivate();  // 즉시 비활성화

  EventBus.emit(GameEvents.DISH_MISSED, eventData);
}
```

### 추가 수정: activeDishPositions 완전 제거
이벤트 기반 위치 추적(`activeDishPositions`)을 제거하고 ObjectPool을 직접 참조:
```typescript
// WaveSystem 생성자 변경
constructor(scene: Phaser.Scene, getDishPool: () => ObjectPool<Dish>) {
  this.getDishPool = getDishPool;
}

// 활성 접시 수/위치를 ObjectPool에서 직접 조회
const activeCount = this.getDishPool().getActiveCount();
const activeDishes = this.getDishPool().getActiveObjects();
```

### 교훈
- **단일 진실의 원천(SSOT)**: 상태를 여러 곳에서 추적하면 동기화 문제 발생. 하나의 권위 있는 소스만 유지해야 함.
- **오브젝트 풀 재사용 타이밍**: `active` 플래그와 풀의 `activeObjects`가 불일치하면 객체가 잘못 재사용될 수 있음. 두 조건을 모두 체크해야 함.
- **비동기 콜백과 객체 재사용**: tween/timer 콜백이 실행될 때 객체가 이미 재사용되었을 수 있음. 콜백에서 객체 상태를 변경하면 다른 용도로 사용 중인 객체에 영향을 줌.
- **즉시 비활성화 원칙**: 객체를 비활성화할 때는 비동기 애니메이션에 의존하지 말고 즉시 상태를 변경해야 함. 시각적 효과는 별도 객체로 처리하는 것이 안전함.

---

## 2024-02-06: 리팩토링 후 유령 변수(Undefined Variable) 참조로 인한 크래시

### 증상
- 보스 레이저 공격 종료 시 `Uncaught TypeError: Cannot read properties of undefined (reading 'clear')` 발생하며 게임 중단.
- `GameScene.ts:1231:32` 지점에서 발생.

### 원인
**리팩토링 과정에서 제거되거나 변경된 변수가 콜백 함수 내에 남아있음**

1. **변수 누락**: 기존에 `GameScene`에서 직접 관리하던 `laserGraphics` 객체가 `LaserRenderer` 도입 과정에서 클래스 속성에서 제거됨.
2. **지연 실행 콜백(delayedCall)**: `triggerBossLaserAttack` 내의 `this.time.delayedCall` 콜백 함수 내부에 `this.laserGraphics.clear()` 호출이 그대로 남아있었음.
3. **런타임 오류**: 해당 콜백이 실행될 때 `this.laserGraphics`는 `undefined`이므로 `.clear()` 호출 시 TypeError 발생.

### 해결
```typescript
// 1. LaserRenderer에 필요한 메서드 추가
public clear(): void {
  this.graphics.clear();
}

// 2. GameScene의 콜백 내부 코드 수정
this.time.delayedCall(config.fireDuration, () => {
  const index = this.activeLasers.indexOf(laser);
  if (index > -1) {
    this.activeLasers.splice(index, 1);
    if (this.activeLasers.length === 0) {
      // 존재하지 않는 laserGraphics 대신 renderer 사용
      this.laserRenderer.clear();
    }
  }
  this.boss.unfreeze();
});

// 3. update 루프에서 렌더링 호출 최적화
// activeLasers가 비어있을 때도 render()를 호출하여 잔상 제거 보장
this.laserRenderer.render(laserData);
```

### 교훈
- **리팩토링 후 전수 조사**: 특정 기능을 전용 클래스(Renderer 등)로 분리할 때, 기존 파일 내의 모든 참조를 검색(Grep/Search)하여 수정해야 함. 특히 `delayedCall`이나 이벤트 핸들러 내부의 콜백 코드는 놓치기 쉬움.
- **TypeScript 활용**: 클래스 속성을 제거한 후에는 반드시 컴파일(tsc)이나 린트(Lint)를 실행하여 정의되지 않은 참조를 모두 찾아내야 함. (이번 사례는 동적 바인딩이나 타입 체크 생략으로 인해 런타임에 발견됨)
- **Renderer의 책임**: 로직 분리 시 Renderer 클래스는 '그리기'뿐만 아니라 '지우기(clear)' 책임도 명확히 가져야 함.
- **상태 동기화**: `activeLasers` 배열의 상태와 화면에 그려진 그래픽이 항상 일치하도록 `update` 루프에서의 렌더링 호출 구조를 단순화(항상 렌더링)하는 것이 안전함.

### 증상
- 웨이브 1: 업그레이드 선택지 3개 표시
- 웨이브 2: 2개만 표시 (1개 선택했는데 stack=5가 됨)
- 웨이브 3: 1개만 표시
- 웨이브 4: 3개로 복구 (새 게임 시작?)

### 원인
**`hide()` 애니메이션 duration 동안 `selectUpgrade`가 여러 번 호출됨**

```typescript
// 문제 코드
selectUpgrade(upgrade: Upgrade): void {
  this.upgradeSystem.applyUpgrade(upgrade);
  this.hide();  // 애니메이션 시작만 하고 리턴
}

hide(): void {
  this.scene.tweens.add({
    duration: 150,
    onComplete: () => {
      this.visible = false;  // 150ms 후에야 false!
    },
  });
}

update(delta: number): void {
  if (!this.visible) return;  // 150ms 동안은 여전히 true
  // ... hover 체크 계속 실행 ...
  if (box.hoverProgress >= HOVER_DURATION) {
    this.selectUpgrade(box.upgrade);  // 매 프레임마다 호출됨!
  }
}
```

시나리오:
1. 업그레이드 호버 완료 → `selectUpgrade` 호출 → `applyUpgrade` (stack=1)
2. `hide()` 호출 → 애니메이션 시작 (150ms)
3. 다음 프레임 (16ms 후) → `visible`은 아직 true
4. `update()`에서 같은 박스가 여전히 호버 상태 → `selectUpgrade` 다시 호출 (stack=2)
5. 150ms 동안 약 9번 호출 → stack=5 (maxStack 도달)
6. 다음 웨이브에서 해당 업그레이드가 필터링되어 선택지에서 제외

### 해결
```typescript
selectUpgrade(upgrade: Upgrade): void {
  // 중복 호출 방지: 이미 처리 중이면 무시
  if (!this.visible) return;

  // 즉시 visible을 false로 설정
  this.visible = false;

  this.upgradeSystem.applyUpgrade(upgrade);
  this.hideWithAnimation();  // 애니메이션은 별도 메서드로
}

hide(): void {
  if (!this.visible) return;
  this.visible = false;  // 즉시 상태 변경
  this.hideWithAnimation();
}

private hideWithAnimation(): void {
  this.scene.tweens.add({
    duration: 150,
    onComplete: () => {
      this.mainContainer.setVisible(false);
      this.clearBoxes();
    },
  });
}
```

### 교훈
- **상태 변경은 애니메이션보다 먼저**: UI 상태(`visible`)는 애니메이션 시작 전에 즉시 변경해야 함. 애니메이션 `onComplete`에서 상태를 변경하면 그 사이에 여러 번 호출될 수 있음.
- **게임 루프와 애니메이션의 타이밍**: `update()`는 매 프레임(~60fps, 16ms)마다 호출되지만 tween 애니메이션은 수백 ms가 걸림. 이 시간 차이로 인해 같은 조건이 여러 번 만족될 수 있음.
- **guard clause의 위치**: 중복 실행을 막는 체크는 함수의 최상단에 있어야 하며, 상태 변경도 최상단에서 즉시 이루어져야 함.
- **비동기 UI 패턴**: `visible` 상태와 시각적 표시를 분리. 논리적 상태는 즉시 변경하고, 시각적 애니메이션은 별도로 처리.

---

## 입력 stuck(한 방향 자동 이동) 재발 방지

### 증상
- 포인터와 키보드를 번갈아 사용할 때 커서가 한 방향으로 계속 이동하거나, 순간적으로 조작이 먹지 않는 현상이 드물게 발생.

### 원인
- 키 `keyup` 이벤트가 포커스 이탈/복귀 구간에서 누락되면 `isDown`이 true로 남아 update 루프에서 이동 벡터가 계속 누적될 수 있음.
- 포인터 좌표는 직접 대입되고 키보드 경로만 clamp되어 입력 경로별 경계 처리 정책이 분리되어 있었음.
- 포인터 최신 입력과 키보드 폴링 간 우선순위 정책이 없어 stale 키 상태가 포인터 제어를 밀어내는 순간이 생김.

### 해결
- `GameScene`에 `resetMovementInput()`을 추가해 키 상태를 강제 초기화.
- `window blur`, `document.visibilitychange(hidden)`, `Phaser input gameout`, pause/resume 시 `resetMovementInput()` 실행.
- 포인터/키보드 모두 `applyCursorPosition()`(공통 clamp)으로 좌표 반영.
- `lastInputDevice`, `lastPointerMoveAt`, `player.input.pointerPriorityMs`로 포인터 최신 입력 우선 정책 적용.
- 추가 리스너는 `SHUTDOWN`에서 명시적으로 해제하여 씬 재진입 누적 방지.

### 교훈
- 키보드 폴링 기반 이동(`isDown`)은 항상 "상태 리셋 경로"를 함께 설계해야 함.
- 혼합 입력(포인터+키보드)에서는 입력 장치 우선순위를 데이터 기반으로 명시해야 UX가 안정적임.
- 입력 경계 처리(clamp)는 경로별 분기가 아니라 단일 함수(SSOT)로 통합해야 함.

---

## 입력 로직 일반화(축 가속) 적용 교훈

### 변경
- `GameScene` 내부에 흩어져 있던 키 상태/우선순위/가속 계산을 `PlayerCursorInputController`로 추상화.
- 키보드 이동은 디지털 벡터 대신 연속 축(axis)으로 계산하고, 키다운 시 `player.input.keyboardAxisRampUpMs` 동안 0에서 목표축까지 선형 가속.
- 키업 시 축 값은 즉시 0으로 복귀하고, 반대 방향 전환 시 기존 축 잔량을 버리고 0 기준으로 재가속.

### 교훈
- 입력 정책(우선순위, 가속, 리셋)은 Scene 본문에서 직접 다루기보다 전용 컨트롤러로 캡슐화해야 회귀 테스트와 유지보수가 쉬워짐.
- 축 가속은 체감 품질 요소이므로 하드코딩 대신 JSON SSOT로 노출해 밸런싱 반복 비용을 줄여야 함.
- 포인터 우선 유예와 축 가속을 함께 사용할 때는 "유예 중 축 누적 금지"를 명시적으로 처리해야 의도치 않은 점프가 사라짐.
