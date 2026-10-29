import { useEffect, useState, lazy, Suspense } from 'react';
import { useUi } from '../stores/ui';
import { loadWorkspace, startAutosave } from '../storage/persistence';
import { isMarkdownFileName } from '../storage/fileSystem';
import { setMarkdownDropHandler } from '../editor/pasteAndDrop';
import { EditorPane } from '../editor/EditorPane';
import { PreviewPane } from '../preview/PreviewPane';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { TocSidebar } from './TocSidebar';
import { Toasts } from './Toasts';
import { EnvironmentBanner } from './EnvironmentBanner';
import { MermaidEditorLoading } from './mermaid/MermaidEditorLoading';
import { useApplyTheme } from './theme';
import { openDropped, saveActive } from './fileActions';
import { recordCurrentPosition } from './positionTracker';
import { checkDiskChanges, setupDiskSyncListeners } from './diskSync';
import { useFolder } from '../stores/folder';
import { useDocuments } from '../stores/documents';
import { WELCOME_DOC } from '../constants/welcome';
import { ErrorBoundary } from './ErrorBoundary';
import { initGlobalErrorCollector } from '../features/diagnostics/errorCollector';
import { triggerStorageQuotaCheck } from './storageQuotaAlert';

// 전역 에러 수집 초기화
initGlobalErrorCollector();

const MermaidEditor = lazy(() => import('./mermaid/MermaidEditor'));
const TemplateGallery = lazy(() => import('./TemplateGallery'));
const MathGallery = lazy(() => import('./MathGallery'));
const DiagramGallery = lazy(() => import('./DiagramGallery'));
const DiagnosticsModal = lazy(() =>
  import('./diagnostics/DiagnosticsModal').then((m) => ({ default: m.DiagnosticsModal })),
);
const RestoreModal = lazy(() =>
  import('./backup/RestoreModal').then((m) => ({ default: m.RestoreModal })),
);

interface InitResult {
  isInMemoryMode: boolean;
}

// StrictMode에서 effect가 두 번 실행돼도 불러오기·자동 저장은 한 번만
let initPromise: Promise<InitResult> | null = null;
function initWorkspaceOnce(): Promise<InitResult> {
  initPromise ??= (async () => {
    try {
      await loadWorkspace();
      startAutosave();
      await useFolder.getState().init();
      return { isInMemoryMode: false };
    } catch (err) {
      console.warn('저장소(IndexedDB) 초기화 실패 -> 임시(in-memory) 모드로 시작합니다:', err);
      // 저장소가 막힌 환경(file: 프로토콜, 시크릿 모드 등)에서는 환영 문서를 메모리에만 열고 진행
      if (useDocuments.getState().order.length === 0) {
        useDocuments.getState().createDoc(WELCOME_DOC);
      }
      return { isInMemoryMode: true };
    }
  })();
  return initPromise;
}

