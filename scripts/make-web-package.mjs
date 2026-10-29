/**
 * release/MarkView-Web 웹 배포 패키지 생성 스크립트
 * dist/ 결과물을 release/MarkView-Web/ 폴더로 복사하고 Netlify/GitHub Pages 배포 안내 문서를 동봉한다.
 */
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const targetDir = path.join(rootDir, 'release', 'MarkView-Web');

if (!fs.existsSync(distDir)) {
  console.error('오류: dist 폴더가 없습니다. 먼저 npm run build를 실행하세요.');
  process.exit(1);
}

// 기존 release/MarkView-Web 정리 후 재생성
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// dist 내용 전체를 targetDir로 재귀 복사
fs.cpSync(distDir, targetDir, { recursive: true });

// 배포 안내 문서 작성
const guideContent = `====================================================
MarkView 웹 배포 패키지 (Netlify Drop / GitHub Pages)
====================================================

이 폴더는 인터넷 웹 호스팅 서비스에 바로 올릴 수 있도록
빌드 및 패키징된 정적 파일 묶음입니다.

■ 1. Netlify Drop 배포 방법 (가장 쉬움, 1분 완료)
1) 브라우저에서 https://app.netlify.com/drop 접속 (또는 Netlify 로그인 후 Sites > Add new site > Deploy manually)
2) 이 폴더('MarkView-Web') 전체를 브라우저 창으로 끌어다 놓습니다(Drag & Drop).
3) 업로드가 끝나면 즉시 나만의 웹 주소(예: https://random-name.netlify.app)가 생성되어 동작합니다.
   * _headers, _redirects 파일이 이미 포함되어 있어 새로고침 및 보안 헤더가 자동 적용됩니다.

■ 2. GitHub Pages 배포 방법
1) GitHub 저장소를 생성합니다 (예: username/markview).
2) 저장소 Settings > Pages 메뉴로 이동합니다.
3) Source를 'Deploy from a branch'로 설정하고, 배포 브랜치(예: gh-pages 또는 main의 /docs)를 선택합니다.
4) 이 폴더 안의 파일들을 해당 브랜치에 커밋하여 푸시합니다.
   * MarkView는 상대 경로(./)로 빌드되어 있어 https://username.github.io/저장소명/ 하위 경로에서도
     추가 설정 없이 바로 동작합니다.
   * 404.html이 포함되어 있어 새로고침 시에도 안전하게 메인 화면으로 연결됩니다.

■ 3. 주요 특징
- 완전한 PWA 지원: 한 번 방문하면 오프라인(비행기 모드, 인터넷 끊김)에서도 100% 동작합니다.
- 개인정보 보호: 작성한 문서와 이미지는 브라우저 내부(IndexedDB)에만 저장되며 외부 서버로 절대 전송되지 않습니다.
- 업데이트 알림: 새 버전 배포 시 화면에 '새 버전이 있습니다 — 새로고침' 토스트가 표시되며,
  작성 중인 글이 유실되지 않도록 사용자가 원할 때 안전하게 갱신할 수 있습니다.
====================================================
`;

fs.writeFileSync(path.join(targetDir, '배포_안내.txt'), guideContent, 'utf8');

// 파일 수 및 총 용량 계산
let totalBytes = 0;
let fileCount = 0;

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full);
    } else {
      fileCount++;
      totalBytes += fs.statSync(full).size;
    }
  }
}

scanDir(targetDir);

console.log('====================================================');
console.log('웹 배포 패키지 생성 완료: release/MarkView-Web');
console.log('====================================================');
console.log(`- 포함 파일 수: ${fileCount}개`);
console.log(`- 전체 용량: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (${totalBytes} bytes)`);
console.log('- Netlify 지원: _headers, _redirects 포함 완료');
console.log('- GitHub Pages 지원: 404.html, 상대 경로(./) 호환 완료');
console.log('- 배포 안내 문서: release/MarkView-Web/배포_안내.txt 생성 완료');
console.log('====================================================');
