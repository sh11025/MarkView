/**
 * @file 문제 진단 정보 보고서 생성 순수 함수 (React import 금지)
 * 사용자 문서의 내용이나 파일명, 폴더 경로 등 개인 정보는 타입 수준 및 로직에서 철저히 배제됩니다.
 */

import type { CapturedError } from './errorCollector';

export interface DiagnosticsData {
  app: {
    name: string;
    version: string;
    buildTime: string;
  };
  runtime: {
    mode: 'web' | 'standalone' | 'file' | string;
    userAgent: string;
    screen: {
      width: number;
      height: number;
      dpr: number;
    };
    themeSetting: string;
    actualTheme: string;
  };
  capabilities: {
    hasOpenFilePicker: boolean;
    hasSaveFilePicker: boolean;
    hasDirectoryPicker: boolean;
    indexedDB: boolean;
    serviceWorker: boolean;
    clipboard: boolean;
  };
  storage: {
    usageMB?: number;
    quotaMB?: number;
    persisted?: boolean;
  };
  documentStats: {
    documentCount: number;
    totalCharCount: number; // 내용이 아닌 글자 수 합계 숫자
    attachmentCount: number;
    attachmentTotalBytes: number;
    connectedFileCount: number; // 파일 핸들 연결된 문서 수
    hasFolderConnected: boolean; // 작업 폴더 연결 여부
  };
  viewMode: string;
  recentErrors: readonly CapturedError[];
  lastBackupTime?: string | null;
}

/**
 * 용량 바이트를 사람이 읽기 쉬운 문자열로 변환합니다.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 수집된 진단 정보를 바탕으로 개발자에게 전달할 한국어 진단 보고서 문자열을 생성합니다.
 */
export function buildDiagnosticsReport(data: DiagnosticsData): string {
  const lines: string[] = [];

  lines.push('=== MarkView 문제 보고 정보 ===');
  lines.push('※ 안내: 본 정보에는 문서 내용, 파일 이름, 로컬 폴더 경로가 일절 포함되지 않습니다.');
  lines.push('');

  // 1. 앱 및 빌드 정보
  lines.push('[앱 정보]');
  lines.push(`- 앱 이름: ${data.app.name || 'MarkView'}`);
  lines.push(`- 버전: ${data.app.version || '알 수 없음'}`);
  lines.push(`- 빌드 시각: ${data.app.buildTime || '알 수 없음'}`);
  lines.push('');

  // 2. 실행 환경 및 브라우저
  lines.push('[실행 환경]');
  const modeText =
    data.runtime.mode === 'standalone'
      ? '설치된 앱 (PWA Standalone)'
      : data.runtime.mode === 'file'
        ? '로컬 파일 (file: 포터블)'
        : '웹 브라우저 (web)';
  lines.push(`- 실행 방식: ${modeText}`);
  lines.push(`- 브라우저: ${data.runtime.userAgent || '알 수 없음'}`);
  lines.push(
    `- 화면 해상도: ${data.runtime.screen.width}x${data.runtime.screen.height} (dpr: ${data.runtime.screen.dpr})`,
  );
  lines.push(`- 테마 설정: ${data.runtime.themeSetting || '알 수 없음'} (실제 적용: ${data.runtime.actualTheme || '알 수 없음'})`);
  lines.push(`- 현재 보기 모드: ${data.viewMode || '알 수 없음'}`);
  lines.push('');

  // 3. 브라우저 API 지원 여부
  lines.push('[기능 지원 현황]');
  lines.push(`- 파일 열기 API: ${data.capabilities.hasOpenFilePicker ? '지원' : '미지원'}`);
  lines.push(`- 파일 저장 API: ${data.capabilities.hasSaveFilePicker ? '지원' : '미지원'}`);
  lines.push(`- 폴더 선택 API: ${data.capabilities.hasDirectoryPicker ? '지원' : '미지원'}`);
  lines.push(`- IndexedDB: ${data.capabilities.indexedDB ? '사용 가능' : '사용 불가'}`);
  lines.push(`- 서비스 워커: ${data.capabilities.serviceWorker ? '지원' : '미지원'}`);
  lines.push(`- 클립보드 API: ${data.capabilities.clipboard ? '지원' : '미지원'}`);
  lines.push('');

  // 4. 저장소 상태
  lines.push('[저장소 상태]');
  if (data.storage.usageMB !== undefined && data.storage.quotaMB !== undefined) {
    const usagePercent =
      data.storage.quotaMB > 0 ? ((data.storage.usageMB / data.storage.quotaMB) * 100).toFixed(1) : '0';
    lines.push(`- 저장소 사용량: ${data.storage.usageMB.toFixed(1)} MB / ${data.storage.quotaMB.toFixed(1)} MB (${usagePercent}%)`);
  } else {
    lines.push('- 저장소 사용량: 알 수 없음');
  }
  lines.push(`- 지속적 저장소(persisted): ${data.storage.persisted ? '보장됨' : '보장되지 않음 / 알 수 없음'}`);
  lines.push(`- 최근 백업 시각: ${data.lastBackupTime ? data.lastBackupTime : '없음'}`);
  lines.push('');

  // 5. 문서 및 첨부 통계 (이름/내용 미포함, 숫자만)
  lines.push('[문서 및 데이터 통계]');
  lines.push(`- 열려 있는 문서 수: ${data.documentStats.documentCount}개`);
  lines.push(`- 전체 글자 수 합계: ${data.documentStats.totalCharCount.toLocaleString()}자`);
  lines.push(
    `- 첨부 이미지: ${data.documentStats.attachmentCount}개 (${formatBytes(data.documentStats.attachmentTotalBytes)})`,
  );
  lines.push(`- 디스크 파일 연결 문서: ${data.documentStats.connectedFileCount}개`);
  lines.push(`- 작업 폴더 연결 여부: ${data.documentStats.hasFolderConnected ? '연결됨' : '연결 안 됨'}`);
  lines.push('');

  // 6. 최근 오류 목록 (경로 가림 적용)
  lines.push(`[최근 오류 목록 (${data.recentErrors.length}건)]`);
  if (data.recentErrors.length === 0) {
    lines.push('- 최근 발생한 오류가 없습니다.');
  } else {
    data.recentErrors.forEach((err, idx) => {
      lines.push(`${idx + 1}. [${err.type}] ${err.time}`);
      lines.push(`   메시지: ${err.message}`);
      if (err.stack) {
        const stackLines = err.stack.split('\n').map((l) => `     ${l}`);
        lines.push(`   스택:\n${stackLines.join('\n')}`);
      }
    });
  }
  lines.push('');
  lines.push('=== 끝 ===');

  return lines.join('\n');
}
