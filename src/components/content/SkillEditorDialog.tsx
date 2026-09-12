import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Modal, Input, Button, message } from 'antd';
import { MdAutoAwesome } from 'react-icons/md';
import { saveSkill, type SkillRecord } from '../../services/bucketApi';
import { SKILL_TEMPLATE, SKILL_LIMITS } from './skillTemplate';

interface SkillEditorDialogProps {
  open: boolean;
  bucketId: string | null;
  /** Existing custom skill to edit. Null/undefined (or a default-skill record)
   *  opens the editor in "new skill" mode, prefilled with the template. */
  initial?: SkillRecord | null;
  onClose: () => void;
  /** Fires after a successful save so the parent can refetch. */
  onSaved?: (record: SkillRecord) => void;
}

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Help = styled.div`
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: rgba(255, 255, 255, 0.75);
  font-size: 12px;
  line-height: 1.5;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
`;

const Required = styled.span`
  color: #f87171;
  margin-left: 2px;
`;

const Counter = styled.span<{ $over?: boolean }>`
  font-size: 11px;
  color: ${({ $over }) => ($over ? '#f87171' : 'rgba(255, 255, 255, 0.4)')};
  align-self: flex-end;
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
`;

interface SkillEditorFormProps {
  bucketId: string;
  initial?: SkillRecord | null;
  onClose: () => void;
  onSaved?: (record: SkillRecord) => void;
}

// The form lives in its own component so the Modal's `destroyOnHidden`
// remounts it on every open: fields seed from `initial` (or the template)
// via plain useState initialisers, no effect needed.
const SkillEditorForm = ({ bucketId, initial, onClose, onSaved }: SkillEditorFormProps) => {
  const editing = !!initial?.hasSkill;
  const [name, setName] = useState(editing ? initial!.name : '');
  const [summary, setSummary] = useState(editing ? initial!.summary || '' : '');
  const [instructions, setInstructions] = useState(editing ? initial!.instructions : SKILL_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const trimmedName = name.trim();
  const trimmedSummary = summary.trim();
  const trimmedInstructions = instructions.trim();

  const valid = useMemo(
    () =>
      trimmedName.length > 0 &&
      trimmedName.length <= SKILL_LIMITS.name &&
      trimmedSummary.length <= SKILL_LIMITS.summary &&
      trimmedInstructions.length > 0 &&
      trimmedInstructions.length <= SKILL_LIMITS.instructions &&
      !saving,
    [trimmedName, trimmedSummary, trimmedInstructions, saving],
  );

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const record = await saveSkill(bucketId, {
        name: trimmedName,
        summary: trimmedSummary,
        instructions: trimmedInstructions,
      });
      message.success('Skill saved');
      onSaved?.(record);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      message.error(err instanceof Error ? err.message : 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form>
      <Help>
        Write the playbook an AI should follow when using this bucket. The template sections are
        suggestions; edit or delete them.
      </Help>

      <Field>
        <Label>
          Name<Required>*</Required>
        </Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={SKILL_LIMITS.name}
          placeholder="e.g. Contract review assistant"
        />
        <Counter $over={trimmedName.length > SKILL_LIMITS.name}>
          {trimmedName.length}/{SKILL_LIMITS.name}
        </Counter>
      </Field>

      <Field>
        <Label>
          Summary <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
        </Label>
        <Input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={SKILL_LIMITS.summary}
          placeholder="One sentence a buyer sees on the card"
        />
        <Counter $over={trimmedSummary.length > SKILL_LIMITS.summary}>
          {trimmedSummary.length}/{SKILL_LIMITS.summary}
        </Counter>
      </Field>

      <Field>
        <Label>
          Instructions<Required>*</Required>
        </Label>
        <Input.TextArea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={SKILL_LIMITS.instructions}
          rows={18}
          spellCheck={false}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        />
        <Counter $over={trimmedInstructions.length > SKILL_LIMITS.instructions}>
          {trimmedInstructions.length}/{SKILL_LIMITS.instructions}
        </Counter>
      </Field>

      <Actions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="primary" onClick={handleSave} disabled={!valid} loading={saving}>
          {saving ? 'Saving…' : 'Save skill'}
        </Button>
      </Actions>
    </Form>
  );
};

const SkillEditorDialog = ({ open, bucketId, initial, onClose, onSaved }: SkillEditorDialogProps) => {
  const editing = !!initial?.hasSkill;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <MdAutoAwesome size={18} />
          {editing ? 'Edit skill' : 'Add skill'}
        </span>
      }
      footer={null}
      width={720}
      destroyOnHidden
    >
      {bucketId && (
        <SkillEditorForm bucketId={bucketId} initial={initial} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  );
};

export default SkillEditorDialog;
