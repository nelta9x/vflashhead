# 🗺️ CODEMAP: Vibeshooter Project Structure

이 문서는 개발자와 AI 에이전트가 프로젝트의 구조를 빠르게 파악하고 필요한 기능을 찾을 수 있도록 돕기 위해 작성되었습니다.

## 🏗️ 전체 아키텍처 및 흐름

### 1. 진입점 및 씬 (Scenes)
- **`src/main.ts`**: 게임 인스턴스 생성 및 씬 등록 (`Boot`, `Menu`, `Game`, `GameOver`).
- **`src/scenes/GameScene.ts`**: **핵심 게임 루프**. 모든 시스템을 초기화하고 조율하며, 매 프레임 `update()`를 통해 하위 시스템들을 업데이트합니다.

### 2. 핵심 게임 로직 (Systems)
`src/systems/` 디렉토리에는 특정 기능을 담당하는 독립적인 클래스들이 위치합니다.
- **`WaveSystem.ts`**: 웨이브 구성, 적 스폰 타이밍, 카운트다운 관리. `waves.json` 설정을 기반으로 하며, 모든 적이 처리되면 `WAVE_COMPLETED`를 발생시킵니다.
- **`ComboSystem.ts`**: 콤보 증가, 타임아웃 처리, 마일스톤 관리. 콤보 수치에 따라 `COMBO_MILESTONE` 이벤트를 발생시켜 연출을 트리거합니다.
- **`UpgradeSystem.ts`**: 플레이어 어빌리티 관리 및 업그레이드 효과 적용. `upgrades.json`의 확률 기반으로 선택지를 생성합니다.
- **`HealthSystem.ts`**: 플레이어 HP 관리. 데미지 수신 및 `HP_CHANGED` 이벤트를 통해 HUD와 연동됩니다.
- **`MonsterSystem.ts`**: 보스 몬스터의 HP 관리 및 사망 로직. 웨이브 시작 시 `waves.json`의 설정을 기반으로 보스 HP를 설정합니다.
- **`GaugeSystem.ts`**: 콤보 수치에 따라 공격 게이지를 충전합니다. 게이지가 100%가 되면 `PLAYER_ATTACK` 이벤트를 발생시킵니다.
- **`ScoreSystem.ts`**: 접시 파괴 시 점수 계산 및 콤보 배율 적용.
- **`SoundSystem.ts`**: 오디오 재생 관리 (싱글톤). 환경설정에 따른 볼륨 조절 및 효과음 재생.
- **`FeedbackSystem.ts`**: 시각적/청각적 피드백을 조율. `ParticleManager`, `ScreenShake`, `SlowMotion`, `DamageText`를 통합 제어하여 타격감을 생성합니다.
- **`HealthPackSystem.ts`**: 플레이어 HP 상태에 따라 확률적으로 힐팩을 스폰합니다.

### 3. 엔티티 및 오브젝트 (Entities)
`src/entities/` 디렉토리에는 물리적인 게임 오브젝트가 위치하며, `ObjectPool`에 의해 재사용됩니다.
- **`Dish.ts`**: 주요 적인 '접시'. 
  - `spawn()`: 초기화 및 애니메이션 시작.
  - `applyDamage()`: HP 감소 및 파괴 로직.
  - `update()`: 생존 시간 체크 및 이동 로직.
- **`HealthPack.ts`**: 낙하하는 아이템 오브젝트. 커서와 충돌 시 HP를 회복시킵니다.

### 4. 시각 효과 및 UI (Effects & UI)
- **`src/effects/`**: 
  - `ParticleManager`: 폭발 및 피격 파티클 생성.
  - `ScreenShake`: 카메라 흔들림 효과.
  - `SlowMotion`: 게임 속도(TimeScale) 조절.
  - `CursorTrail`: 커서의 움직임을 따라가는 잔상 효과.
- **`src/ui/`**: 
  - `HUD`: 실시간 점수, HP 바, 보스 HP 바, 웨이브 정보 표시.
  - `InGameUpgradeUI`: 웨이브 사이 업그레이드 선택 화면.
  - `AbilityPanel`: 현재 보유한 업그레이드 목록 표시 (DOM 기반).
  - `DamageText`: 타격 시 데미지 수치 팝업.
  - `WaveCountdownUI`: 다음 웨이브 시작 전 카운트다운 표시.

---

## 💾 데이터 및 설정 (Data Management)

모든 설정은 **Data-Driven** 방식으로 관리됩니다. 코드에 숫자를 하드코딩하지 마십시오.

