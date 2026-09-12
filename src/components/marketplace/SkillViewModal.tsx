import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Modal, Spin, Tag } from 'antd';
import { MdAutoAwesome, MdToken } from 'react-icons/md';
import { getSkill, type SkillRecord } from '../../services/bucketApi';

interface Props {
  open: boolean;
  /** Bucket whose skill to show. Null keeps the modal empty. */
  profileId: string | null;
  /** Name to show in the title while the record is still loading. */
  title?: string | null;
  onClose: () => void;
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Summary = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const Label = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
`;

const Instructions = styled.pre`
  margin: 0;
  max-height: 50vh;
  overflow-y: auto;
  padding: 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`;

const MemoryList = styled.div`
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  max-height: 220px;
  overflow-y: auto;
`;

const MemoryRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);

  &:last-child {
    border-bottom: none;
  }
`;

const MemoryText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MemoryDescription = styled.span`
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
`;

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
`;

/**
 * Read-only viewer for a bucket's Skill (name, summary, full instructions
 * and the memory index). Only the creator and NFT holders can load it; the
 * backend answers 404 for anyone else, so callers gate the button.
 */
const SkillViewModal = ({ open, profileId, title, onClose }: Props) => {
  const [record, setRecord] = useState<SkillRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !profileId) {
      setRecord(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSkill(profileId)
      .then((rec) => {
        if (!cancelled) setRecord(rec);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load skill');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, profileId]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdAutoAwesome size={18} />
          {record?.name || title || 'Skill'}
          {record?.isDefault && (
            <Tag style={{ margin: 0, fontSize: 10 }}>default</Tag>
          )}
        </span>
      }
    >
      <Wrap>
        {loading ? (
          <Center>
            <Spin />
          </Center>
        ) : error ? (
          <Center style={{ color: '#f87171' }}>{error}</Center>
        ) : record ? (
          <>
            {record.isDefault && (
              <Summary>
                This bucket has no custom skill, so it comes with the default knowledge assistant
                shown below.
              </Summary>
            )}
            {record.summary && !record.isDefault && <Summary>{record.summary}</Summary>}

            <Label>Instructions</Label>
            <Instructions>{record.instructions}</Instructions>

            <Label>
              Memory in this Skill ({record.memoryIndex.length} item
              {record.memoryIndex.length === 1 ? '' : 's'})
            </Label>
            {record.memoryIndex.length > 0 ? (
              <MemoryList>
                {record.memoryIndex.map((m) => (
                  <MemoryRow key={m.contextId}>
                    <MdToken size={14} style={{ flexShrink: 0, marginTop: 1, opacity: 0.6 }} />
                    <MemoryText>
                      <span>{m.title}</span>
                      {m.description && <MemoryDescription>{m.description}</MemoryDescription>}
                    </MemoryText>
                    <Tag style={{ margin: 0, fontSize: 10 }}>{m.sourceType}</Tag>
                  </MemoryRow>
                ))}
              </MemoryList>
            ) : (
              <Center style={{ padding: 16 }}>No memory items yet.</Center>
            )}
          </>
        ) : null}
      </Wrap>
    </Modal>
  );
};

export default SkillViewModal;
