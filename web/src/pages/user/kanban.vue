<template>
  <UDashboardPanel
    id="kanban"
    :ui="{ body: 'sm:p-4 sm:pb-0' }"
  >
    <template #header>
      <UDashboardNavbar
        :toggle="navbarToggle"
        v-bind="navbarAttrs"
        :title="`${projectName} - ${t('kanban.title')}`"
      >
        <template #leading>
          <TvCollapseSidebarDesktop />
        </template>
        <template #right>
          <div class="flex items-center gap-2 overflow-x-auto">
            <div
              v-if="showFilters"
              class="hidden lg:contents"
            >
              <TvKanbanFilters
                v-model:list-ids="selectedListIds"
                v-model:assignee-ids="selectedAssigneeIds"
                v-model:sprint-id="selectedSprintId"
                v-model:work-item-type="selectedWorkItemType"
                v-model:priority-id="selectedPriorityId"
                :goal-id="projectId"
                show-reset-label
              />
            </div>
            <UButton
              icon="i-lucide-filter"
              :color="showFilters ? 'primary' : 'neutral'"
              variant="soft"
              size="lg"
              class="shrink-0"
              :ui="{ leadingIcon: 'size-4' }"
              @click="showFilters = !showFilters"
            />
          </div>
        </template>
      </UDashboardNavbar>
      <div
        v-if="showFilters"
        class="lg:hidden overflow-x-auto border-b border-default px-3 py-2"
      >
        <div class="flex items-center gap-2 w-fit ml-auto">
          <TvKanbanFilters
            v-model:list-ids="selectedListIds"
            v-model:assignee-ids="selectedAssigneeIds"
            v-model:sprint-id="selectedSprintId"
            v-model:work-item-type="selectedWorkItemType"
            v-model:priority-id="selectedPriorityId"
            :goal-id="projectId"
          />
        </div>
      </div>
    </template>

    <template #body>
      <KanbanBoard />
    </template>
  </UDashboardPanel>
  <TvTaskDetailOverlay />
</template>

<script setup lang="ts">
import { useCurrentProjectColor } from '@/composables/useCurrentProjectColor'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import KanbanBoard from '@/components/features/kanban/KanbanBoard.vue'
import TvCollapseSidebarDesktop from '@/components/features/base/TvCollapseSidebarDesktop.vue'
import TvTaskDetailOverlay from '@/components/features/tasks/TvTaskDetailOverlay.vue'
import TvKanbanFilters from '@/components/features/base/TvKanbanFilters.vue'
import { useAppRouteInfo } from '@/composables/useAppRouteInfo'
import { useFiltersFromQuery } from '@/composables/useFiltersFromQuery'
import { useProjectDataLoader } from '@/composables/useProjectDataLoader'
import { useTaskView } from '@/composables/useTaskView'
import { useGoalsStore } from '@/stores/goals.store'
import { useKanbanStore } from '@/stores/kanban.store'

const { navbarToggle, navbarAttrs } = useCurrentProjectColor()

const { t } = useI18n()
const { projectId } = useAppRouteInfo()
const goalsStore = useGoalsStore()
const kanbanStore = useKanbanStore()
const projectName = computed(() => goalsStore.goalMap.get(projectId.value)?.name ?? '')

const { isDesktop } = useTaskView()
const { selectedListIds, selectedAssigneeIds, selectedSprintId, hasActiveFilters } = useFiltersFromQuery()
const selectedWorkItemType = ref('')
const selectedPriorityId = ref('')
const showFilters = ref(isDesktop.value || hasActiveFilters.value)

kanbanStore.setFilters({
  listIds: selectedListIds.value,
  assigneeIds: selectedAssigneeIds.value,
  sprintId: selectedSprintId.value ?? undefined,
  workItemTypes: selectedWorkItemType.value ? [selectedWorkItemType.value as 'task' | 'story' | 'bug'] : undefined,
  priorityIds: selectedPriorityId.value ? [Number(selectedPriorityId.value)] : undefined,
  includeSubtasks: kanbanStore.filters.includeSubtasks,
})

watch([selectedListIds, selectedAssigneeIds, selectedSprintId, selectedWorkItemType, selectedPriorityId], ([listIds, assigneeIds, sprintId, workItemType, priorityId]) => {
  kanbanStore.setFilters({
    listIds,
    assigneeIds,
    sprintId: sprintId ?? undefined,
    workItemTypes: workItemType ? [workItemType as 'task' | 'story' | 'bug'] : undefined,
    priorityIds: priorityId ? [Number(priorityId)] : undefined,
    includeSubtasks: kanbanStore.filters.includeSubtasks,
  })
  kanbanStore.reloadColumns()
}, { deep: true })

useProjectDataLoader(projectId)
</script>
