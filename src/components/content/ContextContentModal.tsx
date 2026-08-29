import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Modal, Spin, Tag } from 'antd';
import { MdDescription, MdExpandMore } from 'react-icons/md';
import { getContextContent, type ContextContentPage } from '../../services/bucketApi';

interface Props {
  open: boolean;
  contextId: string | null;
  /** Title to show while the first page is still loading. */
  title?: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
`;

const Description = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const Body = styled.pre`
  margin: 0;
  max-height: 60vh;
  overflow-y: auto;
  padding: 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
`;

const LoadMore = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: center;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  cursor: pointer;

  &:hover { border-color: rgba(139, 92, 246, 0.5); color: #fff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/**
 * Read-only viewer for one stored item. Pages through the backend's chunked
 * content endpoint so a 10 MB upload doesn't land in the DOM in one go.
 */
const ContextContentModal = ({ open, contextId, title, onClose }: Props) => {
  const [page, setPage] = useState<ContextContentPage | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (startChunk: number) => {
      if (!contextId) return;
      setLoading(true);
      setError(null);
      try {
        const next = await getContextContent(contextId, startChunk, PAGE_SIZE);
        setPage(next);
        setContent((prev) => (startChunk === 0 ? next.content : `${prev}\n\n${next.content}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    },
    [contextId],
  );

  // Reset + fetch the first page whenever a different item is opened.
  useEffect(() => {
    if (!open || !contextId) {
      setPage(null);
      setContent('');
      setError(null);
      return;
    }
    void load(0);
  }, [open, contextId, load]);

  const hasMore = page?.nextChunk !== null && page?.nextChunk !== undefined;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdDescription size={18} />
          {page?.title || title || 'Content'}
        </span>
      }
    >
      <Wrap>
        {page && (
          <Meta>
            {page.sourceType && <Tag style={{ margin: 0, fontSize: 10 }}>{page.sourceType}</Tag>}
            {page.originalFileName && <span>{page.originalFileName}</span>}
            <span>
              {page.totalChunks} part{page.totalChunks === 1 ? '' : 's'}
            </span>
          </Meta>
        )}

        {page?.description && <Description>{page.description}</Description>}

        {error ? (
          <Center style={{ color: '#f87171' }}>{error}</Center>
        ) : !page && loading ? (
          <Center>
            <Spin /> <span style={{ marginLeft: 10 }}>Loading content…</span>
          </Center>
        ) : (
          <Body>{content || 'No text stored for this item.'}</Body>
        )}

        {hasMore && (
          <LoadMore onClick={() => page && page.nextChunk !== null && load(page.nextChunk)} disabled={loading}>
            {loading ? <Spin size="small" /> : <MdExpandMore size={16} />}
            {loading ? 'Loading…' : 'Show more'}
          </LoadMore>
        )}
      </Wrap>
    </Modal>
  );
};

export default ContextContentModal;
