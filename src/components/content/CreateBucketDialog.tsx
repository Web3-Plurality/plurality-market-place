import { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Modal, Input, message } from 'antd';
import { MdInventory2 } from 'react-icons/md';
import { createBucket } from '../../services/bucketApi';

interface CreateBucketDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the freshly-created bucket id + name on success. */
  onCreated: (bucket: { id: string; profileName: string }) => void;
}

const NAME_MAX = 80;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 0.3px;
`;

const Counter = styled.span`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  align-self: flex-end;
`;

const Hint = styled.div`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
`;

const CreateBucketDialog = ({ open, onClose, onCreated }: CreateBucketDialogProps) => {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const valid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX && !submitting;

  const reset = useCallback(() => {
    setName('');
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!valid) return;
    setSubmitting(true);
    try {
      const bucket = await createBucket(trimmedName);
      message.success(`Created "${bucket.profileName}"`);
      onCreated({ id: bucket.id, profileName: bucket.profileName });
      reset();
      onClose();
    } catch (error) {
      console.error('Failed to create bucket:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create bucket';
      message.error(msg);
      setSubmitting(false);
    }
  }, [valid, trimmedName, onCreated, onClose, reset]);

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdInventory2 size={18} /> Create a Memory
        </span>
      }
      okText={submitting ? 'Creating…' : 'Create'}
      cancelText="Cancel"
      okButtonProps={{ disabled: !valid }}
      width={460}
      destroyOnHidden
    >
      <Wrap>
        <Hint>
          A memory holds the contexts you add (files, notes, chats). Inside it you can also
          attach an optional skill that tells an AI how to use them.
        </Hint>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            placeholder="e.g. Crypto Research, Travel Memories"
            autoFocus
            onPressEnter={handleSubmit}
          />
          <Counter>
            {trimmedName.length}/{NAME_MAX}
          </Counter>
        </div>
      </Wrap>
    </Modal>
  );
};

export default CreateBucketDialog;