function Workspace({ isInMemoryMode }: { isInMemoryMode: boolean }) {
  const viewMode = useUi((s) => s.viewMode);
  const tocOpen = useUi((s) => s.tocOpen);
  const mermaidEditorTarget = useUi((s) => s.mermaidEditorTarget);
  const templateGalleryOpen = useUi((s) => s.templateGalleryOpen);
  const mathGalleryOpen = useUi((s) => s.mathGalleryOpen);
  const diagramGalleryOpen = useUi((s) => s.diagramGalleryOpen);
  const diagnosticsOpen = useUi((s) => s.diagnosticsOpen);
  const restorePlan = useUi((s) => s.restorePlan);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleConfirmRestore = async () => {
    if (!restorePlan || isRestoring) return;
    setIsRestoring(true);
    try {
      const { executeRestorePlanToDb } = await import('../storage/backupStorage');
      const result = await executeRestorePlanToDb(restorePlan);
      // 열려 있는 탭 목록에 복원된 문서들 추가 (DB 저장 실패 여부와 무관하게 앱 상태에는 반드시 새 탭으로 추가)
      useDocuments.getState().addRestoredDocs(restorePlan.docsToAdd);
      useUi.getState().closeRestoreModal();

      if (result.isStorageUnavailable) {
        // 저장소 차단 환경(임시 모드)
        useUi.getState().pushToast({
          text: '이 환경에서는 자동 저장을 쓸 수 없어 복원한 글은 이 탭이 열려 있는 동안만 유지됩니다. 필요하면 \'저장\'으로 파일에 보관하세요.',
          kind: 'info',
        });
      } else {
        const { docsSuccess, docsFailed, attachmentsFailed } = result;
        let text = '';
        if (docsFailed === 0) {
          text = `문서 ${docsSuccess}개를 새 탭으로 복원했습니다.`;
        } else {
          text = `문서 ${docsSuccess}개 복원 완료 (${docsFailed}개 실패).`;
        }
        if (attachmentsFailed > 0) {
          text += ` 이미지 ${attachmentsFailed}개는 복원하지 못했습니다.`;
        }
        useUi.getState().pushToast({
          text,
          kind: docsFailed === 0 && attachmentsFailed === 0 ? 'success' : 'error',
        });
      }
    } catch {
      // 예외가 발생하더라도 사용자 글은 앱 상태에 추가하고 안내
      useDocuments.getState().addRestoredDocs(restorePlan.docsToAdd);
      useUi.getState().closeRestoreModal();
      useUi.getState().pushToast({
        text: '이 환경에서는 자동 저장을 쓸 수 없어 복원한 글은 이 탭이 열려 있는 동안만 유지됩니다. 필요하면 \'저장\'으로 파일에 보관하세요.',
        kind: 'info',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  // 앱 전역 단축키: Ctrl+S(저장), 미리보기/분할 모드에서 Ctrl+F(미리보기 검색)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveActive();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        const currentViewMode = useUi.getState().viewMode;
        if (currentViewMode === 'preview') {
          e.preventDefault();
          useUi.getState().openPreviewSearch();
        } else if (currentViewMode === 'split') {
          const activeEl = document.activeElement as HTMLElement | null;
          const inEditor = Boolean(activeEl?.closest('.editor-pane, .cm-editor'));
          if (!inEditor) {
            e.preventDefault();
            useUi.getState().openPreviewSearch();
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 창 아무 곳에나 마크다운 파일을 끌어다 놓으면 새 탭으로 연다
  useEffect(() => {
    setMarkdownDropHandler((items) => void openDropped(items));
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length === 0 || e.defaultPrevented) return; // 에디터가 이미 처리함
      e.preventDefault();
      if (files.some((f) => isMarkdownFileName(f.name))) void openDropped(e.dataTransfer!.items);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // 탭이 숨겨지거나 페이지를 벗어날 때 위치를 즉시 기록
  useEffect(() => {
    const onHide = () => recordCurrentPosition();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, []);

  // 창 포커스 시 디스크 변경 감지
  useEffect(() => {
    return setupDiskSyncListeners();
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-[var(--bg)] text-[var(--text)]">
      <EnvironmentBanner isInMemoryMode={isInMemoryMode} />
      <Header />
      <TabBar />
      <div className="flex min-h-0 flex-1">
        {tocOpen && <TocSidebar />}
        <main className={`flex min-h-0 min-w-0 flex-1 ${viewMode === 'split' ? 'flex-col md:flex-row' : ''}`}>
          {/* 에디터는 항상 살아 있어야 미리보기 편집(체크박스·표)이 에디터 기록에 남는다 */}
          <section
            className={`editor-pane min-h-0 min-w-0 flex-1 border-[var(--border)] bg-[var(--surface)] ${
              viewMode === 'preview' ? 'hidden' : ''
            } ${viewMode === 'split' ? 'border-b md:border-r md:border-b-0' : ''}`}
          >
            <EditorPane />
          </section>
          <section className={`preview-pane min-h-0 min-w-0 flex-1 bg-[var(--doc-bg)] ${viewMode === 'editor' ? 'hidden' : ''}`}>
            <PreviewPane />
          </section>
        </main>
      </div>
      <Toasts />
      {templateGalleryOpen && (
        <ErrorBoundary mode="modal" onClose={useUi.getState().closeTemplateGallery}>
          <Suspense fallback={null}>
            <TemplateGallery />
          </Suspense>
        </ErrorBoundary>
      )}
      {mathGalleryOpen && (
        <ErrorBoundary mode="modal" onClose={useUi.getState().closeMathGallery}>
          <Suspense fallback={null}>
            <MathGallery />
          </Suspense>
        </ErrorBoundary>
      )}
      {diagramGalleryOpen && (
        <ErrorBoundary mode="modal" onClose={useUi.getState().closeDiagramGallery}>
          <Suspense fallback={null}>
            <DiagramGallery />
          </Suspense>
        </ErrorBoundary>
      )}
      {mermaidEditorTarget && (
        <ErrorBoundary mode="modal" onClose={useUi.getState().closeMermaidEditor}>
          <Suspense fallback={<MermaidEditorLoading />}>
            <MermaidEditor />
          </Suspense>
        </ErrorBoundary>
      )}
      {diagnosticsOpen && (
        <Suspense fallback={null}>
          <DiagnosticsModal isOpen={diagnosticsOpen} onClose={useUi.getState().closeDiagnostics} />
        </Suspense>
      )}
      {restorePlan && (
        <Suspense fallback={null}>
          <RestoreModal
            isOpen={Boolean(restorePlan)}
            plan={restorePlan}
            onConfirm={handleConfirmRestore}
            onCancel={useUi.getState().closeRestoreModal}
            isRestoring={isRestoring}
          />
        </Suspense>
      )}
    </div>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [isInMemoryMode, setIsInMemoryMode] = useState(false);
  useApplyTheme();

  useEffect(() => {
    initWorkspaceOnce()
      .then((res) => {
        setIsInMemoryMode(res.isInMemoryMode);
        useUi.getState().setEphemeral(res.isInMemoryMode);
        setReady(true);
        void checkDiskChanges();
        void triggerStorageQuotaCheck();
      })
      .catch((err) => {
        console.error(err);
        // 예측하지 못한 심각한 에러여도 임시 모드로 진입 시도
        setIsInMemoryMode(true);
        useUi.getState().setEphemeral(true);
        setReady(true);
      });
  }, []);

  return (
    <ErrorBoundary mode="fullscreen">
      {!ready ? <div className="h-dvh bg-[var(--bg)]" /> : <Workspace isInMemoryMode={isInMemoryMode} />}
    </ErrorBoundary>
  );
}
