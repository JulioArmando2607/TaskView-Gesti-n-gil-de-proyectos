import { Router } from 'express';
import type { Routable } from '../../types/routable.type';
import { IsLoggedIn } from '../auth/middlewares/is-logged-in';
import { ScrumController } from './ScrumController';
import { ScrumReportsController } from '../scrum-reports/ScrumReportsController';

/** Local Scrum API. Existing /module/tasks contracts remain unchanged. */
export default class ScrumRoutes implements Routable {
    private readonly router = Router();
    private readonly controller = new ScrumController();
    private readonly reportsController = new ScrumReportsController();

    constructor() {
        this.router.use(IsLoggedIn);
        this.router.get('/goals/:goalId/epics', this.controller.listEpics);
        this.router.post('/goals/:goalId/epics', this.controller.createEpic);
        this.router.get('/epics/:epicId', this.controller.getEpic);
        this.router.patch('/epics/:epicId', this.controller.updateEpic);
        this.router.delete('/epics/:epicId', this.controller.archiveEpic);
        this.router.delete('/epics/:epicId/permanent', this.controller.deleteEpic);
        this.router.get('/epics/:epicId/stories', this.controller.listEpicStories);
        this.router.get('/goals/:goalId/items', this.controller.listItems);
        this.router.get('/items/:taskId', this.controller.getItem);
        this.router.post('/goals/:goalId/items', this.controller.createItem);
        this.router.patch('/items/:taskId', this.controller.updateItem);
        this.router.get('/items/:taskId/subtasks', this.controller.listSubtasks);
        this.router.get('/items/:taskId/qa', this.controller.listQaReviews);
        this.router.post('/items/:taskId/qa', this.controller.createQaReview);
        this.router.post('/items/:taskId/qa/observations', this.controller.addQaObservation);
        this.router.get('/sprints/:sprintId/review-summary', this.controller.getSprintReviewSummary);
        this.router.put('/sprints/:sprintId/review-items/:taskId', this.controller.saveSprintReviewAcceptance);
        this.router.get('/reports/:goalId/overview', this.reportsController.overview);
        this.router.get('/reports/:goalId/export', this.reportsController.export);
    }

    getRouter() { return this.router; }
}
