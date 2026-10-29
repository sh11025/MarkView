# MarkView — 작업 안내 (AI 에이전트·개발자용)

브라우저에서 동작하는 마크다운 에디터 & 뷰어 PWA. 오프라인 동작, IndexedDB 자동 저장, 미리보기에서 바로 편집(체크박스·표).
설계 배경은 상위 폴더의 `프로토타입_분석.md`, `새프로그램_설계안.md` 참고.

## 명령어

```bash
npm install
npm run dev               # 개발 서버
npm test                  # Vitest 단위 테스트
npm run test:e2e          # 브라우저 자동 점검(Playwright Chromium, 1~50번)
npm run test:e2e:firefox  # 브라우저 자동 점검(Playwright Firefox)
npm run typecheck         # tsc --noEmit
npm run build             # 타입 검사 + 프로덕션 빌드 (dist/)
npm run build:portable    # 단일 HTML 포터블 빌드 + USB 패키징 (release/MarkView-USB)
npm run test:e2e:portable # 포터블 빌드 file:// 환경 자동 점검 (F1~F7)
npm run build:web         # 웹 배포 패키지 생성 (release/MarkView-Web)
npm run test:e2e:deploy   # 배포 점검: 하위 경로 및 오프라인 PWA 자동 점검 (D1~D3)
```

변경 후에는 `npm run typecheck && npm test`가 통과해야 한다.

## 핵심 원칙 (반드시 지킬 것)

1. **원문(마크다운 문자열)이 유일한 진실.** 미리보기 DOM을 고쳐서 상태를 바꾸지 않는다.
   미리보기에서 하는 편집은 `editor/editorRegistry.ts`의 `replaceLines(from, to, lines)`로 **에디터 트랜잭션**을 만든다 → Ctrl+Z로 되돌릴 수 있고, 저장 경로도 하나로 유지된다.
2. **위치는 "N번째"가 아니라 원문 줄 번호로.** 렌더러가 블록마다 `data-line`/`data-line-end`(0부터, end는 미포함)를 단다.
   체크박스는 `data-task-line`, 표 셀은 `data-col`, 편집 가능한 표는 `table.editable-table`(최상위 표만).
3. **마크다운 확장은 markdown-it 플러그인으로.** 원문에 정규식 전처리를 하지 않는다 (코드 블록을 망가뜨림). 예: `render/plugins/math.ts`.
4. **렌더 결과는 반드시 `sanitizeHtml`을 거친다.** Mermaid는 `securityLevel: 'strict'` + `sanitizeSvg`.
   DOMPurify는 `-->`가 든 속성값을 지우므로, 속성에 코드를 담을 땐 `encodeURIComponent` 할 것 (mermaid `data-code` 참고).
