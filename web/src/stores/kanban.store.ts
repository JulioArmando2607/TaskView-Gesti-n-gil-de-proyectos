import { defineStore } from 'pinia'
import type { GoalItem, KanbanArgDeleteColumn, KanbanArgUpdateColumn, KanbanArgUpdateTasksOrder, KanbanColumnItem, KanbanFilters, TaskArgAdd, KanbanArgAddColumn } from 'taskview-api'
import { DEFAULT_ID } from '@/types/app.types'
import type { KanbanMoveStatusArgs, KanbanStoreState } from '@/types/kanban.types'
import { $tvApi } from '@/plugins/axios'
import { TaskItem } from '@/types/tasks.types'
import { hasActiveFilters } from '@/helpers/Helper'

export const useKanbanStore = defineStore('kanban', {
  state(): KanbanStoreState {
    return {
      tasksData: {},
      statuses: [],
      goalId: DEFAULT_ID,
      filters: {},
      queryVersion: 0,
    }
  },
  actions: {
    async fetchTasksForColumn(goalId: GoalItem['id'], columnId: KanbanColumnItem['id'] | null, cursor: string | number | null) {
      const queryVersion = this.queryVersion
      const result = await $tvApi.kanban.fetchTasksForColumn(goalId, columnId, cursor, this.filters).catch(console.error)

      // Ignore responses from a previous epic/filter selection or board reload.
      if (queryVersion !== this.queryVersion) return

      if (!result) {
        if (!this.tasksData[columnId ?? DEFAULT_ID]) {
          this.tasksData[columnId ?? DEFAULT_ID] = {
            tasks: [],
            nextCursor: null,
            columnVersion: null,
          }
        }
        return
      }

      if (!this.tasksData[columnId ?? DEFAULT_ID]) {
        this.tasksData[columnId ?? DEFAULT_ID] = {
          tasks: [],
          nextCursor: null,
          columnVersion: null,
        }
      }

      // if (cursor === null) {
      //   this.tasksData[columnId ?? DEFAULT_ID]!.tasks = result.tasks
      // } else {
      // A task can already be on the board when a real-time insert lands while the page is in flight
      this.tasksData[columnId ?? DEFAULT_ID]!.tasks.push(...result.tasks.filter((task) => !this.hasTask(task.id)))
      if (columnId === null) {
        const tasks = this.tasksData[columnId ?? DEFAULT_ID]!.tasks
        const byId = new Map(tasks.map(task => [task.id, task]))
        const children = new Map<number, typeof tasks>()
        const compareOrder = (a: typeof tasks[number], b: typeof tasks[number]) =>
          (a.taskOrder ?? Number.MAX_SAFE_INTEGER) - (b.taskOrder ?? Number.MAX_SAFE_INTEGER) || a.id - b.id
        for (const task of tasks) {
          if (task.parentId == null || !byId.has(task.parentId)) continue
          const siblings = children.get(task.parentId) ?? []
          siblings.push(task)
          children.set(task.parentId, siblings)
        }
        for (const siblings of children.values()) siblings.sort(compareOrder)
        const roots = tasks.filter(task => task.parentId == null || !byId.has(task.parentId)).sort(compareOrder)
        const ordered: typeof tasks = []
        const visited = new Set<number>()
        const appendTree = (task: typeof tasks[number]) => {
          if (visited.has(task.id)) return
          visited.add(task.id)
          ordered.push(task)
          for (const child of children.get(task.id) ?? []) appendTree(child)
        }
        for (const root of roots) appendTree(root)
        for (const task of tasks) appendTree(task)
        this.tasksData[columnId ?? DEFAULT_ID]!.tasks = ordered
      }
      // }
      this.tasksData[columnId ?? DEFAULT_ID]!.nextCursor = result.nextCursor
      this.tasksData[columnId ?? DEFAULT_ID]!.columnVersion = result.columnVersion
    },

    // async fetchTasksOrderForColumnAndCursor(goalId: GoalItem['id'], columnId: Task['statusId'], cursor: string | number | null) {
    //     const result = await $tvApi.kanban.getTasksOrderForColumnAndCursor(goalId, columnId, cursor).catch(console.error);
    //     if (!result) {
    //         return;
    //     }

    //     result.forEach((task) => {
    //         const localTask = this.tasksData[columnId ?? DEFAULT_ID]?.tasks.find((t) => t.id === task.id);
    //         if (!localTask) return;
    //         localTask.kanbanOrder = task.kanbanOrder;
    //     });
    // },

    async updateTasksOrderAndColumn(data: KanbanArgUpdateTasksOrder) {
      const result = await $tvApi.kanban.updateTasksOrderAndColumn(data).catch(console.error)

      if (!result) {
        return
      }

      result.tasks.forEach((task) => {
        const localTask = this.tasksData[data.columnId ?? DEFAULT_ID]?.tasks.find((t) => t.id === task.id)
        if (!localTask) return
        localTask.kanbanOrder = task.kanbanOrder
      })

      // if the column version is different, fetch the tasks again
      if (this.tasksData[data.columnId ?? DEFAULT_ID]!.columnVersion !== result.columnVersion) {
        this.tasksData[data.columnId ?? DEFAULT_ID]!.tasks = []
        this.tasksData[data.columnId ?? DEFAULT_ID]!.nextCursor = null
        this.tasksData[data.columnId ?? DEFAULT_ID]!.columnVersion = null
        await this.fetchTasksForColumn(this.goalId, data.columnId ?? null, null)
      }

      this.tasksData[data.columnId ?? DEFAULT_ID]!.columnVersion = result.columnVersion
    },

    async moveTaskToColumn(data: { taskId: number; goalId: number; columnId: number | null }): Promise<{ ok: boolean; error?: string }> {
      let result
      try {
        result = await $tvApi.kanban.updateTasksOrderAndColumn({
          taskId: data.taskId,
          goalId: data.goalId,
          columnId: data.columnId,
          prevTaskId: null,
          nextTaskId: null,
        })
      } catch (error) {
        const response = (error as { response?: { status?: number; statusText?: string; data?: unknown } })?.response
        const responseData = response?.data as { error?: string; message?: string } | string | undefined
        const message = typeof responseData === 'string'
          ? responseData
          : responseData?.message ?? responseData?.error
        return {
          ok: false,
          error: response
            ? `HTTP ${response.status ?? '—'}: ${message ?? response.statusText ?? 'Error del servidor'}`
            : error instanceof Error ? error.message : 'Error desconocido',
        }
      }

      if (!result) return { ok: false, error: 'El servidor no encontró la tarea o la columna del tablero.' }

      if (this.goalId === data.goalId && this.statuses.length > 0) {
        await this.reloadColumns()
      }

      return { ok: true }
    },

    async addTask(taskArg: TaskArgAdd) {
      const result = await $tvApi.tasks.createTask(taskArg).catch(console.error)

      if (!result) {
        return
      }

      // The real-time insert of this task may have landed before the response
      if (this.hasTask(result.id)) return
      this.tasksData[taskArg.statusId ?? DEFAULT_ID]?.tasks.unshift(result)
    },

    async fetchStatuses(goalId: GoalItem['id']) {
      const result = await $tvApi.kanban.fetchAllColumns(goalId)
      if (!result) {
        return
      }
      this.statuses = result
      this.statuses.unshift({
        id: DEFAULT_ID,
        name: 'msg.allTasks',
        goalId: this.goalId,
        viewOrder: 0,
      })
    },

    async addStatus(data: KanbanArgAddColumn) {
      const result = await $tvApi.kanban.addColumn(data)
      if (!result) {
        return
      }
      this.statuses.push(result)

      this.tasksData[result.id] = {
        tasks: [],
        nextCursor: null,
        columnVersion: null,
      }
    },

    async moveStatus(args: KanbanMoveStatusArgs): Promise<boolean> {
      const backlog = this.statuses.filter((stat) => stat.id === DEFAULT_ID)
      const columns = this.statuses.filter((stat) => stat.id !== DEFAULT_ID)
      const index = columns.findIndex((stat) => stat.id === args.statusId)
      const target = args.direction === 'left' ? index - 1 : index + 1
      if (index === -1 || target < 0 || target >= columns.length) return false

      const previous = [...this.statuses]
      const [moved] = columns.splice(index, 1)
      columns.splice(target, 0, moved)
      this.statuses = [...backlog, ...columns]

      try {
        const saved = await $tvApi.kanban.reorderColumns({
          goalId: this.goalId,
          statusIds: columns.map((stat) => stat.id),
        })
        this.statuses = [...backlog, ...saved]
        return true
      } catch {
        this.statuses = previous
        return false
      }
    },

    async updateStatus(data: KanbanArgUpdateColumn) {
      const result = await $tvApi.kanban.updateColumn(data)
      if (!result) {
        return
      }

      const index = this.statuses.findIndex((stat) => stat.id === data.id)

      if (index !== -1) {
        this.statuses[index] = { ...this.statuses[index], ...data }
      }
    },

    syncTask(task: TaskItem) {
      const targetColumnId = task.statusId ?? DEFAULT_ID

      for (const columnId of Object.keys(this.tasksData)) {
        const column = this.tasksData[Number(columnId)]
        if (!column) continue
        const index = column.tasks.findIndex((t) => t.id === task.id)
        if (index === -1) continue

        if (Number(columnId) === targetColumnId) {
          Object.assign(column.tasks[index], task)
        } else {
          column.tasks.splice(index, 1)
          const targetColumn = this.tasksData[targetColumnId]
          if (targetColumn) {
            targetColumn.tasks.unshift(task)
          }
        }
        return
      }
    },

    hasTask(taskId: number): boolean {
      return Object.values(this.tasksData).some((column) => column?.tasks.some((task) => task.id === taskId))
    },

    insertTask(task: TaskItem) {
      if (
        this.goalId !== task.goalId
        || (task.parentId && !this.filters.includeSubtasks)
        || hasActiveFilters({ ...this.filters, includeSubtasks: undefined })
      ) return
      const column = this.tasksData[task.statusId ?? DEFAULT_ID]
      if (!column || this.hasTask(task.id)) return
      column.tasks.unshift(task)
    },

    removeTask(taskId: number) {
      for (const columnId of Object.keys(this.tasksData)) {
        const column = this.tasksData[Number(columnId)]
        if (!column) continue
        const index = column.tasks.findIndex((t: { id: number }) => t.id === taskId)
        if (index !== -1) {
          column.tasks.splice(index, 1)
          return
        }
      }
    },

    setFilters(filters: KanbanFilters) {
      this.filters = filters
      this.queryVersion++
    },

    async reloadColumns() {
      this.queryVersion++
      this.tasksData = {}
      await Promise.all(this.statuses.map((status) =>
        this.fetchTasksForColumn(this.goalId, status.id === DEFAULT_ID ? null : status.id, null),
      ))
    },

    async deleteStatus(data: KanbanArgDeleteColumn) {
      const result = await $tvApi.kanban.deleteColumn(data)
      if (!result) {
        return
      }
      const index = this.statuses.findIndex((stat) => stat.id === data.id)

      if (index !== -1) {
        this.statuses.splice(index, 1)
      }

      this.tasksData[data.id]?.tasks.forEach((t) => {
        if (t.statusId === data.id) {
          t.statusId = null
        }
      })

      delete this.tasksData[data.id]
    },
  },
})
