import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface ModerationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
  type: 'report' | 'moderate';
}

const ModerationDialog: React.FC<ModerationDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  type
}) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(reason, details);
    onClose();
  };

  const reportReasons = [
    'spam',
    'harassment',
    'inappropriate',
    'other'
  ];

  const moderationReasons = [
    'spam',
    'harassment',
    'inappropriate_content',
    'hate_speech',
    'misinformation',
    'other'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type === 'report' ? 'Report Message' : 'Moderate Message'}
          </DialogTitle>
          <DialogDescription>
            {type === 'report'
              ? 'Report this message to the room moderators.'
              : 'Take moderation action on this message.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason</label>
            <Select
              value={reason}
              onValueChange={setReason}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {(type === 'report' ? reportReasons : moderationReasons).map((r) => (
                  <SelectItem key={r} value={r}>
                    {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Details</label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={type === 'report'
                ? 'Provide any additional context about why you are reporting this message...'
                : 'Add any notes about this moderation action...'
              }
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={type === 'report' ? 'default' : 'destructive'}
              disabled={!reason}
            >
              {type === 'report' ? 'Submit Report' : 'Moderate Message'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModerationDialog;