import type { DocumentTemplate } from './types';

export const DIAGRAM_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'flowchart-sample',
    category: '다이어그램',
    name: '순서도 예시',
    description: '조건 분기, 반복, 시작과 종료를 시각화한 표준 Mermaid 순서도(Flowchart)',
    content: `# 순서도(Flowchart) 템플릿

사용자 인증 및 권한 확인 절차를 시각적으로 나타낸 순서도 예제입니다.

## 1. 인증 흐름 순서도
\`\`\`mermaid
flowchart TD
    Start(["사용자 요청 시작"]) --> Input["아이디 및 비밀번호 입력"]
    Input --> Validate{"입력 형식 유효?"}
    
    Validate -- 아니오 --> ShowError["입력 형식 오류 안내"]
    ShowError --> Input
    
    Validate -- 예 --> CheckDB{"사용자 정보 일치?"}
    CheckDB -- 불일치 --> AuthFail["비밀번호 불일치 알림"]
    AuthFail --> RetryCount{"5회 연속 실패?"}
    
    RetryCount -- 예 --> AccountLock["계정 임시 잠금"]
    RetryCount -- 아니오 --> Input
    
    CheckDB -- 일치 --> IssueToken["인증 토큰(JWT) 발급"]
    IssueToken --> Redirect["메인 대시보드로 이동"]
    Redirect --> End(["로그인 완료"])
\`\`\`

---

## 2. 노드 및 흐름 설명
| 노드 모양 | 의미 | 예시 |
| :---: | :---: | --- |
| \`([" ... "])\` | 시작 및 종료 (Terminal) | \`Start(["사용자 요청 시작"])\` |
| \`[" ... "]\` | 처리 및 일반 작업 (Process) | \`Input["아이디 및 비밀번호 입력"]\` |
| \`{" ... "}\` | 조건 판단 및 분기 (Decision) | \`Validate{"입력 형식 유효?"}\` |

> [!TIP]
> 다이어그램을 더블클릭하면 캔버스 편집기를 통해 노드를 시각적으로 추가하고 연결선을 수정할 수 있습니다.
`,
  },
  {
    id: 'sequence-diagram-sample',
    category: '다이어그램',
    name: '시퀀스 다이어그램 예시',
    description: '클라이언트, API 서버, DB 간의 시간 순 메시지 흐름을 표현한 시퀀스 다이어그램',
    content: `# 시퀀스 다이어그램(Sequence Diagram) 템플릿

시스템 컴포넌트 간 상호작용과 메시지 교환 순서를 나타내는 다이어그램 예제입니다.

## 1. 결제 승인 프로세스 다이어그램
\`\`\`mermaid
sequenceDiagram
    autonumber
    actor User as 사용자
    participant App as 프론트엔드 앱
    participant Server as 결제 서버
    participant PG as 결제대행사
    participant DB as 결제 DB

    User->>App: 결제하기 버튼 클릭
    App->>Server: 주문 준비 요청
    Server->>DB: 주문 대기 상태 저장
    DB-->>Server: 주문 번호 생성
    Server-->>App: 주문 번호 및 호출 정보 반환

    App->>PG: 결제 인증창 호출
    User->>PG: 카드 정보 입력 및 본인 인증
    PG-->>App: 결제 인증 토큰 전달

    App->>Server: 결제 승인 요청
    Server->>PG: 결제 최종 승인 요청
    PG-->>Server: 승인 완료 응답
    Server->>DB: 결제 완료 상태 업데이트
    Server-->>App: 결제 완료 응답
    App-->>User: 주문 완료 화면 표시
\`\`\`

---

## 2. 단계별 상세 시나리오
1. **결제 준비**: 사용자가 결제를 요청하면 백엔드에서 사전 주문 레코드를 생성합니다.
2. **PG 인증**: 사용자는 보안 결제창을 통해 안전하게 카드 인증을 수행합니다.
3. **최종 승인**: 백엔드가 PG사와 직접 통신하여 위변조를 방지하고 결제를 최종 확정합니다.
`,
  },
  {
    id: 'org-chart-mermaid',
    category: '다이어그램',
    name: '조직도(mermaid)',
    description: '경영진부터 개발, 디자인, 마케팅 부서까지의 지휘 체계를 나타낸 조직도',
    content: `# 조직도(Organization Chart) 템플릿

회사의 부서 구조와 보고 체계를 시각적으로 표현한 조직도 다이어그램입니다.

## 1. 전사 조직 구성도
\`\`\`mermaid
graph TD
    CEO["대표이사: 홍길동"]
    
    CEO --> CTO["기술총괄: 이순신"]
    CEO --> COO["운영총괄: 강감찬"]
    CEO --> CFO["재무총괄: 신사임당"]

    CTO --> FE_TEAM["웹 프론트엔드팀 (5명)"]
    CTO --> BE_TEAM["서버 백엔드팀 (6명)"]
    CTO --> DEVOPS_TEAM["인프라·데브옵스팀 (3명)"]

    COO --> PRODUCT_TEAM["프로덕트 기획팀 (4명)"]
    COO --> DESIGN_TEAM["UI·UX 디자인팀 (3명)"]
    COO --> GROWTH_TEAM["그로스 마케팅팀 (4명)"]

    CFO --> FINANCE["회계·세무 파트 (2명)"]
    CFO --> HR["인사·총무 파트 (3명)"]
\`\`\`

---

## 2. 부서별 주요 R&R (역할과 책임)
| 부서명 | 주요 담당 업무 | 핵심 산출물 |
| --- | --- | --- |
| **프론트엔드팀** | 사용자 인터페이스 개발, 반응형 웹 최적화 | 웹 애플리케이션 번들 |
| **백엔드팀** | 분산 API 개발, 데이터베이스 설계 및 운영 | 비즈니스 로직 API |
| **프로덕트 기획팀** | 제품 로드맵 수립, 사용자 요구사항 정의 | 기능 기획서, PRD |
| **디자인팀** | 사용자 경험 설계, 디자인 시스템 구축 | Figma UI 컴포넌트 |
`,
  },
  {
    id: 'mindmap-outline',
    category: '다이어그램',
    name: '마인드맵형 정리(목록 중첩)',
    description: '들여쓰기 중첩 목록과 이모지를 활용해 복잡한 생각을 발산하고 구조화하는 아이디어 맵',
    content: `# 마인드맵형 아이디어 정리 (브레인스토밍)

복잡한 생각과 프로젝트 아이디어를 계층적 트리 구조로 발산하고 정리한 마인드맵형 문서입니다.

---

## 🧠 중심 주제: 차세대 웹 기반 문서 작업 도구

- 🚀 **1. 핵심 제품 가치 (Core Value)**
  - ⚡ **초고속 반응성**
    - 0초 로딩 (Local-first 브라우저 캐싱)
    - 타이핑 딜레이 제로 가상화 스크롤
  - 🔒 **철저한 개인정보 보호**
    - 오프라인 단독 구동 지원
    - 사용자 컴퓨터(로컬 디스크)에만 암호화 저장
  - 🎨 **풍부한 표현력**
    - Mermaid 다이어그램 실시간 편집
    - KaTeX 기반 학술 수학 수식 지원
    - 깃허브 스타일 경고 콜아웃(Alerts)

- 👥 **2. 주요 타깃 사용자군 (Target Users)**
  - 💻 **소프트웨어 개발자**
    - 마크다운 친화적 작성 환경
    - 코드 하이라이팅 및 Git 연동 필요성
  - 🎓 **학생 및 학술 연구원**
    - 강의 필기, 수식 표기, 논문 요약
  - ✍️ **블로거 및 콘텐츠 크리에이터**
    - 정돈된 서식, 간편한 이미지 첨부

- 💰 **3. 비즈니스 및 확장 전략**
  - 🆓 **오픈소스 커뮤니티 에디션**
    - 누구나 자유롭게 사용할 수 있는 핵심 기능
  - 🔌 **플러그인 마켓플레이스**
    - 노션, 구글 드라이브 연동 서드파티 확장
  - 🏢 **기업용 프라이빗 구축형**
    - 사내 폐쇄망 전용 온프레미스 패키징

---

## 📊 아이디어 우선순위 매트릭스
| 순위 | 실행 과제 | 기대 효과 | 구현 난이도 | 착수 예정 |
| :---: | --- | :---: | :---: | :---: |
| 1 | 오프라인 PWA 설치 환경 강화 | 높음 | 보통 | 즉시 |
| 2 | 40종 표준 문서 템플릿 기본 내장 | 매우 높음 | 쉬움 | 완료 |
| 3 | 다이어그램 드래그앤드롭 캔버스 에디터 | 높음 | 어려움 | 차기 버전 |
`,
  },
];
