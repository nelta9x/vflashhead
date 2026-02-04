# Lessons Learned

프로젝트 개발 중 발견한 버그와 교훈을 기록합니다.

---

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
