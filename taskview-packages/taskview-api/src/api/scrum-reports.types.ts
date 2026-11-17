export type ScrumReportItem = {
  id: number
  issueKey: string
  description: string
  type: 'story' | 'task' | 'bug'
  complete: boolean | null
  priorityId: number | null
  statusId: number | null
  sprintId: number | null
  ownerId: number | null
  createdAt: string | null
  completedAt: string | null
  relatedTaskId: number | null
  sprintName: string | null
  ownerLogin: string | null
  statusName: string | null
}

export type ScrumReportFilters = {
  goalId: number
  sprintId?: number
  ownerId?: number
  type?: 'story' | 'task' | 'bug'
  statusId?: number
  priorityId?: number
  from?: string
  to?: string
  page?: number
  limit?: number
}

export type ScrumReportsOverview = {
  filters: ScrumReportFilters
  items: ScrumReportItem[]
  sprints: Array<{ id: number; name: string; startDate: string; endDate: string; status: string; committed: number; completed: number; accepted: number; pending: number; carried_over: number; progressPercent: number }>
  assignees: Array<{ ownerId: number; ownerLogin: string; stories: number; tasks: number; bugs: number; pending: number; completed: number }>
  qa: { pending: number; approved: number; observed: number; bugs: number; reviewed: number }
  bugs: ScrumReportItem[]
  retrospectives: Array<{ sprintId: number; total: number; done: number }>
}
