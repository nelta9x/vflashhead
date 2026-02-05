# Claude Code 지침

## 프로젝트 개요
Vibeshooter - Phaser 3 기반 웹 슈팅 게임

## 기술 스택
- TypeScript
- Phaser 3
- Vite
- Vitest (테스트)

## 주요 명령어
- `npm run dev` - 개발 서버 실행
- `npm run build` - 프로덕션 빌드
- `npm test` - 테스트 실행

## 참고 문서
- **LESSONS.md** - 개발 중 발견한 버그와 교훈 모음. 유사한 실수를 반복하지 않도록 반드시 참고할 것.
- **src/data/README.md** - 게임 밸런스 조절 가이드. 밸런스 수정이 필요하거나 각 데이터 필드의 의미를 알고 싶을 때 참고.

## 코드 규칙

### 디버깅
- `console.log`는 디버그 용도로만 사용
- 분석/디버깅을 마친 후에는 **반드시 모든 console.log를 제거**할 것
- 프로덕션 코드에 console.log가 남아있으면 안 됨

## 코드 구조
```
src/
├── data/         # 게임 데이터, 설정, 상수 (DataManager 및 JSON)
├── effects/      # 파티클, 화면 효과
├── entities/     # 게임 엔티티 (Dish, HealthPack 등)
├── scenes/       # Phaser 씬
├── systems/      # 게임 시스템 (Score, Combo, Wave 등)
├── ui/           # UI 컴포넌트
└── utils/        # 유틸리티 (EventBus, ObjectPool 등)
```

## 데이터 및 설정 원칙

### 1. 집중 관리 원칙 (Single Source of Truth)
- **모든** 게임 밸런스 데이터, 연출용 상수, 기술적 설정은 `src/data` 디렉토리 내에서 관리합니다.
- `src/config` 등 별도의 설정 디렉토리를 만들지 않습니다.

### 2. 데이터 우선 원칙
- 새로운 기능 추가 시, 관련 설정값(수치, 색상, 폰트, 타이밍 등)을 코드에 직접 쓰지 말고 반드시 JSON 파일(`src/data/*.json`)에 먼저 정의한 후 `DataManager`를 통해 불러와 사용합니다.
- 밸런스 디자이너가 소스 코드를 열지 않고도 모든 수치를 조절할 수 있도록 설계해야 합니다.

### DataManager 사용법
```typescript
import { Data } from '../data/DataManager';
// 또는 상수로 정의된 값이 필요한 경우
import { COLORS, FONTS } from '../data/constants';

// 예시
const playerHp = Data.gameConfig.player.initialHp;
const mainFont = FONTS.MAIN;
```

### 데이터 파일 구조
| 파일 | 설명 |
|------|------|
| `game-config.json` | 화면, 플레이어, UI, 폰트, 자기장 등 전역 설정 |
| `constants.ts` | JSON 데이터를 코드에서 쓰기 편하게 만든 상수들 |
| `game.config.ts` | Phaser 엔진 기술 설정 |
| `spawn.json` | 스폰 영역 및 로직 설정 |
| `combo.json` | 콤보 타임아웃 및 배율 공식 |
| `health-pack.json` | 힐팩 관련 모든 수치 |
| `feedback.json` | 화면 흔들림, 슬로우모션, 파티클 등 연출 설정 |
| `colors.json` | 게임 내 모든 색상 팔레트 |
| `waves.json` | 웨이브 구성 및 난이도 곡선 |
| `dishes.json` | 접시(적) 종류별 상세 스탯 |
| `upgrades.json` | 업그레이드 확률 및 효과 정의 |
| `weapons.json` | 무기 기본 데이터 |

### 밸런스 조절 가이드
1. **난이도 조절**: `waves.json`의 `spawnInterval`, `dishTypes` 가중치 수정
2. **콤보 시스템**: `combo.json`의 `timeout`, `milestones` 수정
3. **접시 밸런스**: `dishes.json`의 `hp`, `points`, `lifetime` 수정
4. **업그레이드 출현율**: `upgrades.json`의 `rarityWeights` 수정
5. **힐팩 스폰**: `health-pack.json`의 `spawnChanceByHp` 수정

### 데이터 관리 원칙
- **연출용 상수(색상, 폰트 크기, 애니메이션 타이밍 등)도 반드시 data 디렉토리의 JSON 파일로 관리**
- 코드에 하드코딩된 연출 관련 숫자 값이 있으면 적절한 JSON 파일로 이동할 것
- 새로운 연출 시스템 추가 시 관련 설정을 `feedback.json` 또는 적절한 JSON 파일에 정의

> 📖 **상세 가이드**: 각 JSON 파일의 모든 필드에 대한 자세한 설명은 `src/data/README.md`를 참고하세요.
