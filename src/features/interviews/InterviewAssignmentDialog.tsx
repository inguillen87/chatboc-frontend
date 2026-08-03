import { useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  assignInterviewSessionV2,
  createInterviewAssignmentIdempotencyKey,
  getInterviewAssignmentCandidatesV2,
} from './interviewAssignmentApi';
import type {
  InterviewAssignmentCandidatesEnvelope,
  InterviewAssignmentDialogPresentation,
  InterviewAssignmentReasonCode,
  InterviewInboxItem,
} from './interviewsTypes';

type CandidateState =
  | { status: 'idle' | 'loading' | 'error'; data: null }
  | { status: 'ready'; data: InterviewAssignmentCandidatesEnvelope };

interface PendingAttempt {
  scope: string;
  idempotencyKey: string;
}

interface InterviewAssignmentDialogProps {
  tenantId: number;
  tenantSlug: string;
  item: InterviewInboxItem;
  presentation: InterviewAssignmentDialogPresentation;
  onAssigned?: () => void | Promise<unknown>;
}

export default function InterviewAssignmentDialog({
  tenantId,
  tenantSlug,
  item,
  presentation,
  onAssigned,
}: InterviewAssignmentDialogProps) {
  const action = item.actions.assign;
  const assignment = item.assignment;
  const [open, setOpen] = useState(false);
  const [candidateState, setCandidateState] = useState<CandidateState>({
    status: 'idle',
    data: null,
  });
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedReason, setSelectedReason] = useState<
    InterviewAssignmentReasonCode | ''
  >('');
  const [attempt, setAttempt] = useState<PendingAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const loadingCandidatesRef = useRef(false);
  const submittingRef = useRef(false);

  if (
    !assignment.managed_assignment_available ||
    !action.enabled ||
    action.method !== 'POST' ||
    !action.endpoint ||
    !action.candidates
  ) {
    return null;
  }
  if (acknowledged) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        {action.label}
      </Button>
    );
  }
  const mutationSource = { method: 'POST' as const, endpoint: action.endpoint };

  const loadCandidates = async () => {
    if (loadingCandidatesRef.current) return;
    loadingCandidatesRef.current = true;
    setCandidateState({ status: 'loading', data: null });
    try {
      const data = await getInterviewAssignmentCandidatesV2(
        tenantSlug,
        tenantId,
        action.candidates,
      );
      setCandidateState({ status: 'ready', data });
    } catch {
      setCandidateState({ status: 'error', data: null });
    } finally {
      loadingCandidatesRef.current = false;
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && submittingRef.current) return;
    setOpen(nextOpen);
    if (nextOpen && candidateState.status === 'idle') {
      void loadCandidates();
    }
  };

  const invalidateAttempt = () => {
    setAttempt(null);
    setSubmitFailed(false);
  };

  const submit = async () => {
    if (
      submittingRef.current ||
      !selectedAssignee ||
      !selectedReason ||
      candidateState.status !== 'ready'
    ) {
      return;
    }
    const assigneeUserId = Number(selectedAssignee);
    const candidateIsAuthorized = candidateState.data.assignment_candidates.candidates.some(
      (candidate) =>
        candidate.user_id === assigneeUserId &&
        candidate.can_conduct &&
        !(
          assignment.version > 0 &&
          candidate.user_id === assignment.interviewer_user_id
        ),
    );
    const reasonIsAdvertised = presentation.reasons.some(
      (reason) => reason.reason_code === selectedReason,
    );
    if (!Number.isSafeInteger(assigneeUserId) || !candidateIsAuthorized || !reasonIsAdvertised) {
      setSubmitFailed(true);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitFailed(false);
    let mutationAcknowledged = false;
    try {
      const scope = [
        item.session.id,
        assignment.version,
        assigneeUserId,
        selectedReason,
      ].join(':');
      let stableAttempt = attempt;
      if (!stableAttempt || stableAttempt.scope !== scope) {
        stableAttempt = {
          scope,
          idempotencyKey: createInterviewAssignmentIdempotencyKey(),
        };
        setAttempt(stableAttempt);
      }
      await assignInterviewSessionV2(
        {
          tenantId,
          tenantSlug,
          sessionId: item.session.id,
          currentAssignmentId: assignment.assignment_id,
          currentAssigneeUserId: assignment.interviewer_user_id,
        },
        mutationSource,
        {
          assignee_user_id: assigneeUserId,
          reason_code: selectedReason,
          expected_assignment_version: assignment.version,
        },
        stableAttempt.idempotencyKey,
      );
      mutationAcknowledged = true;
      setAcknowledged(true);
      setAttempt(null);
      setOpen(false);
      setSelectedAssignee('');
      setSelectedReason('');
      setSubmitFailed(false);
      try {
        await onAssigned?.();
      } catch {
        // The mutation already has a durable ACK. A failed refresh must never
        // turn into a second assignment POST.
      }
    } catch {
      if (mutationAcknowledged) {
        setOpen(false);
      } else {
        setSubmitFailed(true);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const candidates =
    candidateState.status === 'ready'
      ? candidateState.data.assignment_candidates
      : null;
  const assigneeSelectId = `interview-assignee-${item.session.id}`;
  const reasonSelectId = `interview-assignment-reason-${item.session.id}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          {action.label}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle>{presentation.title}</DialogTitle>
          <DialogDescription>{presentation.description}</DialogDescription>
        </DialogHeader>

        {candidateState.status === 'loading' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            {presentation.loading_candidates_label}
          </div>
        ) : null}

        {candidateState.status === 'error' ? (
          <div className="space-y-3" role="alert">
            <div className="flex gap-2 text-sm text-destructive">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{presentation.candidates_error_label}</span>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadCandidates()}>
              {presentation.retry_label}
            </Button>
          </div>
        ) : null}

        {candidates?.candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-3" role="status">
            <p className="font-medium">{candidates.presentation.empty_title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {candidates.presentation.empty_description}
            </p>
          </div>
        ) : null}

        {candidates && candidates.candidates.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={assigneeSelectId}>{presentation.assignee_label}</Label>
              <select
                id={assigneeSelectId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedAssignee}
                disabled={submitting}
                onChange={(event) => {
                  setSelectedAssignee(event.target.value);
                  invalidateAttempt();
                }}
              >
                <option value="">{presentation.assignee_placeholder}</option>
                {candidates.candidates.map((candidate) => (
                  <option
                    key={candidate.user_id}
                    value={candidate.user_id}
                    disabled={
                      assignment.version > 0 &&
                      candidate.user_id === assignment.interviewer_user_id
                    }
                  >
                    {candidate.display_name} · {candidate.role_label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={reasonSelectId}>{presentation.reason_label}</Label>
              <select
                id={reasonSelectId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedReason}
                disabled={submitting}
                onChange={(event) => {
                  setSelectedReason(
                    event.target.value as InterviewAssignmentReasonCode | '',
                  );
                  invalidateAttempt();
                }}
              >
                <option value="">{presentation.reason_label}</option>
                {presentation.reasons.map((reason) => (
                  <option key={reason.reason_code} value={reason.reason_code}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        {submitFailed ? (
          <div className="flex gap-2 text-sm text-destructive" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{presentation.submit_error_label}</span>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            {presentation.cancel_label}
          </Button>
          <Button
            type="button"
            disabled={
              submitting ||
              candidateState.status !== 'ready' ||
              !selectedAssignee ||
              !selectedReason
            }
            onClick={() => void submit()}
          >
            {submitting ? (
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {submitFailed && attempt
              ? presentation.retry_label
              : presentation.submit_label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
