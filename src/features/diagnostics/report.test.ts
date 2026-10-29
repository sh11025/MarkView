import { describe, it, expect } from 'vitest';
import { buildDiagnosticsReport, type DiagnosticsData } from './report';

describe('buildDiagnosticsReport (문제 정보 보고서 생성 및 개인정보 보호)', () => {
  const dummyInfo: DiagnosticsData = {
    app: {
      name: 'MarkView',
      version: '0.1.0',
      buildTime: '2026-10-28T09:00:00.000Z',
    },
    runtime: {
      mode: 'web',
      userAgent: 'Mozilla/5.0 TestBrowser',
      screen: { width: 1920, height: 1080, dpr: 1 },
      themeSetting: 'system',
      actualTheme: 'light',
    },
    capabilities: {
      hasOpenFilePicker: true,
      hasSaveFilePicker: true,
      hasDirectoryPicker: false,
      indexedDB: true,
      serviceWorker: true,
      clipboard: true,
    },
    storage: {
      usageMB: 12.5,
      quotaMB: 1024,
      persisted: false,
    },
    documentStats: {
      documentCount: 3,
      totalCharCount: 4500,
      attachmentCount: 2,
      attachmentTotalBytes: 154000,
      connectedFileCount: 1,
      hasFolderConnected: false,
    },
    viewMode: 'split',
    recentErrors: [],
    lastBackupTime: '2026-10-27T18:00:00.000Z',
  };

  it('필수 진단 필드들이 빠짐없이 보고서 텍스트에 포함된다', () => {
    const report = buildDiagnosticsReport(dummyInfo);

    expect(report).toContain('MarkView');
    expect(report).toContain('0.1.0');
    expect(report).toContain('Mozilla/5.0 TestBrowser');
    expect(report).toContain('1920x1080');
    expect(report).toContain('파일 열기 API: 지원');
    expect(report).toContain('폴더 선택 API: 미지원');
    expect(report).toContain('열려 있는 문서 수: 3개');
    expect(report).toContain('전체 글자 수 합계: 4,500자');
    expect(report).toContain('2026-10-27T18:00:00.000Z');
  });

  it('누락되거나 빈 값에 대해 "알 수 없음" 처리를 한다', () => {
    const emptyInfo: DiagnosticsData = {
      app: { name: '', version: '', buildTime: '' },
      runtime: {
        mode: 'unknown',
        userAgent: '',
        screen: { width: 0, height: 0, dpr: 1 },
        themeSetting: '',
        actualTheme: '',
      },
      capabilities: {
        hasOpenFilePicker: false,
        hasSaveFilePicker: false,
        hasDirectoryPicker: false,
        indexedDB: false,
        serviceWorker: false,
        clipboard: false,
      },
      storage: {},
      documentStats: {
        documentCount: 0,
        totalCharCount: 0,
        attachmentCount: 0,
        attachmentTotalBytes: 0,
        connectedFileCount: 0,
        hasFolderConnected: false,
      },
      viewMode: '',
      recentErrors: [],
    };

    const report = buildDiagnosticsReport(emptyInfo);
    expect(report).toContain('버전: 알 수 없음');
    expect(report).toContain('브라우저: 알 수 없음');
    expect(report).toContain('저장소 사용량: 알 수 없음');
    expect(report).toContain('최근 백업 시각: 없음');
  });

  it('개인정보 비누출 테스트: 문서 내용 및 파일 이름이 보고서에 구조적으로도, 결과 텍스트에도 절대 포함되지 않는다', () => {
    const secretContent = '비밀_문서_내용_초특급비밀_12345';
    const secretDocName = '비밀_계약서_개인정보.md';

    const report = buildDiagnosticsReport({
      ...dummyInfo,
      recentErrors: [
        {
          time: new Date().toISOString(),
          type: 'error',
          // errorCollector에 의해 마스킹된 에러
          message: `저장 실패: [경로/파일.docx] 파일 권한 오류`,
        },
      ],
    });

    // 1. 비밀 문자열들이 일절 포함되지 않아야 함
    expect(report).not.toContain(secretContent);
    expect(report).not.toContain(secretDocName);
    expect(report).not.toContain('TopSecret');
    expect(report).not.toContain('finance.docx');
    expect(report).not.toContain('C:\\Users');

    // 2. 개인정보 미포함 안내 문구 확인
    expect(report).toContain('문서 내용, 파일 이름, 로컬 폴더 경로가 일절 포함되지 않습니다');
  });
});
