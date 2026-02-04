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

## 코드 규칙

### 디버깅
- `console.log`는 디버그 용도로만 사용
- 분석/디버깅을 마친 후에는 **반드시 모든 console.log를 제거**할 것
- 프로덕션 코드에 console.log가 남아있으면 안 됨

## 코드 구조
```
src/
├── config/       # 게임 설정, 상수
├── data/         # JSON 데이터 (웨이브, 무기 등)
├── effects/      # 파티클, 화면 효과
├── entities/     # 게임 엔티티 (Dish, HealthPack 등)
├── scenes/       # Phaser 씬
├── systems/      # 게임 시스템 (Score, Combo, Wave 등)
├── ui/           # UI 컴포넌트
└── utils/        # 유틸리티 (EventBus, ObjectPool 등)
```
