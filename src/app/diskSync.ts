/**
 * 디스크 파일 변경 감지 및 동기화 모듈.
 * 창이 포커스되거나(focus) 가시 상태(visibilitychange: visible)로 바뀔 때,
 * 그리고 앱 시작 시 1회 디스크 파일 변경을 확인한다.
 * 주기적 폴링이나 타이머는 절대 사용하지 않는다.
 */
import { isDirty, useDocuments } from '../stores/documents';
import { useUi } from '../stores/ui';
import { getHandleFile } from '../storage/fileSystem';
import { decideDiskSync } from '../features/disksync/decide';

let isChecking = false;
/** 동일한 디스크 변경에 대해 충돌 알림이 중복으로 뜨지 않도록 기억 (문서id:디스크수정시각) */
const notifiedConflicts = new Set<string>();

export async function checkDiskChanges(): Promise<void> {
  if (isChecking) return;
  isChecking = true;

  try {
    const docs = useDocuments.getState().docs;
    const handledDocs = Object.values(docs).filter((d) => Boolean(d?.handleId));
    if (handledDocs.length === 0) return;

    for (const doc of handledDocs) {
      if (!doc.handleId) continue;

      const fileInfo = await getHandleFile(doc.handleId);
      if (!fileInfo) continue;

      const currentDiskModified = fileInfo.file.lastModified;
      const latestDoc = useDocuments.getState().docs[doc.id];
      if (!latestDoc) continue;

      const decision = decideDiskSync({
        knownDiskModified: latestDoc.diskModified,
        currentDiskModified,
        isDirty: isDirty(latestDoc),
      });

      switch (decision) {
        case 'record-only':
          useDocuments.getState().updateDiskModified(doc.id, currentDiskModified);
          break;

        case 'reload': {
          const content = await fileInfo.file.text();
          // 비동기로 읽는 사이 사용자가 타이핑했을 가능성을 방지 (절대 규칙: 사용자 편집 내용 보호)
          const freshDoc = useDocuments.getState().docs[doc.id];
          if (!freshDoc) break;
          if (isDirty(freshDoc)) {
            // 그 사이 편집이 발생했으면 reload를 중단하고 conflict로 전환
            showConflictToast(freshDoc.id, freshDoc.name, fileInfo);
            break;
          }
          useDocuments.getState().reloadDoc(doc.id, content, currentDiskModified);
          useUi.getState().pushToast({
            text: `'${doc.name}'이 바깥에서 바뀌어 다시 불러왔습니다.`,
            kind: 'info',
          });
          break;
        }

        case 'conflict':
          showConflictToast(doc.id, doc.name, fileInfo);
          break;

        case 'none':
        default:
          break;
      }
    }
  } catch (err) {
    console.warn('디스크 파일 변경 확인 중 오류:', err);
  } finally {
    isChecking = false;
  }
}

function showConflictToast(
  docId: string,
  docName: string,
  fileInfo: { file: File },
): void {
  const currentDiskModified = fileInfo.file.lastModified;
  const conflictKey = `${docId}:${currentDiskModified}`;
  if (notifiedConflicts.has(conflictKey)) return;
  notifiedConflicts.add(conflictKey);

  useUi.getState().pushToast({
    text: `'${docName}'이 바깥에서도 수정되었습니다. 지금 저장하면 그 수정을 덮어씁니다.`,
    kind: 'error',
    sticky: true,
    actions: [
      {
        label: '디스크 버전 열기',
        run: async () => {
          try {
            const diskContent = await fileInfo.file.text();
            const baseName = docName.replace(/\.(md|markdown|txt)$/i, '');
            useDocuments.getState().createDoc({
              name: `${baseName} (디스크).md`,
              content: diskContent,
            });
          } catch (err) {
            console.error('디스크 버전 열기 실패:', err);
          }
        },
      },
      {
        label: '무시',
        run: () => {
          useDocuments.getState().updateDiskModified(docId, currentDiskModified);
        },
      },
    ],
  });
}

/**
 * 창 포커스 및 가시성 변경 이벤트 리스너를 등록한다.
 */
export function setupDiskSyncListeners(): () => void {
  const onFocus = () => void checkDiskChanges();
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') void checkDiskChanges();
  };

  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    window.removeEventListener('focus', onFocus);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
