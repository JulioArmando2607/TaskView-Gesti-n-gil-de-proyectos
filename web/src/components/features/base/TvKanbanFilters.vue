<template>
  <TvKanbanSprintFilter
    v-model="sprintId"
    :goal-id="goalId"
  />
  <TvListFilter v-model="listIds" />
  <TvUserFilter v-model="assigneeIds" />
  <USelect
    v-model="workItemType"
    :items="workItemTypeOptions"
    value-key="value"
    class="min-w-32"
    placeholder="Tipo"
    aria-label="Filtrar por tipo"
    data-testid="kanban-type-filter"
  />
  <USelect
    v-model="epicId"
    :items="epicOptions"
    value-key="value"
    class="min-w-48 max-w-64"
    placeholder="Épica"
    aria-label="Filtrar por épica"
    data-testid="kanban-epic-filter"
  />
  <USelect
    v-model="priorityId"
    :items="priorityOptions"
    value-key="value"
    class="min-w-28"
    placeholder="Prioridad"
    aria-label="Filtrar por prioridad"
    data-testid="kanban-priority-filter"
  />
  <UButton
    v-if="hasActiveFilters"
    icon="i-lucide-x"
    :label="showResetLabel ? t('filters.reset') : undefined"
    class="shrink-0"
    :class="{ '[&>span:last-child]:hidden lg:[&>span:last-child]:inline': showResetLabel }"
    variant="soft"
    color="error"
    size="sm"
    @click="resetFilters"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import TvListFilter from './TvListFilter.vue'
import TvUserFilter from './TvUserFilter.vue'
import TvKanbanSprintFilter from './TvKanbanSprintFilter.vue'
import { $tvApi } from '@/plugins/axios'

const props = withDefaults(defineProps<{
  goalId: number
  showResetLabel?: boolean
}>(), {
  showResetLabel: false,
})

const listIds = defineModel<number[]>('listIds', { default: () => [] })
const assigneeIds = defineModel<number[]>('assigneeIds', { default: () => [] })
const sprintId = defineModel<number | null>('sprintId', { default: null })
const workItemType = defineModel<string>('workItemType', { default: '' })
const priorityId = defineModel<string>('priorityId', { default: '' })
const epicId = defineModel<string>('epicId', { default: '' })
const epics = ref<Awaited<ReturnType<typeof $tvApi.scrum.listEpics>>>([])
const epicOptions = computed(() => [
  { label: 'Todas las épicas', value: '' },
  { label: 'Sin épica', value: 'none' },
  ...epics.value.map(epic => ({ label: `${epic.issueKey} · ${epic.title}${epic.archived ? ' (Archivada)' : ''}`, value: String(epic.id) })),
])

watch(() => props.goalId, async (goalId) => {
  try {
    epics.value = await $tvApi.scrum.listEpics(goalId)
  } catch {
    epics.value = []
  }
}, { immediate: true })

const workItemTypeOptions = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Historias', value: 'story' },
  { label: 'Tareas', value: 'task' },
  { label: 'Bugs', value: 'bug' },
]
const priorityOptions = [
  { label: 'Todas las prioridades', value: '' },
  { label: 'Alta', value: '1' },
  { label: 'Media', value: '2' },
  { label: 'Baja', value: '3' },
]

const { t } = useI18n()

const hasActiveFilters = computed(
  () => listIds.value.length > 0 || assigneeIds.value.length > 0 || sprintId.value !== null || !!workItemType.value || !!priorityId.value || !!epicId.value,
)

const resetFilters = () => {
  listIds.value = []
  assigneeIds.value = []
  sprintId.value = null
  workItemType.value = ''
  priorityId.value = ''
  epicId.value = ''
}

defineExpose({ hasActiveFilters })
</script>
