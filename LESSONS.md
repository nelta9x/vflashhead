# Lessons Learned

프로젝트 개발 중 발견한 버그와 교훈을 기록합니다.

---

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
