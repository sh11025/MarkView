/**
 * 다이어그램 템플릿 갤러리 데이터 (지연 로딩 전용 모듈).
 * 순서도, 시퀀스, 클래스, 상태, ER, 간트, 파이, 마인드맵, 타임라인 9개 종류 총 20개 예시.
 * 모든 노드 라벨의 괄호·쌍점·슬래시 등은 큰따옴표로 안전하게 감싸 문법 오류가 없도록 검증됨.
 */

export const DIAGRAM_GALLERY_CATEGORIES = [
  '순서도',
  '시퀀스',
  '클래스',
  '상태',
  'ER',
  '간트',
  '파이',
  '마인드맵',
  '타임라인',
] as const;

export type DiagramGalleryCategory = (typeof DIAGRAM_GALLERY_CATEGORIES)[number];

export interface DiagramGalleryTemplate {
  id: string;
  category: DiagramGalleryCategory;
  name: string;
  description: string;
  code: string;
  /** 순서도(flowchart) 예시여서 캔버스 편집기로 바로 열 수 있는지 여부 */
  isFlowchart?: boolean;
}

export const DIAGRAM_GALLERY_TEMPLATES: readonly DiagramGalleryTemplate[] = [
  // 1. 순서도 (4개)
  {
    id: 'diag-flow-approval',
    category: '순서도',
    name: '업무 기안 및 결재 프로세스',
    description: '기안서 작성 후 팀장 검토와 임원 최종 승인·반려로 이어지는 표준 결재 흐름도',
    isFlowchart: true,
    code: `flowchart TD
  Draft["기안서 작성 및 상신"] --> Review{"팀장 1차 검토"}
  Review -->|"승인"| Exec{"임원 최종 결재"}
  Review -->|"보완 요청"| Revise["기안서 내용 보완"]
  Revise --> Draft
  Exec -->|"최종 승인"| Done["결재 완료 및 시행"]
  Exec -->|"반려"| Revise`,
  },
  {
    id: 'diag-flow-auth',
    category: '순서도',
    name: '로그인 및 2단계 인증 분기',
    description: '아이디·비밀번호 검증과 OTP 2단계 인증 여부를 판단하는 사용자 인증 순서도',
    isFlowchart: true,
    code: `flowchart TD
  Start["로그인 화면 접속"] --> Input["아이디 / 비밀번호 입력"]
  Input --> Check{"계정 정보 일치?"}
  Check -->|"일치"| Mfa{"2단계 인증(OTP) 대상?"}
  Check -->|"불일치"| Retry["오류 안내 및 재시도"]
  Retry --> Input
  Mfa -->|"예"| Otp["인증번호 6자리 확인"]
  Mfa -->|"아니오"| Token["인증 토큰(JWT) 발급"]
  Otp --> Token
  Token --> Home["메인 대시보드 이동"]`,
  },
  {
    id: 'diag-flow-cicd',
    category: '순서도',
    name: 'CI/CD 자동 빌드·배포 파이프라인',
    description: '코드 푸시부터 단위 테스트, 컨테이너 빌드, 운영 서버 무중단 배포까지의 과정',
    isFlowchart: true,
    code: `flowchart LR
  Push["코드 푸시 (Git)"] --> Lint["정적 분석 및 린트"]
  Lint --> Test{"단위·통합 테스트 통과?"}
  Test -->|"통과"| Build["컨테이너 이미지 빌드"]
  Test -->|"실패"| Alert["개발팀 알림 발송"]
  Build --> Deploy["운영 환경 무중단 배포"]
  Deploy --> Monitor["상태 모니터링"]`,
  },
  {
    id: 'diag-flow-incident',
    category: '순서도',
    name: '서비스 장애 감지 및 대응 절차',
    description: '경보 발생 시 심각도 분류, 핫픽스 배포 또는 롤백, 사후 회고로 이어지는 대응 절차',
    isFlowchart: true,
    code: `flowchart TD
  Alarm["모니터링 경보 발생"] --> Triage{"긴급 장애(Sev-1) 여부"}
  Triage -->|"긴급"| WarRoom["대응 채널 개설 및 담당자 호출"]
  Triage -->|"일반"| Ticket["이슈 티켓 등록 및 순차 처리"]
  WarRoom --> Rollback["직전 안정 버전으로 즉시 롤백"]
  Rollback --> Verify{"서비스 정상화 확인"}
  Verify -->|"정상"| Postmortem["원인 분석 및 재발 방지 대책 수립"]
  Verify -->|"지속"| Hotfix["긴급 패치 적용 및 DB 점검"]
  Hotfix --> Verify`,
  },

  // 2. 시퀀스 (3개)
  {
    id: 'diag-seq-payment',
    category: '시퀀스',
    name: '온라인 결제 승인 흐름',
    description: '고객, 쇼핑몰 서버, 결제 대행사(PG), 카드사 사이의 결제 요청·승인 왕복 시퀀스',
    code: `sequenceDiagram
  autonumber
  actor User as 고객
  participant Shop as 쇼핑몰 서버
  participant PG as 결제 대행사
  participant Card as 카드사
  User->>Shop: 주문서 작성 및 결제 요청
  Shop->>PG: 거래 등록 및 결제창 호출
  PG->>Card: 카드 승인 요청
  Card-->>PG: 승인 번호 발급
  PG-->>Shop: 결제 완료 웹훅 통보
  Shop-->>User: 주문 완료 안내 표시`,
  },
  {
    id: 'diag-seq-jwt',
    category: '시퀀스',
    name: 'JWT 로그인 및 API 인가',
    description: '로그인 후 액세스 토큰을 발급받아 보호된 API 자원을 조회하는 인증 시퀀스',
    code: `sequenceDiagram
  autonumber
  actor Client as 웹 브라우저
  participant Auth as 인증 서버
  participant DB as 회원 DB
  participant Api as 리소스 API
  Client->>Auth: 로그인 요청 (아이디, 비밀번호)
  Auth->>DB: 계정 및 비밀번호 해시 조회
  DB-->>Auth: 회원 정보 반환
  Auth-->>Client: Access 토큰 및 Refresh 토큰 발급
  Client->>Api: 보호 자원 요청 (Bearer 토큰 포함)
  Api-->>Client: 검증 성공 및 데이터 응답`,
  },
  {
    id: 'diag-seq-chat',
    category: '시퀀스',
    name: '고객 문의 챗봇 및 상담원 연결',
    description: 'FAQ 자동 응답 후 추가 문의 시 전문 상담원에게 대화 맥락을 인계하는 흐름',
    code: `sequenceDiagram
  autonumber
  actor Customer as 고객
  participant Bot as AI 챗봇
  participant Queue as 상담 대기열
  participant Agent as 전문 상담원
  Customer->>Bot: 문의 메시지 입력
  Bot->>Bot: 자주 묻는 질문(FAQ) 검색
  alt FAQ 답변 일치
    Bot-->>Customer: 즉시 자동 안내 답변
  else 상담원 연결 요청
    Bot->>Queue: 대화 맥락과 함께 접수 등록
    Queue->>Agent: 순번 배정 및 상담 알림
    Agent-->>Customer: 1대1 실시간 상담 시작
  end`,
  },

  // 3. 클래스 (2개)
  {
    id: 'diag-class-order',
    category: '클래스',
    name: '주문·결제 도메인 클래스 구조',
    description: '고객(Customer), 주문(Order), 주문항목(OrderItem), 결제(Payment) 간의 객체 관계도',
    code: `classDiagram
  class Customer {
    +String id
    +String name
    +String email
    +placeOrder()
  }
  class Order {
    +String orderId
    +Date createdAt
    +String status
    +calculateTotal()
  }
  class OrderItem {
    +String productId
    +int quantity
    +int unitPrice
    +getSubtotal()
  }
  class Payment {
    +String paymentId
    +int amount
    +String method
    +approve()
  }
  Customer "1" --> "*" Order : 주문생성
  Order "1" *-- "1..*" OrderItem : 포함
  Order "1" --> "1" Payment : 결제처리`,
  },
  {
    id: 'diag-class-auth',
    category: '클래스',
    name: '회원 권한 및 역할 상속 구조',
    description: '기본 계정(User)을 상속받는 일반 회원, 편집자, 관리자의 클래스 계층 구조',
    code: `classDiagram
  class User {
    +String userId
    +String email
    +login()
    +logout()
  }
  class Member {
    +int mileage
    +writeComment()
  }
  class Editor {
    +String department
    +publishArticle()
  }
  class Admin {
    +int securityLevel
    +manageUsers()
    +viewAuditLog()
  }
  User <|-- Member
  User <|-- Editor
  User <|-- Admin`,
  },

  // 4. 상태 (2개)
  {
    id: 'diag-state-order',
    category: '상태',
    name: '쇼핑몰 주문·배송 상태 전이도',
    description: '결제 대기부터 상품 준비, 배송 중, 구매 확정 및 취소·환불까지의 상태 변화',
    code: `stateDiagram-v2
  [*] --> 결제대기
  결제대기 --> 결제완료 : 결제 승인
  결제대기 --> 주문취소 : 기한 만료 / 고객 취소
  결제완료 --> 상품준비중 : 발주 확인
  결제완료 --> 환불완료 : 결제 취소
  상품준비중 --> 배송중 : 택배사 인계
  배송중 --> 배송완료 : 수령 확인
  배송완료 --> 구매확정 : 7일 경과 / 확정 클릭
  주문취소 --> [*]
  환불완료 --> [*]
  구매확정 --> [*]`,
  },
  {
    id: 'diag-state-task',
    category: '상태',
    name: '이슈 티켓 생명주기 상태도',
    description: '이슈 등록 후 담당자 배정, 개발 진행, 코드 리뷰, QA 검증 및 종료 상태 흐름',
    code: `stateDiagram-v2
  [*] --> 백로그
  백로그 --> 진행중 : 담당자 배정 및 착수
  진행중 --> 코드리뷰 : 구현 완료 및 PR 생성
  코드리뷰 --> 진행중 : 수정 요청 반영
  코드리뷰 --> QA검증 : 리뷰 승인 및 병합
  QA검증 --> 진행중 : 결함 재현
  QA검증 --> 완료 : 검증 통과
  완료 --> [*]`,
  },

  // 5. ER (2개)
  {
    id: 'diag-er-shop',
    category: 'ER',
    name: '전자상거래 핵심 데이터베이스 ERD',
    description: '고객(CUSTOMER), 주문(ORDERS), 주문상세(ORDER_ITEM), 상품(PRODUCT) 테이블 개체-관계도',
    code: `erDiagram
  CUSTOMER ||--o{ ORDERS : "주문"
  ORDERS ||--|{ ORDER_ITEM : "상세포함"
  PRODUCT ||--o{ ORDER_ITEM : "상품구성"
  CUSTOMER {
    string customer_id PK
    string name
    string email
    date joined_at
  }
  ORDERS {
    string order_id PK
    string customer_id FK
    int total_price
    string order_status
  }
  ORDER_ITEM {
    string item_id PK
    string order_id FK
    string product_id FK
    int quantity
  }
  PRODUCT {
    string product_id PK
    string title
    int unit_price
    int stock_count
  }`,
  },
  {
    id: 'diag-er-blog',
    category: 'ER',
    name: '블로그 게시글·댓글·작성자 ERD',
    description: '작성자(AUTHOR), 카테고리(CATEGORY), 게시글(POST), 댓글(COMMENT) 간의 데이터 모델',
    code: `erDiagram
  AUTHOR ||--o{ POST : "작성"
  CATEGORY ||--o{ POST : "분류"
  POST ||--o{ COMMENT : "댓글등록"
  AUTHOR {
    string author_id PK
    string nickname
    string email
  }
  CATEGORY {
    string category_id PK
    string category_name
  }
  POST {
    string post_id PK
    string author_id FK
    string category_id FK
    string title
    datetime published_at
  }
  COMMENT {
    string comment_id PK
    string post_id FK
    string writer_name
    string body
  }`,
  },

  // 6. 간트 (2개)
  {
    id: 'diag-gantt-roadmap',
    category: '간트',
    name: '신규 서비스 4주 출시 로드맵',
    description: '기획·설계, UI 디자인, 핵심 기능 개발, 통합 테스트 및 정식 출시 일정 간트 차트',
    code: `gantt
  title 신규 서비스 4주 출시 로드맵
  dateFormat YYYY-MM-DD
  section 기획 및 설계
    요구사항 정의 및 분석 :done, req, 2026-03-01, 4d
    화면 설계서 확정 :done, spec, after req, 3d
  section 디자인
    컴포넌트 시안 제작 :done, ui, 2026-03-08, 4d
    디자인 검수 완료 :done, rev, after ui, 3d
  section 개발
    백엔드 API 및 DB 구축 :active, be, 2026-03-15, 4d
    프론트엔드 화면 연동 :active, fe, after be, 4d
  section 검증 및 출시
    통합 QA 및 성능 점검 :qa, 2026-03-23, 4d
    정식 서비스 오픈 :milestone, m1, 2026-03-28, 0d`,
  },
  {
    id: 'diag-gantt-sprint',
    category: '간트',
    name: '애자일 2주 스프린트 일정표',
    description: '스프린트 계획 회의부터 스토리 구현, 코드 리뷰, 스테이징 배포 및 회고 일정',
    code: `gantt
  title 스프린트 실행 일정표
  dateFormat YYYY-MM-DD
  section 스프린트 착수
    백로그 선정 및 플래닝 :done, p1, 2026-04-01, 1d
  section 기능 구현
    핵심 유저 스토리 개발 :active, d1, 2026-04-02, 6d
    코드 리뷰 및 단위 테스트 :r1, after d1, 3d
  section 배포 및 마무리
    스테이징 시연 및 배포 :s1, 2026-04-12, 1d
    스프린트 회고 미팅 :retro, 2026-04-13, 1d`,
  },

  // 7. 파이 (2개)
  {
    id: 'diag-pie-budget',
    category: '파이',
    name: '연간 IT 인프라 예산 비중',
    description: '클라우드 서버, 데이터베이스, 보안·모니터링, 스토리지, 네트워크 비용 비율 차트',
    code: `pie title 연간 IT 인프라 예산 비중
  "클라우드 컴퓨팅 서버" : 42
  "관리형 데이터베이스" : 25
  "보안 및 모니터링" : 15
  "스토리지 및 백업" : 10
  "네트워크 및 CDN" : 8`,
  },
  {
    id: 'diag-pie-traffic',
    category: '파이',
    name: '서비스 유입 채널 점유율',
    description: '자연 검색, 직접 방문, 소셜 미디어, 뉴스레터, 제휴 링크별 방문자 비중',
    code: `pie title 서비스 유입 채널 점유율
  "검색 엔진 유입" : 48
  "북마크 및 직접 방문" : 24
  "소셜 미디어 공유" : 14
  "이메일 뉴스레터" : 9
  "외부 제휴 링크" : 5`,
  },

  // 8. 마인드맵 (2개)
  {
    id: 'diag-mindmap-product',
    category: '마인드맵',
    name: '신규 프로덕트 기획 마인드맵',
    description: '핵심 가치, 타깃 고객, 주요 기능, 수익 모델을 한눈에 정리하는 기획 마인드맵',
    code: `mindmap
  root(("신규 프로덕트 기획"))
    핵심 가치
      빠른 문서 작성
      오프라인 완벽 동작
      깔끔한 가독성
    타깃 사용자
      기획자 및 마케터
      소프트웨어 개발자
      대학생 및 연구자
    주요 기능
      실시간 분할 미리보기
      표 및 다이어그램 편집
      단일 HTML 내보내기
    출시 전략
      베타 테스터 모집
      사용자 피드백 반영`,
  },
  {
    id: 'diag-mindmap-study',
    category: '마인드맵',
    name: '웹 프론트엔드 학습 로드맵',
    description: '웹 표준 기초부터 상태 관리, 성능 최적화, 자동화 테스트까지의 학습 주제 정리',
    code: `mindmap
  root(("프론트엔드 학습"))
    웹 표준 기초
      시맨틱 HTML
      반응형 CSS 변수
      모던 TypeScript
    프레임워크와 상태
      컴포넌트 설계
      전역 상태 스토어
      비동기 데이터 통신
    성능 및 안정성
      코드 분할 지연 로딩
      웹 접근성 준수
      단위 및 E2E 테스트`,
  },

  // 9. 타임라인 (1개)
  {
    id: 'diag-timeline-release',
    category: '타임라인',
    name: '서비스 분기별 주요 마일스톤 타임라인',
    description: '1분기 프로토타입 검증부터 4분기 정식 2.0 출시까지의 분기별 핵심 성과 연표',
    code: `timeline
  title 서비스 분기별 주요 마일스톤
  1분기 기반 구축 : 핵심 에디터 엔진 설계
                 : 오프라인 자동 저장 구현
  2분기 시각 편집 : 표 인라인 편집 도입
                 : 순서도 캔버스 편집기 출시
  3분기 확장 기능 : 폴더 열기 및 상대 경로 지원
                 : 8종 읽기 테마 및 문서 검색
  4분기 고도화 : 수식·다이어그램 템플릿 갤러리
              : 포터블 패키지 정식 배포`,
  },
] as const;
