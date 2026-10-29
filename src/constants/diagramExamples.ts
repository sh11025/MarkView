export interface DiagramExample {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const DIAGRAM_EXAMPLES: DiagramExample[] = [
  {
    id: 'approval',
    name: '신청·승인 프로세스',
    description: '신청서 작성, 검토, 승인/반려 및 재작성 순환 흐름',
    code: `flowchart TD
  A(["신청서 작성"]):::mv-indigo --> B["부서장 검토"]
  B --> C{"승인 여부"}:::mv-amber
  C -->|"승인"| D["총무팀 접수"]:::mv-emerald
  C -->|"반려"| E["수정 요청"]:::mv-rose
  E --> A
  D --> F(["최종 완료"]):::mv-indigo`,
  },
  {
    id: 'decision',
    name: '의사결정 (예/아니오 분기)',
    description: '문제 정의 후 조건 판별 및 대안 실행 흐름',
    code: `flowchart TD
  A["문제 정의"] --> B{"해결책 존재?"}:::mv-amber
  B -->|"예"| C["대안 실행"]:::mv-emerald
  B -->|"아니오"| D["원인 재분석"]:::mv-rose
  D --> E["팀 회의 소집"]
  E --> B
  C --> F(["목표 달성"]):::mv-indigo`,
  },
  {
    id: 'incident',
    name: '장애 대응 흐름',
    description: '장애 감지부터 등급 판정, 긴급 소집, 핫픽스 배포까지',
    code: `flowchart TD
  A(["장애 감지"]):::mv-rose --> B["상황 전파 및 분류"]:::mv-amber
  B --> C{"긴급 장애?"}:::mv-amber
  C -->|"심각"| D["비상 대응팀 소집"]:::mv-rose
  C -->|"경미"| E["담당자 패치 작업"]:::mv-indigo
  D --> F["핫픽스 배포"]:::mv-emerald
  E --> F
  F --> G(["모니터링 및 정상화"]):::mv-emerald`,
  },
  {
    id: 'kanban',
    name: '작업 진행 (할 일 → 진행 → 완료)',
    description: '작업 상태 전이 및 검토 승인 흐름',
    code: `flowchart LR
  A["할 일"]:::mv-slate --> B["진행 중"]:::mv-indigo
  B --> C["검토 요청"]:::mv-amber
  C --> D{"승인?"}:::mv-amber
  D -->|"통과"| E(["완료"]):::mv-emerald
  D -->|"수정 필요"| B`,
  },
];
