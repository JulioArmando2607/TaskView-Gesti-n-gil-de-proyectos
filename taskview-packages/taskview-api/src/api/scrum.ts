import TvApiBase from './base';
import type { AppResponse } from './base.types';
import type { QaObservation, QaReview, QaReviewStatus, ScrumEpic, ScrumItem, ScrumItemCreate, ScrumItemUpdate, ScrumWorkType, SprintReviewAcceptanceStatus, SprintReviewSummary } from './scrum.types';

export default class TvScrumApi extends TvApiBase {
  protected moduleUrl = '/module/scrum';

  public listEpics(goalId: number) {
    return this.request(this.$axios.get<AppResponse<ScrumEpic[]>>(`${this.moduleUrl}/goals/${goalId}/epics`));
  }

  public getEpic(epicId: number) {
    return this.request(this.$axios.get<AppResponse<ScrumEpic>>(`${this.moduleUrl}/epics/${epicId}`));
  }

  public createEpic(goalId: number, body: { title: string; details?: string | null }) {
    return this.request(this.$axios.post<AppResponse<ScrumEpic>>(`${this.moduleUrl}/goals/${goalId}/epics`, body));
  }

  public updateEpic(epicId: number, body: { title?: string; details?: string | null }) {
    return this.request(this.$axios.patch<AppResponse<ScrumEpic>>(`${this.moduleUrl}/epics/${epicId}`, body));
  }

  public archiveEpic(epicId: number) {
    return this.request(this.$axios.delete<AppResponse<{ id: number; archived: boolean }>>(`${this.moduleUrl}/epics/${epicId}`));
  }

  public deleteEpic(epicId: number) {
    return this.request(this.$axios.delete<AppResponse<{ id: number; deleted: boolean }>>(`${this.moduleUrl}/epics/${epicId}/permanent`));
  }

  public listEpicStories(epicId: number) {
    return this.request(this.$axios.get<AppResponse<ScrumItem[]>>(`${this.moduleUrl}/epics/${epicId}/stories`));
  }

  public listItems(args: { goalId: number; type?: ScrumWorkType; epicId?: number | 'none'; parentId?: number | 'none'; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (args.type) params.set('type', args.type);
    if (args.epicId !== undefined) params.set('epicId', String(args.epicId));
    if (args.parentId !== undefined) params.set('parentId', String(args.parentId));
    if (args.limit !== undefined) params.set('limit', String(args.limit));
    if (args.offset !== undefined) params.set('offset', String(args.offset));
    const query = params.size ? `?${params}` : '';
    return this.request(this.$axios.get<AppResponse<ScrumItem[]>>(`${this.moduleUrl}/goals/${args.goalId}/items${query}`));
  }

  public getItem(taskId: number) {
    return this.request(this.$axios.get<AppResponse<ScrumItem>>(`${this.moduleUrl}/items/${taskId}`));
  }

  public createItem(goalId: number, body: ScrumItemCreate) {
    return this.request(this.$axios.post<AppResponse<ScrumItem>>(`${this.moduleUrl}/goals/${goalId}/items`, body));
  }

  public updateItem(taskId: number, body: ScrumItemUpdate) {
    return this.request(this.$axios.patch<AppResponse<ScrumItem>>(`${this.moduleUrl}/items/${taskId}`, body));
  }

  public listSubtasks(taskId: number) {
    return this.request(this.$axios.get<AppResponse<ScrumItem[]>>(`${this.moduleUrl}/items/${taskId}/subtasks`));
  }

  public listQaReviews(taskId: number) {
    return this.request(this.$axios.get<AppResponse<QaReview[]>>(`${this.moduleUrl}/items/${taskId}/qa`));
  }

  public createQaReview(taskId: number, body: { status: QaReviewStatus; evidence?: string | null }) {
    return this.request(this.$axios.post<AppResponse<QaReview>>(`${this.moduleUrl}/items/${taskId}/qa`, body));
  }

  public addQaObservation(taskId: number, body: { reviewId: number; note: string; bugTaskId?: number | null }) {
    return this.request(this.$axios.post<AppResponse<QaObservation>>(`${this.moduleUrl}/items/${taskId}/qa/observations`, body));
  }

  public getSprintReviewSummary(sprintId: number) {
    return this.request(this.$axios.get<AppResponse<SprintReviewSummary>>(`${this.moduleUrl}/sprints/${sprintId}/review-summary`));
  }

  public saveSprintReviewAcceptance(sprintId: number, taskId: number, body: { status: SprintReviewAcceptanceStatus; notes?: string | null }) {
    return this.request(this.$axios.put<AppResponse<unknown>>(`${this.moduleUrl}/sprints/${sprintId}/review-items/${taskId}`, body));
  }
}
