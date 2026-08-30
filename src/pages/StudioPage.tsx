import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { Popconfirm, Spin, Tag, Tooltip, message } from 'antd';
import { MdAdd, MdInventory2, MdAutoStories, MdDelete, MdToken } from 'react-icons/md';
import { listBuckets, deleteBucket, type Bucket } from '../services/bucketApi';
import CreateBucketDialog from '../components/content/CreateBucketDialog';
import BucketDetailDialog from '../components/content/BucketDetailDialog';
import MintBucketButton from '../components/content/MintBucketButton';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto;
`;

// StudioPage is rendered inside the marketplace dashboard's "My Drafts" tab,
// which already supplies the title/subtitle. We keep the Create Bucket CTA
// flush-right and skip an in-page title so the headings don't double up.
const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
`;

const CreateButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover { transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
`;

// Card is a div, not a button — the footer hosts a MintBucketButton, and
// nested <button> elements throw a React hydration warning. Click + keyboard
// affordance are added inline at the render site via role="button" + onKeyDown.
const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(20, 22, 40, 0.6) 0%, rgba(12, 14, 28, 0.6) 100%);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(99, 102, 241, 0.45);
    background: linear-gradient(180deg, rgba(28, 30, 52, 0.7) 0%, rgba(18, 20, 36, 0.7) 100%);
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid rgba(139, 92, 246, 0.7);
    outline-offset: 2px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const CardThumb = styled.div<{ $img?: string }>`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background-image: ${({ $img }) =>
    $img ? `url(${$img})` : 'linear-gradient(135deg, rgba(99, 102, 241, 0.45), rgba(236, 72, 153, 0.35))'};
  background-size: cover;
  background-position: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
`;

const CardName = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
`;

const CardMeta = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
`;

const DeleteIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.15s ease;

  &:hover {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
  }
`;

const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
  border-radius: 16px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
  color: rgba(255, 255, 255, 0.6);
  gap: 14px;
`;

const EmptyIcon = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(34, 211, 238, 0.25));
  color: #c7d2fe;
`;

const EmptyTitle = styled.div`
  font-size: 17px;
  font-weight: 600;
  color: #fff;
`;

const EmptyText = styled.div`
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  max-width: 360px;
  line-height: 1.5;
`;

const SpinWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 64px 0;
`;

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

interface StudioPageProps {
  /** Fires whenever a mint completes OR is cancelled — parent re-fetches
   *  any other views (My Minted NFTs) that depend on bucket immutability
   *  state. StudioPage refreshes its own list either way. */
  onBucketStateChanged?: () => void;
}

const StudioPage = ({ onBucketStateChanged }: StudioPageProps = {}) => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeBucket, setActiveBucket] = useState<{
    id: string;
    name: string;
    isImmutable?: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listBuckets();
      setBuckets(list);
    } catch (err) {
      console.error('Failed to load buckets:', err);
      message.error(err instanceof Error ? err.message : 'Failed to load buckets');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const handleCreated = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (b: Bucket) => {
      const hideLoading = message.loading(`Deleting "${b.profileName}"…`, 0);
      try {
        await deleteBucket(b.id);
        message.success(`Deleted "${b.profileName}"`);
        await refresh();
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Failed to delete bucket');
      } finally {
        hideLoading();
      }
    },
    [refresh],
  );

  return (
    <Container>
      <TopRow>
        <CreateButton onClick={() => setCreateOpen(true)}>
          <MdAdd size={18} />
          Create Bucket
        </CreateButton>
      </TopRow>

      {loading ? (
        <SpinWrap>
          <Spin size="large" />
        </SpinWrap>
      ) : buckets.length === 0 ? (
        <EmptyWrap>
          <EmptyIcon>
            <MdAutoStories size={32} />
          </EmptyIcon>
          <EmptyTitle>No buckets yet</EmptyTitle>
          <EmptyText>
            Create your first memory bucket to start adding contexts and chatting with your knowledge.
          </EmptyText>
          <CreateButton onClick={() => setCreateOpen(true)}>
            <MdAdd size={18} />
            Create Your First Bucket
          </CreateButton>
        </EmptyWrap>
      ) : (
        <Grid>
          {buckets.map((b) => (
            <Card
              key={b.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveBucket({ id: b.id, name: b.profileName, isImmutable: !!b.isImmutable })}
              onKeyDown={(e) => {
                // Only act on keys that originated on the Card itself. antd
                // Modals (e.g. the Mint dialog rendered below) portal to
                // <body>, but React synthetic events still bubble through the
                // React tree — so a space typed in the dialog's tagline/
                // description input would otherwise hit this handler and
                // re-open the bucket. Guarding on target===currentTarget keeps
                // keyboard activation working without swallowing nested input.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveBucket({ id: b.id, name: b.profileName, isImmutable: !!b.isImmutable });
                }
              }}
            >
              <CardHeader>
                <CardThumb $img={b.image || undefined}>
                  {!b.image && <MdInventory2 size={22} />}
                </CardThumb>
                <div style={{ minWidth: 0 }}>
                  <CardName>
                    {b.profileName}
                    {b.isImmutable && b.mintedTokenId ? (
                      <Tag
                        icon={<MdToken size={11} style={{ verticalAlign: 'middle' }} />}
                        color="purple"
                        style={{ marginLeft: 6, fontSize: 10 }}
                      >
                        {`Locked · NFT #${b.mintedTokenId}`}
                      </Tag>
                    ) : b.isImmutable ? (
                      <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>
                        Mint pending
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginLeft: 6, fontSize: 10 }}>
                        Draft
                      </Tag>
                    )}
                  </CardName>
                  <CardMeta>
                    {typeof b.contextCount === 'number'
                      ? `${b.contextCount} context${b.contextCount === 1 ? '' : 's'}`
                      : 'Bucket'}
                  </CardMeta>
                </div>
              </CardHeader>
              <Footer>
                <span>{formatDate(b.createdAt)}</span>
                <div
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {b.isOwner !== false && !b.isImmutable && (
                    <>
                      <MintBucketButton
                        profileId={b.id}
                        isOwner={true}
                        isImmutable={false}
                        defaultTitle={b.profileName}
                        // After /mint/confirm flips the bucket to isImmutable,
                        // a refresh removes it from Drafts (backend filters
                        // them out) and surfaces it under My Minted NFTs.
                        onMinted={() => {
                          void refresh();
                          onBucketStateChanged?.();
                        }}
                        // On MetaMask rejection the backend unfreezes the
                        // bucket via /cancel; we need to re-fetch Drafts so
                        // the bucket reappears here, and signal the parent
                        // so My Minted NFTs drops its stale "pending" row.
                        onCancelled={() => {
                          void refresh();
                          onBucketStateChanged?.();
                        }}
                      />
                      <Popconfirm
                        title="Delete this bucket?"
                        description="All contexts and vector data will be permanently removed."
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        cancelText="Cancel"
                        onConfirm={() => {
                          void handleDelete(b);
                        }}
                      >
                        <Tooltip title="Delete bucket">
                          <DeleteIcon>
                            <MdDelete size={15} />
                          </DeleteIcon>
                        </Tooltip>
                      </Popconfirm>
                    </>
                  )}
                </div>
              </Footer>
            </Card>
          ))}
        </Grid>
      )}

      <CreateBucketDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <BucketDetailDialog
        open={!!activeBucket}
        bucketId={activeBucket?.id ?? null}
        bucketName={activeBucket?.name ?? ''}
        // Minted buckets are read-only end-to-end; reuse the existing
        // readOnly affordance the dialog already supports.
        readOnly={!!activeBucket?.isImmutable}
        onClose={() => {
          setActiveBucket(null);
          // Refresh in case context counts changed
          refresh();
        }}
      />
    </Container>
  );
};

export default StudioPage;
