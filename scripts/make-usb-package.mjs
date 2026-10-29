import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const distPortableHtml = path.resolve(rootDir, 'dist-portable/index.html');
const releaseDir = path.resolve(rootDir, 'release/MarkView-USB');
const docsDir = path.resolve(releaseDir, '내 문서');

if (!fs.existsSync(distPortableHtml)) {
  console.error('오류: dist-portable/index.html 파일이 없습니다. 먼저 포터블 빌드를 실행하세요.');
  process.exit(1);
}

// release 폴더 준비
if (fs.existsSync(releaseDir)) {
  fs.rmSync(releaseDir, { recursive: true, force: true });
}
fs.mkdirSync(docsDir, { recursive: true });

// 1. MarkView.html 복사
const targetHtml = path.resolve(releaseDir, 'MarkView.html');
fs.copyFileSync(distPortableHtml, targetHtml);

// 2. 사용법.txt 작성 (UTF-8, 메모장 호환)
const manualContent = `==================================================================
MarkView 포터블 버전 사용 안내
==================================================================

인터넷 연결이나 별도 프로그램 설치 없이, USB에서 바로 사용할 수 있는 
독립형 마크다운 편집기입니다.

① 여는 방법
   - "MarkView.html" 파일을 더블클릭하면 Chrome 또는 Edge 브라우저에서 열립니다.
   - 다른 브라우저가 기본 프로그램으로 지정되어 있다면, 
     파일을 오른쪽 클릭한 후 [연결 프로그램] -> [Google Chrome] 또는 [Microsoft Edge]를 선택하세요.

② 임시 저장과 주의사항
   - 작성 중인 내용은 현재 컴퓨터의 브라우저 저장소에만 자동 보관됩니다.
   - USB 자체에 자동으로 저장되는 것이 아니므로, USB를 뽑아 다른 컴퓨터로 가져가면 
     작성하던 내용이 보이지 않습니다.

③ USB에 글 보관하는 방법 (매우 중요!)
   - 작업을 마치기 전 또는 중요한 글은 상단 메뉴의 [저장] 버튼(또는 [저장] -> [다른 이름으로 저장])을 눌러,
     이 USB의 "내 문서" 폴더 안에 .md 파일로 저장하세요.

④ 다른 컴퓨터에서 이어서 쓰는 방법
   - 다른 컴퓨터에서 MarkView.html을 연 후, 상단 [열기] -> [폴더 열기]를 눌러 
     USB의 "내 문서" 폴더를 선택하세요 (Chrome·Edge·Firefox·Brave 모두 지원).
   - Firefox 및 기본 설정의 Brave에서는 읽기 전용 가상 폴더로 열리며 안전하게 다운로드 방식으로 저장됩니다.
     (Brave는 brave://flags/#file-system-access-api 설정 시 직접 저장까지 가능)
   - 왼쪽 사이드바에 파일 목록이 나타나며, 클릭해서 글을 계속 작성할 수 있습니다.

⑤ 읽기 및 검색 편의 기능
   - 미리보기 검색: 미리보기 화면에서 Ctrl+F를 누르면 문서 내 검색 막대가 열리며, Enter/Shift+Enter로 이동하고 Esc로 닫습니다.
   - 저장 상태 표시: 탭 줄 오른쪽에 현재 상태("저장 중…", "자동 저장됨 HH:MM", "파일로 저장됨", "저장 안 된 변경 있음" 등)가 실시간으로 표시됩니다.
   - 목차 검색·깊이 필터·접기: 왼쪽 목차 패널에서 제목을 검색하거나 깊이(전체/H2까지/H3까지)를 고르고 하위 제목을 접고 펼칠 수 있습니다.
   - 보기 설정 & 테마 프리셋: 오른쪽 위 [보기 설정]에서 8종 테마 프리셋(GitHub 라이트/다크, Dracula, Nord, Sepia, Monokai, Tokyo Night, Forest)과 글자 크기, 줄 간격(1.4~2.2), 본문 정렬, 글꼴 4종(고딕/명조/고정폭/둥근 고딕), 줄바꿈 옵션을 바꿀 수 있습니다.

⑥ 인쇄 / PDF / HTML 내보내기
   - 상단 [내보내기] 메뉴에서 [인쇄 / PDF로 저장]을 누르면 깔끔하게 인쇄하거나 PDF로 저장할 수 있습니다 (어두운 테마 사용 중에도 인쇄물은 밝은 배경으로 출력됩니다).
   - [HTML 파일 (오프라인용)]을 누르면 인터넷 없는 곳에서도 볼 수 있는 단일 HTML 문서로 내보내집니다.

⑦ 초보자를 위한 "/" 삽입 메뉴와 "삽입 ＋" 버튼
   - "/" 삽입 메뉴: 빈 줄에서 "/"를 누르면 "아이콘 + 쉬운 이름 + 한 줄 설명 + 결과 예시"가 함께 나오는 넓은 메뉴가 열립니다.
     큰 제목, 점 목록, 체크리스트, 표, 코드 상자, 수식, 다이어그램, 이모지, 5종 상자(참고/팁/중요/주의/경고), 템플릿 열기 등을 한국어 키워드(예: "큰 글씨", "엑셀", "순서도", "할일", "웃음")로 검색해 바로 넣을 수 있습니다.
   - "삽입 ＋" 버튼: 슬래시를 입력하기 어려운 마우스 사용자나 모바일 환경에서는 에디터 도구 막대 오른쪽 끝의 [삽입 ＋] 버튼을 눌러 동일한 메뉴를 바로 띄울 수 있습니다.

⑧ 수식·다이어그램 갤러리, 다이어그램 PNG 저장, 이모지
   - 수식 삽입 갤러리: 도구 막대의 [수식 삽입] 버튼 또는 빈 줄에서 [/수식]을 입력하면 대수·미적분·통계 등 42개 수식 카드를 미리보고 원클릭으로 삽입합니다.
   - 다이어그램 삽입 갤러리: 도구 막대의 [다이어그램 삽입] 버튼 또는 빈 줄에서 [/다이어그램]을 입력하면 순서도·시퀀스·ERD·간트·마인드맵 등 20개 Mermaid 템플릿을 선택해 삽입합니다.
   - 다이어그램 PNG / SVG 저장: 미리보기 화면에서 다이어그램에 마우스를 올리면 나타나는 [PNG로 저장] / [SVG로 저장] 버튼으로 2배 해상도(흰색 배경)의 고화질 이미지로 바로 저장합니다 (다이어그램 편집 창에서도 지원).
   - 이모지 단축코드 & 콜아웃: 본문에서 :smile: :rocket: 같은 320여 종의 단축코드가 이모지로 표시되고, 에디터에서 : 뒤 2글자 입력 시 자동완성을 지원합니다. 인용문 앞머리에 💡, ⚠️, ❗, ✅, ❌, ℹ️, 📌, 🔥, 🚨, 🛑, 📝, 🎯 등 이모지를 넣으면 테마에 맞춘 예쁜 색상 상자로 렌더링됩니다.

⑨ 전체 백업과 복원
   - 모든 글을 한 번에 보관하려면 상단 [내보내기] 메뉴 -> [전체 백업 내려받기]를 누르세요.
   - 백업한 글을 다시 불러오려면 상단 [열기] 메뉴 -> [백업에서 복원…]을 선택하세요 (기존 글을 지우지 않고 새 탭으로 추가).

⑩ 문제 해결
   - 화면이 멈추거나 이상이 생기면 [보기 설정] -> [문제 정보 복사…]를 눌러 개발자에게 전달하세요 (글 내용 미포함).
   - 화면 새로고침은 브라우저 새로고침(F5 키)을 누르세요.
==================================================================
`;

const manualPath = path.resolve(releaseDir, '사용법.txt');
fs.writeFileSync(manualPath, manualContent, 'utf-8');

// 3. 내 문서/ 안내 파일
const docsGuidePath = path.resolve(docsDir, '여기에 글을 저장하세요.txt');
fs.writeFileSync(docsGuidePath, '작업한 마크다운(.md) 파일들을 이 폴더에 저장하면 다른 컴퓨터에서도 쉽게 열어볼 수 있습니다.\n', 'utf-8');

// 결과 크기 및 목록 출력
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

console.log('====================================================');
console.log('USB 패키지 생성 완료: release/MarkView-USB');
console.log('====================================================');
const files = [
  { name: 'MarkView.html', path: targetHtml },
  { name: '사용법.txt', path: manualPath },
  { name: '내 문서/여기에 글을 저장하세요.txt', path: docsGuidePath },
];

for (const f of files) {
  const stat = fs.statSync(f.path);
  console.log(`- ${f.name.padEnd(35)} : ${formatSize(stat.size)} (${stat.size} bytes)`);
}
console.log('====================================================');
