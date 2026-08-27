import { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Modal, Input, message, Spin, Tag, Tooltip } from 'antd';
import {
  MdInventory2,
  MdTextFields,
  MdUploadFile,
  MdDelete,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty,
  MdLockOutline,
} from 'react-icons/md';
import {
  listContexts,
  addRawContext,
  uploadFile,
  deleteContext,
  type BucketContext,
} from '../../services/bucketApi';
import { useSSE, type SSEContextUpdate } from '../../hooks/useSSE';

interface BucketDetailDialogProps {
  open: boolean;
  bucketId: string | null;
  bucketName: string;
  /** True when the bucket was borrowed via marketplace_import (read-only). */
  readOnly?: boolean;
  onClose: () => void;
}

const TEXT_MAX = 50_000;
const FILE_MAX = 10 * 1024 * 1024; // 10 MB — matches backend ai-service limit

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(250, 173, 20, 0.1);
  border: 1px solid rgba(250, 173, 20, 0.3);
  color: #fde68a;
  font-size: 13px;
  line-height: 1.4;
`;

const TabBar = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  align-self: flex-start;
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.6)')};
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%)'
      : 'transparent'};
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    color: ${({ $active }) => ($active ? '#fff' : 'rgba(255, 255, 255, 0.95)')};
    background: ${({ $active }) =>
      $active
        ? 'linear-gradient(135deg, rgba(99, 102, 241, 1) 0%, rgba(139, 92, 246, 1) 100%)'
        : 'rgba(255, 255, 255, 0.06)'};
  }
`;

const FormCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
`;

const FormLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
`;

const Counter = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  align-self: flex-end;
`;

const PrimaryButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  align-self: flex-start;
  transition: transform 0.15s ease;

  &:hover { transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const HiddenFile = styled.input.attrs({ type: 'file' })`
  display: none;
`;

const DropZone = styled.div<{ $dragging: boolean; $disabled?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 140px;
  border-radius: 10px;
  border: 2px dashed
    ${({ $dragging, $disabled }) =>
      $disabled
        ? 'rgba(255, 255, 255, 0.06)'
        : $dragging
        ? 'rgba(139, 92, 246, 0.7)'
        : 'rgba(255, 255, 255, 0.18)'};
  background: ${({ $dragging, $disabled }) =>
    $disabled
      ? 'rgba(255, 255, 255, 0.02)'
      : $dragging
      ? 'rgba(139, 92, 246, 0.1)'
      : 'rgba(255, 255, 255, 0.03)'};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  padding: 16px;
  transition: all 0.15s ease;

  &:hover {
    ${({ $disabled }) =>
      $disabled
        ? ''
        : `
      border-color: rgba(139, 92, 246, 0.55);
      background: rgba(139, 92, 246, 0.08);
    `}
  }
`;

const SectionLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 6px;
`;

const ContextList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 360px;
  overflow-y: auto;
  padding-right: 4px;
`;

const ContextRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.02);
`;

const ContextInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const ContextTitle = styled.div`
  font-size: 14px;
  color: #fff;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ContextMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const StatusBadge = styled.span<{ $status: 'inprogress' | 'completed' | 'error' | 'pending' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  background: ${({ $status }) => {
    switch ($status) {
      case 'completed': return 'rgba(52, 211, 153, 0.15)';
      case 'error': return 'rgba(248, 113, 113, 0.15)';
      case 'inprogress':
      case 'pending':
      default: return 'rgba(99, 102, 241, 0.15)';
    }
  }};
  color: ${({ $status }) => {
    switch ($status) {
      case 'completed': return '#34d399';
      case 'error': return '#f87171';
      case 'inprogress':
      case 'pending':
      default: return '#a5b4fc';
    }
  }};
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;

  &:hover {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const EmptyContexts = styled.div`
  text-align: center;
  padding: 32px 16px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
`;

const StatusIcon = ({ status }: { status: BucketContext['status'] }) => {
  switch (status) {
    case 'completed': return <MdCheckCircle size={11} />;
    case 'error': return <MdError size={11} />;
    case 'inprogress':
    case 'pending':
    default: return <MdHourglassEmpty size={11} />;
  }
};

type AddTab = 'text' | 'file';

const BucketDetailDialog = ({
  open,
  bucketId,
  bucketName,
  readOnly = false,
  onClose,
}: BucketDetailDialogProps) => {
  const [contexts, setContexts] = useState<BucketContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>('text');
  const [textInput, setTextInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedText = textInput.trim();
  const canSubmitText = trimmedText.length > 0 && trimmedText.length <= TEXT_MAX && !adding;

  // Fetch contexts when the dialog opens for a bucket.
  useEffect(() => {
    if (!open || !bucketId) {
      setContexts([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listContexts(bucketId)
      .then((rows) => {
        if (!cancelled) setContexts(rows);
      })
      .catch((err) => {
        console.error('Failed to load contexts:', err);
        if (!cancelled) message.error('Failed to load contexts');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, bucketId]);

  // SSE: live status updates while items are indexing. Only listens when the
  // dialog is open AND there's at least one in-flight context to wait on.
  const handleSSEUpdate = useCallback(
    (update: SSEContextUpdate) => {
      setContexts((prev) =>
        prev.map((ctx) =>
          ctx.contextId === update.contextId
            ? {
                ...ctx,
                status: update.status,
                errorMessage: update.errorMessage ?? ctx.errorMessage,
                title: update.title ?? ctx.title,
                description: update.description ?? ctx.description,
              }
            : ctx,
        ),
      );
    },
    [],
  );

  const hasInflight = contexts.some(
    (c) => c.status === 'inprogress' || c.status === 'pending',
  );
  useSSE({ enabled: open && hasInflight, onContextUpdate: handleSSEUpdate });

  // Re-fetch the canonical context list from the backend instead of trusting
  // the partial shape returned by add-raw-context / upload-file (those only
  // return contextId, title, description, profileId, createdAt — missing
  // sourceType, status, etc., which would render as undefined badges).
  const refreshContexts = useCallback(async () => {
    if (!bucketId) return;
    try {
      const rows = await listContexts(bucketId);
      setContexts(rows);
    } catch (err) {
      console.error('Failed to refresh contexts:', err);
    }
  }, [bucketId]);

  const handleSubmitText = useCallback(async () => {
    if (!bucketId || !canSubmitText) return;
    setAdding(true);
    try {
      await addRawContext(bucketId, trimmedText);
      await refreshContexts();
      setTextInput('');
      message.success('Context added');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to add context';
      message.error(msg);
    } finally {
      setAdding(false);
    }
  }, [bucketId, canSubmitText, trimmedText, refreshContexts]);

  const handleSubmitFile = useCallback(
    async (file: File) => {
      if (!bucketId) return;
      if (file.size > FILE_MAX) {
        message.error('File too large (max 10MB)');
        return;
      }
      setAdding(true);
      try {
        await uploadFile(bucketId, file);
        await refreshContexts();
        message.success(`Uploaded "${file.name}"`);
      } catch (err: unknown) {
        console.error(err);
        const msg = err instanceof Error ? err.message : 'Failed to upload file';
        message.error(msg);
      } finally {
        setAdding(false);
      }
    },
    [bucketId, refreshContexts],
  );

  const handleDelete = useCallback(async (contextId: string) => {
    setDeletingId(contextId);
    try {
      await deleteContext(contextId);
      setContexts((prev) => prev.filter((c) => c.contextId !== contextId));
      message.success('Context deleted');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to delete context';
      message.error(msg);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleSubmitFile(file);
  };

  const handleClose = () => {
    if (adding) return; // don't close mid-upload
    setTextInput('');
    setDragging(false);
    setAddTab('text');
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdInventory2 size={18} />
          {bucketName || 'Bucket'}
        </span>
      }
      footer={null}
      width={680}
      destroyOnHidden
    >
      <Container>
        {readOnly && (
          <Banner>
            <MdLockOutline size={16} />
            This bucket was imported from another account — read-only. You can&apos;t add or remove
            contexts. To chat with it, use the Talk to Memory tab.
          </Banner>
        )}

        {!readOnly && (
          <>
            <TabBar>
              <TabButton $active={addTab === 'text'} onClick={() => setAddTab('text')}>
                <MdTextFields size={14} />
                Add text
              </TabButton>
              <TabButton $active={addTab === 'file'} onClick={() => setAddTab('file')}>
                <MdUploadFile size={14} />
                Upload file
              </TabButton>
            </TabBar>

            {addTab === 'text' ? (
              <FormCard>
                <FormLabel>Paste or type the text you want to remember</FormLabel>
                <Input.TextArea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  maxLength={TEXT_MAX}
                  placeholder="A meeting note, a research finding, a recipe…"
                  autoSize={{ minRows: 4, maxRows: 10 }}
                />
                <Counter>{trimmedText.length}/{TEXT_MAX}</Counter>
                <PrimaryButton onClick={handleSubmitText} disabled={!canSubmitText}>
                  {adding ? 'Adding…' : 'Add to bucket'}
                </PrimaryButton>
              </FormCard>
            ) : (
              <FormCard>
                <FormLabel>Drop a file or click to upload</FormLabel>
                <DropZone
                  $dragging={dragging}
                  $disabled={adding}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !adding && fileInputRef.current?.click()}
                >
                  <MdUploadFile size={28} />
                  <div>{adding ? 'Uploading…' : dragging ? 'Drop to upload' : 'Drag & drop or click'}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>
                    PDF, DOCX, TXT, MD, and more · up to 10MB
                  </div>
                </DropZone>
                <HiddenFile
                  ref={fileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSubmitFile(file);
                    e.target.value = '';
                  }}
                />
              </FormCard>
            )}
          </>
        )}

        <div>
          <SectionLabel>
            Contexts {contexts.length > 0 && `(${contexts.length})`}
            {hasInflight && (
              <span style={{ marginLeft: 8, fontSize: 11, color: '#a5b4fc' }}>
                <Spin size="small" /> indexing…
              </span>
            )}
          </SectionLabel>

          {loading ? (
            <EmptyContexts>
              <Spin />
            </EmptyContexts>
          ) : contexts.length === 0 ? (
            <EmptyContexts>
              {readOnly
                ? 'No contexts in this bucket yet.'
                : 'No contexts yet. Add text or upload a file above.'}
            </EmptyContexts>
          ) : (
            <ContextList>
              {contexts.map((ctx) => (
                <ContextRow key={ctx.contextId}>
                  <ContextInfo>
                    <ContextTitle>{ctx.title || 'Untitled'}</ContextTitle>
                    <ContextMeta>
                      <Tag style={{ margin: 0, fontSize: 10 }}>{ctx.sourceType}</Tag>
                      {ctx.originalFileName && <span>· {ctx.originalFileName}</span>}
                    </ContextMeta>
                  </ContextInfo>

                  <Tooltip title={ctx.errorMessage || undefined}>
                    <StatusBadge $status={ctx.status}>
                      <StatusIcon status={ctx.status} />
                      {ctx.status === 'inprogress' || ctx.status === 'pending'
                        ? 'Indexing'
                        : ctx.status === 'completed'
                        ? 'Ready'
                        : 'Failed'}
                    </StatusBadge>
                  </Tooltip>

                  {!readOnly && (
                    <Tooltip title="Delete context">
                      <IconButton
                        onClick={() => handleDelete(ctx.contextId)}
                        disabled={deletingId === ctx.contextId}
                      >
                        <MdDelete size={16} />
                      </IconButton>
                    </Tooltip>
                  )}
                </ContextRow>
              ))}
            </ContextList>
          )}
        </div>
      </Container>
    </Modal>
  );
};

export default BucketDetailDialog;