5. **문서 본문 스타일은 `styles/document.css`에만.** 미리보기와 HTML 내보내기가 같이 쓰므로 Tailwind 클래스를 본문 HTML에 넣지 않는다. Tailwind는 앱 화면(도구 막대·탭 등)에만.
6. **저장 경로는 `storage/persistence.ts` 하나.** 저장 실패는 조용히 넘기지 말고 사용자에게 알린다.
7. **단축키는 최소한.** 현재 Ctrl+S(저장), Ctrl+F(찾기), Ctrl+Z / Ctrl+Y(실행 취소/다시)뿐이다. 새 기능은 버튼·메뉴·슬래시(`/`) 메뉴로 제공하고, 단축키를 추가하지 않는다. 브라우저가 가로채는 Ctrl+N/W/T/P는 절대 쓰지 않는다.
8. UI 문구는 한국어.
9. **헤더·도구 막대처럼 드롭다운 메뉴가 붙는 영역에는 overflow(hidden/auto/scroll)를 지정하지 않는다 (메뉴가 잘림).** 좁은 화면은 줄바꿈(flex-wrap)으로 대응하고, 레이아웃을 바꾼 뒤에는 메뉴가 잘리지 않는지 E2E 16·17로 확인한다.
10. **정화(sanitize)는 jsdom 테스트로 실제 동작을 검증한다. 정화 실패 시 원문을 그대로 통과시키는 우회 코드를 두지 않는다.**
11. **다이어그램(Mermaid) 편집도 원칙 1·2번을 따른다.** 기본 탭은 캔버스(캔버스·목록·코드 3개 탭)이며, 미리보기 다이어그램 더블클릭 또는 편집 버튼으로 열린다. 모달에서 변경한 내용은 `replaceLines`를 통해 코드 블록 내부 줄만 에디터 트랜잭션으로 교체한다(Ctrl+Z 1번에 되돌리기 가능). 적용 전 원문 일치 여부를 검사하여 덮어쓰기를 방지하고, 캔버스 내 노드 위치 이동만 발생한 경우 원문 코드를 건드리지 않는다. 모달은 `React.lazy`로 지연 로드하여 초기 번들 크기를 유지한다.
12. **제품 코드에 테스트 전용 훅·전역(window) 노출을 두지 않는다. 테스트는 사용자가 하는 조작(클릭·키 입력)으로 한다.**
13. **포터블 빌드(file://)에서도 동작해야 한다: 절대경로(/)·외부 CDN·서비스 워커 존재를 가정하지 않는다. 저장소(IndexedDB)가 막혀도 앱은 임시 모드로 계속 쓸 수 있어야 한다.**
14. **앱 화면 색은 CSS 변수 기반 클래스(`bg-[var(--surface)]` 등)만 쓴다. 정의되지 않은 Tailwind 색상 유틸리티(bg-bg, text-text, border-border 등)를 쓰지 않는다. 새 화면은 라이트·다크 모두 색이 보이는지 E2E로 확인한다.**
15. **문제 정보·로그·백업 외의 어떤 곳에도 문서 내용·파일 이름을 내보내지 않는다. 복원은 기존 문서를 지우거나 덮어쓰지 않고 새 문서로만 추가한다.**
16. **백업은 저장소가 막힌 임시 모드에서도 앱 상태의 문서로 만들 수 있어야 하고, 오류 화면의 백업은 앱 상태에 의존하지 않고 IndexedDB를 직접 읽는다.**
17. **렌더러가 만드는 본문 HTML 안에는 앱 조작용 버튼을 넣지 않는다.** 본문 HTML은 HTML 내보내기와 공유되므로 앱 전용 UI(버튼 등)를 넣으면 내보낸 문서에도 그대로 노출된다. 표 조작처럼 본문 위에서 일어나는 UI는 미리보기 컨테이너(`PreviewPane`) 레벨에서 플로팅 오버레이(호버 시 표 위치에 띄움)로 띄운다.
18. **폴더 열기는 브라우저별로 방식이 달라도 같은 인터페이스를 쓰고, 읽기 전용 브라우저에서는 데이터를 덮어쓰지 않는다.** File System Access API가 없는 Firefox/Brave에서는 `<input type="file" webkitdirectory>`로 선택한 파일을 가상 디렉터리 핸들(`DirectoryHandleLike`)로 감싸 동일한 트리 탐색·파일 읽기 인터페이스를 제공한다. 읽기 전용 환경에서는 디스크 직접 덮어쓰기를 하지 않고 다운로드 저장 흐름과 안내 문구를 제공하며, 동일 폴더 재오픈 시 `(sourceFolder, folderPath)` 기준으로 탭 중복 생성을 방지한다.
19. **테마는 CSS 변수 세트로만 정의한다.** 각 테마 프리셋(8종)은 `styles/app.css`(앱 UI 변수)와 `styles/document.css`(문서 본문 변수)의 `[data-theme='...']` 블록 및 `constants/themes.ts`의 CSS 변수 세트로만 정의하며, 개별 컴포넌트 안에 테마별 하드코딩 색상을 넣지 않는다. 모든 테마에서 본문 및 앱 UI의 글자 명도 대비는 4.5:1 이상을 유지한다.
20. **하위 경로·오프라인 호환을 깨지 않는다.** GitHub Pages 같은 하위 경로(`/저장소명/`)나 루트(`/`) 양쪽에서 상대 경로(`base: './'`)로 동작해야 하며, 절대 경로(`/assets/...`) 참조를 넣지 않는다. PWA 서비스 워커 사전 캐시(`globPatterns`)에 모든 지연 로딩 청크와 폰트·에셋을 포함하여 인터넷 연결이 끊겨도 문서 편집·미리보기·수식·다이어그램·템플릿 갤러리가 100% 동작해야 한다. 새 버전 갱신 시 작성 중인 글이 유실되지 않도록 사용자 확인 후 수동 새로고침 방식을 유지한다.

## 구조

```
vite.config.portable.ts      # 단일 HTML 포터블 빌드 설정 (SingleFile, pwaStub alias)
playwright.portable.config.ts # 포터블 빌드 file:// E2E 설정 (webServer 없음)
scripts/
└── make-usb-package.mjs     # release/MarkView-USB 패키징 스크립트
e2e/
├── markview.spec.ts         # 메인 E2E 시나리오 (1~49번)
└── portable/
    └── portable.spec.ts     # file:// 환경 검증 시나리오 (F1~F7)
src/
├── main.tsx                 # 진입점 (CSS 로드, PWA 등록)
├── app/                     # 앱 화면
│   ├── App.tsx              # 레이아웃, 초기 불러오기, Ctrl+S, 파일 드롭, 임시 모드 대응
│   ├── ErrorBoundary.tsx    # React 오류 경계 (전체화면 복구/독립 백업 및 모달 에러 격리)
│   ├── Header.tsx           # 새 문서/열기/저장/내보내기 메뉴, 보기 방식, 설정, 백업/복원/문제정보 진입
│   ├── TabBar.tsx           # 탭 (더블클릭 이름 변경, 가운데 클릭 닫기)
│   ├── TocSidebar.tsx       # 목차
│   ├── Toasts.tsx, Popover.tsx
│   ├── EnvironmentBanner.tsx # file: 및 임시(in-memory) 모드 사용자 안내 배너
│   ├── storageQuotaAlert.ts # 저장 공간 80% 이상 사용 시 경고 토스트 모듈
│   ├── TemplateGallery.tsx  # 템플릿 갤러리 모달 (카테고리·검색·미리보기, React.lazy)
│   ├── diagnostics/         # 문제 정보 진단 UI (React.lazy)
│   │   ├── DiagnosticsModal.tsx # 문제 정보 복사 모달 (개인정보 비누출 안내)
│   │   └── collectInfo.ts   # 브라우저 및 앱 통계 정보 수집
│   ├── backup/              # 백업 복원 UI (React.lazy)
│   │   └── RestoreModal.tsx # 백업 복원 요약 확인 모달 (기존 문서 덮어쓰기 없음)
│   ├── mermaid/             # 다이어그램 편집 모달 (React.lazy 분리 로드)
│   │   ├── MermaidEditor.tsx    # 모달 컨테이너 (3개 탭 전환·실행취소/다시실행·적용/취소)
│   │   ├── MermaidEditorLoading.tsx # 편집기 지연 로딩 표시 컴포넌트
│   │   ├── MermaidVisualTab.tsx # 순서도 목록 편집 탭 (방향·노드·엣지)
│   │   ├── MermaidPreview.tsx   # 실시간 렌더링 미리보기 (300ms 디바운스)
│   │   └── canvas/              # 순서도 마우스 캔버스 편집기
│   │       ├── MermaidCanvas.tsx    # 줌·팬·드래그 캔버스 코어 및 자동 뷰포트 패닝
│   │       ├── CanvasNode.tsx       # 노드 렌더링·Quick Add(+)·포트·인라인 편집
│   │       ├── CanvasEdge.tsx       # 베지어 곡선 연결선 및 라벨 편집
│   │       ├── CanvasToolbar.tsx    # 방향·줌·자동정돈·예시 툴바
│   │       ├── CanvasFloatingBar.tsx # 노드 모양·색상·테두리 스마트 플로팅 바
│   │       ├── CanvasStatusBar.tsx  # 줌 레벨·노드 수 상태 바
│   │       └── types.ts             # 캔버스 뷰 상태 타입 정의
│   ├── fileActions.ts       # 열기·저장·닫기·내보내기 동작 (알림 포함)
│   ├── positionTracker.ts   # 커서·스크롤 위치 추적
│   ├── diskSync.ts          # 디스크 파일 변경 감지 및 동기화
│   ├── theme.ts             # 시스템/라이트/다크 → <html data-theme>
│   ├── pwa.ts               # 서비스 워커(file: 가드 포함), 설치 버튼
│   └── pwaStub.ts           # 포터블 빌드용 PWA 빈 스텁 모듈
├── stores/                  # Zustand
│   ├── documents.ts         # 문서·탭 순서·활성 탭. isDirty = updatedAt > savedAt (디스크 기준)
│   ├── folder.ts            # 작업 폴더 상태 (연결 정보, 트리, 권한 필요, 로딩)
│   ├── positions.ts         # 문서별 커서·스크롤 위치
│   ├── settings.ts          # 테마·글자 크기·본문 폭·글꼴
│   └── ui.ts                # 보기 방식, 목차, 알림
├── storage/
│   ├── db.ts                # IndexedDB: documents / handles / attachments / kv
│   ├── persistence.ts       # 불러오기 + 자동 저장(500ms, 탭 숨김 시 즉시)
│   ├── fileSystem.ts        # File System Access API(핸들 보관) + 업로드/다운로드 대체
│   ├── folder.ts            # 폴더 스캔(최대 깊이 8, 최대 파일 3000개, 무시 목록), 핸들 권한
│   ├── folderTypes.ts       # 디렉토리/파일 핸들 최소 인터페이스
│   ├── attachments.ts       # 붙여넣은 이미지 → Blob 저장, 본문엔 attachment:ID
│   └── attachmentCleanup.ts # 쓰지 않는 첨부 이미지 정리
├── editor/                  # CodeMirror 6
│   ├── editorRegistry.ts    # 단일 EditorView, 문서별 EditorState(실행 취소 기록 분리), replaceLines
│   ├── extensions.ts        # 확장·최소 키맵·하이라이트·한국어 문구
│   ├── commands.ts          # 서식 명령 목록 (도구 막대와 슬래시 메뉴가 공유)
│   ├── formatAction.ts      # 서식 정리 트랜잭션 (가운데 부분만 교체)
│   ├── slashMenu.ts         # 줄 맨 앞 `/` 메뉴
│   ├── pasteAndDrop.ts      # 이미지·스프레드시트 붙여넣기, 파일 드롭
│   └── EditorPane.tsx       # 도구 막대 + 에디터
├── render/
│   ├── markdown.ts          # renderMarkdown(src) → { html, toc } (DOM 없는 순수 함수)
│   ├── plugins/             # math, tasks(체크리스트 진행률), cjkEmphasis(한글 강조 보정), alerts(콜아웃), headings(id·목차), sourceLines(data-line)
│   ├── sanitize.ts          # DOMPurify
│   └── mermaid.ts           # 지연 로드, 순차 렌더, 캐시
├── preview/
│   ├── PreviewPane.tsx      # morphdom 갱신, 체크박스·표 편집·코드 복사·링크·읽기 진행률/맨위로
│   ├── ImageLightbox.tsx    # 본문 이미지 확대 보기 모달 (React.lazy 분리 로드)
│   ├── TableToolbar.tsx     # 표 상단 플로팅 도구 막대 (행/열 추가·삭제)
│   └── scrollSync.ts        # data-line 기준 동기 스크롤
├── features/                # 순수 로직 (React 의존 금지) + 테스트
│   ├── environment/         # file: 환경 및 임시 모드 배너 판별 순수 로직 (banner.ts)
│   ├── folder/              # 폴더 트리 및 가상 디렉터리 순수 로직 (virtualDirectory.ts, browserCompat.ts, sort.ts, prune.ts, path.ts, types.ts)
│   ├── disksync/decide.ts   # 디스크 변경 감지 판단 순수 함수
│   ├── format/formatMarkdown.ts # 서식 정리 순수 함수 (표 정렬·목록 기호·공백·빈줄)
│   ├── format/stringWidth.ts    # 글자 시각적 폭 계산 (동아시아 전각/한글 폭 2)
│   ├── mermaid/             # Mermaid 파서·직렬화·모델 연산 순수 함수
│   │   ├── types.ts         # FlowchartModel, NodeShape, FlowNode 등 타입
│   │   ├── parse.ts         # parseFlowchart(code) (subgraph/비순서도 판별)
│   │   ├── serialize.ts     # serializeFlowchart(model) (안전 이스케이프·보존줄)
│   │   ├── operations.ts    # addNode, removeNode, addEdge, canApplyChanges 등
│   │   ├── layout.ts        # @dagrejs/dagre 계층형 자동 배치 및 Quick Add 위치 계산
│   │   ├── layout.test.ts   # 자동 배치 단위/성능(100ms) 테스트
│   │   ├── floatingPosition.ts # 조작 막대 스마트 배치 (가림/경계 이탈 방지)
│   │   ├── floatingPosition.test.ts # 조작 막대 배치 단위 테스트
│   │   ├── examples.test.ts # 예시 템플릿 왕복 검증 테스트
│   │   └── mermaid.test.ts  # 단위 테스트
│   ├── position/positions.ts # 커서·스크롤 위치 보정 및 계산
│   ├── table/tableEdit.ts   # 표 셀·행·열 편집 (행 0=머리글, 1=구분선, 2~=본문)
│   ├── tasks/toggleTask.ts
│   ├── paste/clipboardTable.ts
│   ├── templates/applyTemplate.ts # 템플릿 날짜 치환 순수 함수
│   ├── diagnostics/         # 문제 진단 정보 및 전역 오류 수집 순수 함수
│   │   ├── errorCollector.ts # 오류 30개 메모리 보관 및 경로 마스킹
│   │   └── report.ts        # 개인정보 비누출 진단 보고서 텍스트 생성
│   ├── backup/              # 전체 백업 및 복원 순수 로직
│   │   ├── types.ts         # 백업 JSON 스키마 및 복원 계획 타입
│   │   ├── createBackup.ts  # 백업 데이터 조립 및 참조 첨부 선별
│   │   ├── validateBackup.ts # 백업 유효성 및 크기 한도 검증
│   │   ├── planRestore.ts   # 덮어쓰기 없는 새 탭 복원 계획 및 중복 이름 해결
│   │   └── findAttachmentIds.ts # 본문 내 참조 이미지 ID 추출
│   ├── storage/quotaCheck.ts # 저장소 할당량 80% 경고 판별 순수 로직
│   └── export/exportHtml.ts # 자체 포함 HTML (CSS·KaTeX 글꼴·이미지·SVG 인라인)
├── constants/
│   ├── templates.ts         # 문서 템플릿 8종 데이터
│   ├── diagramExamples.ts   # 순서도 예시 4종 데이터 (결재, API, 배포, 분기)
│   └── welcome.ts           # 첫 실행 안내 문서
└── styles/
    ├── app.css              # Tailwind + 앱 색상 변수 + 인쇄 규칙
    └── document.css         # 문서 본문 (미리보기·내보내기 공용)
```

의존 방향: `app → editor/preview → render/features/storage/stores`. `features/`, `render/`, `storage/`는 React를 import하지 않는다.

## 데이터 흐름

```
CodeMirror(문서별 EditorState) ─변경→ stores/documents ─500ms→ IndexedDB
                                        │
                                        └─120ms→ renderMarkdown → sanitize → morphdom → 미리보기
미리보기 클릭(체크박스·표) → replaceLines() → CodeMirror 트랜잭션 → (위와 같은 경로)
```

## 구현 완료 (v1 기본 틀)

- 다중 탭, 이름 변경, 닫기 확인(파일로 저장 안 된 내용), IndexedDB 자동 저장·복원
- 파일 열기/저장/다른 이름으로 저장 (Chrome·Edge는 같은 파일에 다시 저장, 그 외는 업로드·다운로드), 드래그&드롭
- CodeMirror 에디터: 줄 번호, 탭별 실행 취소, 찾기·바꾸기, 목록 자동 이어쓰기, 도구 막대, 슬래시 메뉴
- 붙여넣기: 이미지 → 첨부, 엑셀/시트/HTML 표 → 마크다운 표 (코드 안에선 비활성, 오인 방지 조건)
- 렌더링: GFM, KaTeX, 코드 하이라이트, GitHub 콜아웃, Mermaid
- 미리보기 편집: 체크박스, 표 셀 더블클릭, 오른쪽 클릭(행·열 추가/삭제)
- 편집/분할/미리보기 보기, 목차(현재 위치), 동기 스크롤, 모바일에서는 위아래 분할
- 테마(시스템/라이트/다크), 글자 크기·본문 폭·글꼴
- 서식 정리: 표 정렬(한글 폭 계산·구분선 유지), 글머리 기호 통일(*·+ → -), 공백 정리, 연속 빈 줄 압축, 보호 구간(코드·수식·HTML) 보존
- 템플릿 갤러리(8종, 새 탭으로만 열림): 회의록·주간보고·기획서 등, 날짜 자동 치환, 실시간 미리보기
- 폴더 열기 1단계: 헤더 열기 드롭다운 메뉴("파일 열기", "폴더 열기"), 사이드바 "파일" 탭의 폴더 트리(폴더 우선·한글/숫자 자연 정렬, 빈 폴더 가지치기, 최대 깊이 8·파일 3000개 안전 한도), 파일 클릭 시 기존 탭 보존하며 새 탭으로 열기(중복 열기 방지, folderPath 기록), 새로고침 시 권한 복원/재연결
- 폴더 열기 2단계: 문서의 `folderPath` 기준 상대 경로 이미지 비동기 로드(25MB·확장자 안전 가드, 누락/탈출 시 .img-missing 표시, 폴더 새로고침 시 캐시 갱신), 상대 경로 마크다운 링크 클릭 시 새 탭/기존 탭 열기 및 제목 해시(#) 스크롤 이동, HTML 내보내기 시 상대 이미지 data URL 인라인 및 상대 링크 비활성화
- 정화(sanitize) 테스트 체계화: `DOMPurify` 원본 사용, 단위 테스트 `@vitest-environment jsdom` 적용으로 XSS 필터링(<script>, onerror, javascript: 링크) 및 정상 태그/SVG 보존 검증 완료
- 다이어그램 편집기 1단계: 순서도(flowchart/graph) 전용 목록·코드 편집 모달(미리보기 호버 시 편집 버튼, 방향/노드/엣지 목록 편집, 단계/연결 추가/삭제, 되돌리기, 실시간 미리보기 300ms 디바운스, 양방향 동기화, 적용 직전 원문 변경 검사, React.lazy 지연 로드), subgraph/비순서도는 코드 탭 안내, 단위/E2E 테스트 완료
- 다이어그램 편집기 2단계 (마우스 캔버스 방식): 기본 탭 캔버스 전환(캔버스·목록·코드 3개 탭 구성), @dagrejs/dagre 계층형 자동 정돈(100개 노드 72ms < 100ms 만족), 6가지 노드 색상(mv-indigo, mv-emerald, mv-amber, mv-rose, mv-purple, mv-slate 및 classDef 자동 생성), 테두리 스타일(기본·dashed·thick), 노드 4방향 Quick Add(+) 버튼 및 빈틈 없는 히트박스(28px 패딩), 포트 드래그 베지어 연결선 생성, 노드 인라인 텍스트 편집, 노드 위치 이동 시 원문 코드 미변경 및 30단계 Undo/Redo, 4종 예시 템플릿(결재·API·배포·분기), 미리보기 다이어그램 더블클릭 진입, CSS 변수 기반 다크/라이트 테마 색상 및 명도 대비 4.5 이상 검증, 실사용자 마우스/키보드 E2E(28~35번) 100% 통과
- 다이어그램 캔버스 마무리 & 번들 최적화:
  - 열리는 반응 개선: Suspense fallback 로딩 UI(`role="status"`, "편집기를 여는 중…"), 다이어그램 더블클릭 시 텍스트 블록 선택 방지(`user-select: none`), hover/focus 시 편집기 청크 prefetch
  - 캔버스 겹침 및 가장자리 보정: 조작 막대 4방향 스마트 최적 배치 순수 함수(`computeFloatingBarPosition`), 노드 생성/선택 시 뷰포트 패닝 자동 보정(`ensureVisible`), 엣지 라벨 레이어 독립 렌더링으로 `+` 버튼 가림 해결
  - 메인 번들 경량화: HTML 내보내기 인라인 KaTeX CSS 분리 및 템플릿 갤러리 lazy 분리로 메인 번들 크기를 1,077.6 kB / gzip 364.05 kB에서 **714.42 kB / gzip 232.41 kB**로 대폭 감축 (목표 351.4 kB 이하 초과 달성)
  - E2E 36~38번 신규 자동 점검 추가 및 총 38개 전수 통과
- 안정성 패키지 (오류 화면, 문제 보고 복사, 전체 백업·복원, 저장 공간 경고):
  - React 오류 경계(`ErrorBoundary`): 앱 전체 화면 및 지연 로딩 모달(다이어그램, 템플릿 등) 격리, 하얀 화면 방지 및 복구 안내, IndexedDB 직접 조회 독립 백업 다운로드 경로 제공
  - 전역 오류 수집(`errorCollector`): window error / unhandledrejection 최근 30개 메모리 배열 보관, 200자 제한, 파일명 및 경로 마스킹
  - 문제 정보 복사(`DiagnosticsModal`): 앱/브라우저/저장소/문서통계(글자 수 합계 숫자) 보고서 생성, 문서 내용·파일명·폴더경로 철저 배제(개인정보 비누출 보장), 원클릭 클립보드 복사
  - 전체 백업과 복원: JSON 단일 파일(`MarkView-백업-날짜.json`), 참조 이미지 선별 포함, 덮어쓰기 없는 새 탭 추가 복원, 중복 이름 `(복원)` 자동 부여, 잘못된 파일 안전 검증
  - 저장 공간 경고(`storageQuotaAlert`): 사용량 80% 이상 지속 알림 및 백업 다운로드 액션 제공, IndexedDB QuotaExceeded 실패 방어
  - 단위 테스트(jsdom ErrorBoundary, errorCollector, report, backup, quotaCheck) 및 E2E 39~44번 전수 통과
- HTML 내보내기(오프라인 완결), .md 다운로드, 인쇄/PDF
- PWA: 오프라인, 업데이트 알림, 설치 버튼. GitHub Pages 배포 워크플로(`.github/workflows/deploy.yml`)
- 포터블 빌드: 단일 HTML 파일(SingleFile 플러그인, `MarkView.html`) 및 USB 패키지(`release/MarkView-USB/`). 인터넷/서버/Node 없이 더블클릭 실행 가능. file:// 환경 서비스 워커 차단 및 설치 버튼 비활성화, IndexedDB 차단 시 임시 모드(in-memory) 안전 실행, 안내 배너 표시

## 남은 작업 (우선순위 순)

1. **초기 번들 줄이기**: highlight.js 경량화 및 메인 번들 경량화(714KB / gzip 232KB) 완료. 추가 감축을 위한 KaTeX/CodeMirror 추가 지연 로드 검토
2. **2차 기능**: 명령 팔레트(버튼으로 여는 방식)

## 알려진 제약

- 포터블 버전: Chrome·Edge 권장, 서비스 워커·앱 설치 없음, 자동 저장은 그 컴퓨터 브라우저에만 남음 (다른 컴퓨터 이동 시 '저장'으로 .md 파일 보관 필요)
- File System Access API가 없는 브라우저(Firefox·Safari)는 저장 시 다운로드됨
- 폴더 열기는 Chrome·Edge 전용 (File System Access API 미지원 브라우저는 메뉴 비활성화), 사이드바가 숨겨지는 좁은 화면(md 미만)에서는 사용 불가
- 상대 경로 이미지와 문서 간 상대 경로 링크는 폴더에서 연 문서에서만 동작 (일반 열기/새 문서는 안내 표시)
- 인용문·목록 안에 있는 표는 미리보기에서 편집 불가 (원문 접두어 처리 미구현, 의도적으로 비활성)
- 7일 이상 참조되지 않은 첨부는 시작할 때 자동 삭제됨
