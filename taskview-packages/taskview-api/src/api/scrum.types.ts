export type ScrumWorkType = 'story' | 'task' | 'bug';

export type ScrumEpic = {
  id: number;
  goalId: number;
  issueKey: string;
  title: string;
  details: string | null;
  archived: boolean;
  creatorId: number | null;
  createdAt: string;
  editedAt: string;
};

/** Task-shaped row returned by the Scrum API. Historical task fields are kept snake_case. */
export type ScrumItem = {
  id: number;
  goal_id: number;
  description: string;
  note: string | null;
  work_item_type: ScrumWorkType;
  epic_id: number | null;
  acceptance_criteria: string | null;
  related_task_id: number | null;
  parent_id: number | null;
  priority_id: number | null;
  owner: number | null;
  sprint_id: number | null;
  status_id: number | null;
  kanban_order: number | null;
  issue_key: string;
  estimate_value?: number | string | null;
  [key: string]: unknown;
};

export type ScrumItemCreate = {
  type?: ScrumWorkType;
  description: string;
  note?: string | null;
  priorityId?: number | null;
  owner?: number | null;
  sprintId?: number | null;
  statusId?: number | null;
  estimateValue?: number | null;
  epicId?: number | null;
  acceptanceCriteria?: string | null;
  relatedTaskId?: number | null;
  parentId?: number | null;
};

export type ScrumItemUpdate = Partial<Omit<ScrumItemCreate, 'type' | 'parentId'>>;

export type QaReviewStatus = 'pending' | 'approved' | 'observed';
export type QaObservation = { id: number; goalId: number; taskId: number; reviewId: number; note: string; bugTaskId: number | null; createdBy: number | null; createdAt: string };
export type QaReview = { id: number; goalId: number; taskId: number; status: QaReviewStatus; evidence: string | null; validatedBy: number | null; validatedAt: string | null; createdAt: string; editedAt: string | null; observations: QaObservation[] };
export type SprintReviewAcceptanceStatus = 'accepted' | 'observed' | 'rejected';
export type SprintReviewSummaryItem = ScrumItem & { qaStatus: QaReviewStatus | null; qaValidatedAt: string | null; acceptanceStatus: SprintReviewAcceptanceStatus | null; reviewedAt: string | null; reviewedBy: number | null };
export type SprintReviewSummary = { sprintId: number; goalId: number; items: SprintReviewSummaryItem[]; openBugs: Array<{ id: number; issueKey: string; description: string; relatedTaskId: number; statusId: number | null }> };

