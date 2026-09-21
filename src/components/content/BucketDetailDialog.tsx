import { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Modal, Input, message, Popconfirm, Spin, Tag, Tooltip } from 'antd';
import {
  MdInventory2,
  MdTextFields,
  MdUploadFile,
  MdDelete,
  MdCheckCircle,
  MdError,
  MdHourglassEmpty,
  MdLockOutline,
  MdVisibility,
  MdAutoAwesome,
  MdEdit,
} from 'react-icons/md';
import {
  listContexts,
  addRawContext,
  uploadFile,
  deleteContext,
  getSkill,
  deleteSkill,
  type BucketContext,
  type SkillRecord,
} from '../../services/bucketApi';
import { useSSE, type SSEContextUpdate } from '../../hooks/useSSE';
import ContextContentModal from './ContextContentModal';
import SkillEditorDialog from './SkillEditorDialog';

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

// ── Skill panel ────────────────────────────────────────────────────────────
const SkillPanel = styled.div<{ $empty?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  background: ${({ $empty }) => ($empty ? 'rgba(255, 255, 255, 0.03)' : 'rgba(99, 102, 241, 0.08)')};
  border: 1px solid ${({ $empty }) => ($empty ? 'rgba(255, 255, 255, 0.08)' : 'rgba(99, 102, 241, 0.3)')};
`;

const SkillIcon = styled.div<{ $empty?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  color: ${({ $empty }) => ($empty ? 'rgba(255, 255, 255, 0.45)' : '#c7d2fe')};
  background: ${({ $empty }) => ($empty ? 'rgba(255, 255, 255, 0.05)' : 'rgba(99, 102, 241, 0.2)')};
`;

const SkillBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const SkillLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.45);
`;

const SkillName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
`;

const SkillSummary = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.45;
`;

const SkillEmptyText = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.45;
`;

const SkillActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const SmallButton = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: all 0.15s ease;
  border: 1px solid
    ${({ $primary, $danger }) =>
      $primary ? 'transparent' : $danger ? 'rgba(248, 113, 113, 0.3)' : 'rgba(255, 255, 255, 0.14)'};
  color: ${({ $primary, $danger }) => ($primary ? '#fff' : $danger ? '#fca5a5' : 'rgba(255, 255, 255, 0.85)')};
  background: ${({ $primary }) =>
    $primary
      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)'
      : 'rgba(255, 255, 255, 0.04)'};

  &:hover {
    color: #fff;
    ${({ $primary, $danger }) =>
      $primary
        ? 'transform: translateY(-1px);'
        : $danger
        ? 'background: rgba(248, 113, 113, 0.12); border-color: rgba(248, 113, 113, 0.5);'
        : 'border-color: rgba(139, 92, 246, 0.5);'}
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
`;

const SkillInstructions = styled.pre`
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
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

// Same footprint as IconButton but a "look" affordance, not a destructive one.
const ViewIconButton = styled(IconButton)`
  &:hover {
    color: #c7d2fe;
    background: rgba(99, 102, 241, 0.15);
  }
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

// Elapsed minutes for an item still indexing; shown so "Indexing" never
// looks silently stuck. The backend fails items after 15 minutes.
function processingMinutes(createdAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000));
}

function indexingLabel(createdAt: string): string {
  const mins = processingMinutes(createdAt);
  return mins >= 1 ? `Indexing ${mins}m` : 'Indexing';
}

function indexingHint(createdAt: string): string | undefined {
  const mins = processingMinutes(createdAt);
  if (mins < 3) return undefined;
  return `Still processing after ${mins} minutes. Large files can take a while; after 15 minutes it is marked as failed so you can delete and re-add it.`;
}

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
  const [titleInput, setTitleInput] = useState('');
  const [viewCtx, setViewCtx] = useState<{ id: string; title: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Skill = optional playbook stored on the bucket. The backend always answers
  // (default skill when none is set), so `skill` being null just means the
  // fetch has not finished or failed.
  const [skill, setSkill] = useState<SkillRecord | null>(null);
  const [skillError, setSkillError] = useState(false);
  const [skillEditorOpen, setSkillEditorOpen] = useState(false);
  const [skillViewOpen, setSkillViewOpen] = useState(false);
  const [removingSkill, setRemovingSkill] = useState(false);

  const trimmedText = textInput.trim();
  const canSubmitText = trimmedText.length > 0 && trimmedText.length <= TEXT_MAX && !adding;

  // Monotonic request id so a slow response for a previously opened bucket
  // (or one closed mid-flight) cannot overwrite the current panel.
  const skillReqRef = useRef(0);
  // Promise style on purpose: state is only touched inside the .then/.catch
  // callbacks, so calling this from the open effect is not a synchronous
  // setState-in-effect. Reset happens in handleClose.
  const refreshSkill = useCallback((): Promise<void> => {
    if (!bucketId) return Promise.resolve();
    const seq = ++skillReqRef.current;
    return getSkill(bucketId)
      .then((record) => {
        if (seq !== skillReqRef.current) return;
        setSkill(record);
        setSkillError(false);
      })
      .catch((err) => {
        console.error('Failed to load skill:', err);
        if (seq !== skillReqRef.current) return;
        setSkill(null);
        setSkillError(true);
      });
  }, [bucketId]);

  // Fetch the skill when the dialog opens for a bucket.
  useEffect(() => {
    if (!open || !bucketId) return;
    void refreshSkill();
  }, [open, bucketId, refreshSkill]);

  // "Loading" is derived: dialog open, nothing fetched yet, no failure.
  const skillLoading = open && !!bucketId && !skill && !skillError;

  const handleRemoveSkill = useCallback(async () => {
    if (!bucketId) return;
    setRemovingSkill(true);
    try {
      await deleteSkill(bucketId);
      message.success('Skill removed');
      setSkill(null);
      await refreshSkill();
    } catch (err: unknown) {
      console.error(err);
      message.error(err instanceof Error ? err.message : 'Failed to remove skill');
    } finally {
      setRemovingSkill(false);
    }
  }, [bucketId, refreshSkill]);

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
      await addRawContext(bucketId, trimmedText, titleInput);
      await refreshContexts();
      setTextInput('');
      setTitleInput('');
      message.success('Context added');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to add context';
      message.error(msg);
    } finally {
      setAdding(false);
    }
  }, [bucketId, canSubmitText, trimmedText, titleInput, refreshContexts]);

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
    setTitleInput('');
    setViewCtx(null);
    setDragging(false);
    setAddTab('text');
    setSkillEditorOpen(false);
    setSkillViewOpen(false);
    skillReqRef.current += 1; // drop any in-flight skill fetch
    setSkill(null);
    setSkillError(false);
    onClose();
  };

  const hasCustomSkill = !!skill?.hasSkill;

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
            This memory is minted, so its contexts and skill are frozen on chain. You can view them but not
            change them. To chat with it, use the Talk to Memory tab.
          </Banner>
        )}

        <SkillPanel $empty={!hasCustomSkill}>
          <SkillIcon $empty={!hasCustomSkill}>
            <MdAutoAwesome size={18} />
          </SkillIcon>
          <SkillBody>
            <SkillLabel>Skill</SkillLabel>
            {skillLoading ? (
              <SkillEmptyText>
                <Spin size="small" /> <span style={{ marginLeft: 6 }}>Loading skill…</span>
              </SkillEmptyText>
            ) : skillError ? (
              <SkillEmptyText style={{ color: '#f87171' }}>
                Could not load the skill. Close and reopen the bucket to retry.
              </SkillEmptyText>
            ) : hasCustomSkill ? (
              <>
                <SkillName>{skill?.name}</SkillName>
                {skill?.summary ? (
                  <SkillSummary>{skill.summary}</SkillSummary>
                ) : (
                  <SkillSummary style={{ opacity: 0.6 }}>No summary.</SkillSummary>
                )}
              </>
            ) : readOnly ? (
              <SkillEmptyText>
                No custom skill. Holders get the default knowledge assistant.
              </SkillEmptyText>
            ) : (
              <SkillEmptyText>
                No skill yet. Buyers will get the default knowledge assistant. Add one to turn this
                bucket into a Skill.
              </SkillEmptyText>
            )}
          </SkillBody>
          <SkillActions>
            {readOnly ? (
              hasCustomSkill && (
                <SmallButton onClick={() => setSkillViewOpen(true)}>
                  <MdVisibility size={14} />
                  View instructions
                </SmallButton>
              )
            ) : hasCustomSkill ? (
              <>
                <SmallButton onClick={() => setSkillEditorOpen(true)} disabled={removingSkill}>
                  <MdEdit size={14} />
                  Edit
                </SmallButton>
                <Popconfirm
                  title="Remove this skill?"
                  description="The bucket will fall back to the default knowledge assistant."
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancel"
                  onConfirm={() => {
                    void handleRemoveSkill();
                  }}
                >
                  <SmallButton $danger disabled={removingSkill}>
                    {removingSkill ? <Spin size="small" /> : <MdDelete size={14} />}
                    Remove
                  </SmallButton>
                </Popconfirm>
              </>
            ) : (
              <SmallButton $primary onClick={() => setSkillEditorOpen(true)} disabled={skillLoading}>
                <MdAutoAwesome size={14} />
                Add skill
              </SmallButton>
            )}
          </SkillActions>
        </SkillPanel>

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
                <FormLabel>
                  Title <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                </FormLabel>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Notes from Monday's meeting (leave blank and we'll suggest one)"
                />
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
                  {adding && <Spin size="small" />}
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
                  {adding ? <Spin /> : <MdUploadFile size={28} />}
                  <div>{adding ? 'Uploading & indexing…' : dragging ? 'Drop to upload' : 'Drag & drop or click'}</div>
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
                <ContextRow
                  key={ctx.contextId}
                  style={{ opacity: deletingId === ctx.contextId ? 0.5 : 1 }}
                >
                  <ContextInfo>
                    <ContextTitle>{ctx.title || 'Untitled'}</ContextTitle>
                    <ContextMeta>
                      <Tag style={{ margin: 0, fontSize: 10 }}>{ctx.sourceType}</Tag>
                      {ctx.originalFileName && <span>· {ctx.originalFileName}</span>}
                    </ContextMeta>
                  </ContextInfo>

                  <Tooltip
                    title={
                      ctx.errorMessage ||
                      (ctx.status === 'inprogress' || ctx.status === 'pending'
                        ? indexingHint(ctx.createdAt)
                        : undefined)
                    }
                  >
                    <StatusBadge $status={ctx.status}>
                      <StatusIcon status={ctx.status} />
                      {ctx.status === 'inprogress' || ctx.status === 'pending'
                        ? indexingLabel(ctx.createdAt)
                        : ctx.status === 'completed'
                        ? 'Ready'
                        : 'Failed'}
                    </StatusBadge>
                  </Tooltip>

                  {ctx.status === 'completed' && (
                    <Tooltip title="View content">
                      <ViewIconButton
                        onClick={() => setViewCtx({ id: ctx.contextId, title: ctx.title || 'Untitled' })}
                      >
                        <MdVisibility size={16} />
                      </ViewIconButton>
                    </Tooltip>
                  )}

                  {!readOnly && (
                    <Tooltip title={deletingId === ctx.contextId ? 'Deleting…' : 'Delete context'}>
                      <IconButton
                        onClick={() => handleDelete(ctx.contextId)}
                        disabled={deletingId === ctx.contextId}
                      >
                        {deletingId === ctx.contextId ? (
                          <Spin size="small" />
                        ) : (
                          <MdDelete size={16} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}
                </ContextRow>
              ))}
            </ContextList>
          )}
        </div>
      </Container>

      <ContextContentModal
        open={!!viewCtx}
        contextId={viewCtx?.id ?? null}
        title={viewCtx?.title}
        onClose={() => setViewCtx(null)}
      />

      <SkillEditorDialog
        open={skillEditorOpen}
        bucketId={bucketId}
        initial={skill}
        onClose={() => setSkillEditorOpen(false)}
        onSaved={() => {
          void refreshSkill();
        }}
      />

      {/* Read-only instructions viewer for minted buckets (skill is frozen). */}
      <Modal
        open={skillViewOpen}
        onCancel={() => setSkillViewOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <MdAutoAwesome size={18} />
            {skill?.name || 'Skill'}
          </span>
        }
      >
        <Container>
          {skill?.summary && <SkillSummary>{skill.summary}</SkillSummary>}
          <SkillInstructions>{skill?.instructions || 'No instructions stored.'}</SkillInstructions>
        </Container>
      </Modal>
    </Modal>
  );
};

export default BucketDetailDialog;
