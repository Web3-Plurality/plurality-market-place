import { useState, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Modal, Input, message, Spin } from 'antd';
import { MdCloudUpload, MdToken, MdImage } from 'react-icons/md';
import type { NftMintMetadata } from '../../hooks/useMemoryNFT';

interface MintNftDialogProps {
  open: boolean;
  defaultTitle: string;
  uploading: boolean;
  submitting: boolean;
  mintFeeLabel?: string;
  onClose: () => void;
  onSubmit: (metadata: NftMintMetadata) => void;
  onUploadCover: (dataUrl: string) => Promise<string | null>;
}

const TITLE_MAX = 120;
const TAGLINE_MAX = 280;
const DESCRIPTION_MAX = 5000;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const FormCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const PreviewCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PreviewLabel = styled.div`
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255, 255, 255, 0.45);
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.3px;
`;

const Required = styled.span`
  color: #f87171;
  margin-left: 2px;
`;

const Counter = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  align-self: flex-end;
`;

const HintText = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
`;

// ── Cover upload zone ───────────────────────────────────────────────────────
const CoverDrop = styled.div<{ $hasImage?: boolean }>`
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
  overflow: hidden;
  border: 2px dashed
    ${({ $hasImage }) => ($hasImage ? 'transparent' : 'rgba(255, 255, 255, 0.18)')};
  background: ${({ $hasImage }) => ($hasImage ? 'transparent' : 'rgba(255, 255, 255, 0.03)')};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  &:hover {
    border-color: rgba(139, 92, 246, 0.55);
    background: rgba(139, 92, 246, 0.06);
  }
`;

const CoverImage = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const CoverPlaceholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
`;

// ── Live preview card ───────────────────────────────────────────────────────
const PreviewCard = styled.div`
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
`;

const PreviewCover = styled.div<{ $url?: string }>`
  width: 100%;
  aspect-ratio: 16 / 10;
  background: ${({ $url }) =>
    $url ? `url(${$url}) center / cover` : 'linear-gradient(135deg, #6366f1, #ec4899)'};
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 60%, rgba(0, 0, 0, 0.45) 100%);
  }
`;

const PreviewBody = styled.div`
  padding: 12px 14px;
`;

const PreviewTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PreviewTagline = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const PreviewFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 10px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
`;

const HiddenFile = styled.input.attrs({ type: 'file', accept: 'image/*' })`
  display: none;
`;

const MintNftDialog = ({
  open,
  defaultTitle,
  uploading,
  submitting,
  mintFeeLabel,
  onClose,
  onSubmit,
  onUploadCover,
}: MintNftDialogProps) => {
  const [title, setTitle] = useState(defaultTitle);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverLocalLoading, setCoverLocalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedTitle = title.trim();
  const trimmedTagline = tagline.trim();
  const trimmedDescription = description.trim();

  const valid = useMemo(
    () =>
      trimmedTitle.length > 0 &&
      trimmedTitle.length <= TITLE_MAX &&
      trimmedTagline.length > 0 &&
      trimmedTagline.length <= TAGLINE_MAX &&
      trimmedDescription.length > 0 &&
      trimmedDescription.length <= DESCRIPTION_MAX &&
      !!coverUrl &&
      !uploading &&
      !submitting,
    [trimmedTitle, trimmedTagline, trimmedDescription, coverUrl, uploading, submitting],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        message.error('Please pick an image file');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        message.error('Image too large (max 8MB)');
        return;
      }
      setCoverLocalLoading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const url = await onUploadCover(dataUrl);
        if (url) {
          setCoverUrl(url);
        } else {
          message.error('Cover upload failed. Please try again.');
        }
      } finally {
        setCoverLocalLoading(false);
      }
    },
    [onUploadCover],
  );

  const handleSubmit = () => {
    if (!valid) return;
    onSubmit({
      title: trimmedTitle,
      tagline: trimmedTagline,
      description: trimmedDescription,
      coverImage: coverUrl || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      title="Mint Memory NFT"
      okText={
        submitting
          ? 'Minting…'
          : `Mint NFT${mintFeeLabel ? ` (${mintFeeLabel})` : ''}`
      }
      okButtonProps={{ disabled: !valid }}
      cancelText="Cancel"
      width={780}
      destroyOnHidden
    >
      <div
        style={{
          padding: '10px 12px',
          marginBottom: 12,
          borderRadius: 8,
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          color: '#fcd34d',
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        <strong>Heads up:</strong> Minting freezes this bucket permanently. You won't be able
        to add or remove contexts. If you ever sell the NFT, the buyer becomes the sole reader
        — you will lose access to its contents.
      </div>
      <Layout>
        <FormCol>
          <Field>
            <Label>
              Cover image<Required>*</Required>
            </Label>
            <CoverDrop
              $hasImage={!!coverUrl}
              onClick={() => fileInputRef.current?.click()}
            >
              {coverUrl && <CoverImage src={coverUrl} alt="cover" />}
              {(coverLocalLoading || uploading) && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'rgba(0,0,0,0.45)',
                  }}
                >
                  <Spin />
                </div>
              )}
              {!coverUrl && !coverLocalLoading && !uploading && (
                <CoverPlaceholder>
                  <MdCloudUpload size={28} />
                  <div>Click to upload</div>
                  <HintText>JPG / PNG · square recommended</HintText>
                </CoverPlaceholder>
              )}
              <HiddenFile
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </CoverDrop>
          </Field>

          <Field>
            <Label>
              Title<Required>*</Required>
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="e.g. Crypto Research — Vol. I"
            />
            <Counter>{trimmedTitle.length}/{TITLE_MAX}</Counter>
          </Field>

          <Field>
            <Label>
              Tagline<Required>*</Required>
            </Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={TAGLINE_MAX}
              placeholder="One line that sells this memory"
            />
            <Counter>{trimmedTagline.length}/{TAGLINE_MAX}</Counter>
          </Field>

          <Field>
            <Label>
              Description<Required>*</Required>
            </Label>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX}
              placeholder="Tell the story behind this bucket — why it exists, what's inside, who it's for."
              rows={4}
              style={{ resize: 'none' }}
            />
            <Counter>{trimmedDescription.length}/{DESCRIPTION_MAX}</Counter>
          </Field>
        </FormCol>

        <PreviewCol>
          <PreviewLabel>Live preview</PreviewLabel>
          <PreviewCard>
            <PreviewCover $url={coverUrl || undefined}>
              {!coverUrl && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  <MdImage size={36} />
                </div>
              )}
            </PreviewCover>
            <PreviewBody>
              <PreviewTitle>{trimmedTitle || 'Untitled NFT'}</PreviewTitle>
              <PreviewTagline>{trimmedTagline || 'Your tagline appears here.'}</PreviewTagline>
              <PreviewFooter>
                <MdToken size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Memory NFT
              </PreviewFooter>
            </PreviewBody>
          </PreviewCard>
          <HintText>This is roughly how your card appears on Browse.</HintText>
        </PreviewCol>
      </Layout>
    </Modal>
  );
};

export default MintNftDialog;