- **`data/DataManager.ts`**: 모든 JSON 데이터를 로드하여 타입 안전하게 제공하는 싱글톤 (`Data` 상수로 내보냄).
- **`data/constants.ts`**: JSON 기반 데이터 중 코드에서 자주 쓰이는 물리/기하학적 상수.
- **`data/game.config.ts`**: Phaser 엔진 기술 설정 (물리, 렌더링 등).
- **데이터 파일 목록 (`data/*.json`)**:
  - `game-config.json`: 전역 설정, 플레이어 스탯, UI 레이아웃, 폰트 설정.
  - `colors.json`: 게임 내 모든 색상 팔레트 및 테마.
  - `dishes.json`: 적 종류별 체력, 포인트, 속도, 스케일 설정.
  - `waves.json`: 웨이브별 구성, 난이도 곡선, 보스 HP 설정.
  - `upgrades.json`: 업그레이드 어빌리티 정의, 확률(Rarity), 효과 수치.
  - `feedback.json`: 연출용 수치 (흔들림 강도, 파티클 개수, 슬로우모션 강도, 커서 트레일 설정).
  - `combo.json`: 콤보 타임아웃, 마일스톤 및 배율 공식.
  - `health-pack.json`: 힐팩 스폰 확률 및 회복량 설정.
  - `spawn.json`: 스폰 영역(Area) 및 로직 설정.
  - `weapons.json`: 무기(공격) 기본 데미지 및 관련 데이터.

---

## 📡 통신 맵 (EventBus)

시스템 간의 결합도를 낮추기 위해 `EventBus`를 통한 이벤트 기반 통신을 사용합니다.
모든 이벤트 정의는 `src/utils/EventBus.ts`의 `GameEvents` 객체에 있습니다.

| 이벤트 카테고리 | 주요 이벤트 | 발생 시점 | 주요 구독자 |
|-----------------|-------------|-----------|-------------|
| **접시(적)** | `DISH_DESTROYED` | 접시 파괴 시 | `WaveSystem`, `ComboSystem`, `GameScene`(피드백) |
| | `DISH_ESCAPED` | 접시가 화면 밖으로 나갈 때 | `HealthSystem`, `ComboSystem` |
| **웨이브** | `WAVE_COMPLETED` | 모든 접시 처리 시 | `GameScene`(UI 표시), `WaveSystem`, `UpgradeSystem` |
| | `WAVE_STARTED` | 웨이브 정식 시작 시 | `MonsterSystem`, `WaveCountdownUI` |
| **플레이어 상태** | `HP_CHANGED` | 데미지/회복 발생 시 | `HUD`, `GameScene`(피드백), `HealthPackSystem` |
| | `SCORE_CHANGED` | 점수 갱신 시 | `HUD` |
| **콤보 & 게이지** | `COMBO_MILESTONE` | 특정 콤보 수 도달 시 | `GameScene`(연출 트리거) |
| | `GAUGE_UPDATED` | 게이지 수치 변경 시 | `HUD`, `GameScene`(커서 연출) |
| | `PLAYER_ATTACK` | 게이지 완충 후 공격 시 | `GameScene`(보스 공격 연출), `MonsterSystem` |
| **보스(몬스터)** | `MONSTER_HP_CHANGED`| 보스 HP 변화 시 | `HUD` |
| | `MONSTER_DIED` | 보스 사망 시 | `GameScene`(연출) |

---

## 🛠️ 주요 유틸리티

- **`ObjectPool.ts`**: 빈번하게 생성/삭제되는 `Dish`와 `HealthPack` 리소스를 관리하여 가비지 컬렉션 부하를 줄임.
- **`EventBus.ts`**: 전역 이벤트 발행/구독 시스템.
- **`src/utils/EventBus.ts`**: 모든 게임 이벤트 상수가 정의된 곳.

---

## 💡 새로운 기능 추가 가이드

1. **데이터 정의**: `data/*.json`에 필요한 상수나 설정을 먼저 추가합니다.
2. **시스템 작성/수정**: `src/systems/`에 로직을 구현합니다.
3. **이벤트 연결**: 새로운 상태 변화가 있다면 `GameEvents`에 추가하고 `EventBus`로 알립니다.
4. **GameScene 연동**: `GameScene.initializeSystems()`에서 생성하고 `update()`에서 호출합니다.
5. **테스트 작성**: `tests/` 디렉토리에 Vitest 기반의 단위 테스트를 추가합니다.

---

## 🧪 테스트 실행

```bash
npm test              # 모든 테스트 실행 (Run once)
npm test -- <path>    # 특정 파일만 테스트
```
