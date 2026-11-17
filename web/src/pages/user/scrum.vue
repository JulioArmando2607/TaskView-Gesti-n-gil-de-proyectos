<template>
  <UDashboardPanel
    id="scrum"
    :ui="{ body: 'p-0 sm:p-4' }"
  >
    <template #header>
      <UDashboardNavbar
        :toggle="navbarToggle"
        v-bind="navbarAttrs"
        :title="`${projectName} · Scrum`"
      >
        <template #leading>
          <TvCollapseSidebarDesktop />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Buscar por título o clave"
              class="w-48 sm:w-64"
            />
            <UButton
              v-if="canCreate"
              data-testid="scrum-create-item"
              icon="i-lucide-plus"
              label="Crear"
              @click="openCreate()"
            />
          </div>
        </template>
      </UDashboardNavbar>
      <div class="flex gap-2 border-b border-default px-4 py-2 overflow-x-auto">
        <UButton
          v-for="tab in tabs"
          :key="tab.id"
          :label="tab.label"
          :icon="tab.icon"
          size="sm"
          :variant="view === tab.id ? 'soft' : 'ghost'"
          @click="view = tab.id"
        />
        <USelect
          v-if="view === 'board'"
          v-model="kanbanEpicFilter"
          data-testid="scrum-kanban-epic-filter"
          :items="kanbanEpicOptions"
          class="ml-auto min-w-48"
        />
        <USelect
          v-model="typeFilter"
          data-testid="scrum-type-filter"
          :items="typeOptions"
          :class="view === 'board' ? 'min-w-36' : 'ml-auto min-w-36'"
        />
      </div>
    </template>

    <template #body>
      <div class="p-3 sm:p-5 space-y-4 min-h-full">
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          title="No se pudo completar la operación"
          :description="error"
        />
        <div
          v-if="loading"
          class="py-16 text-center text-muted"
        >
          Cargando backlog…
        </div>
        <template v-else-if="view === 'backlog'">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              v-for="stat in summary"
              :key="stat.label"
              class="rounded-xl border border-default bg-elevated/50 p-3"
            >
              <div class="text-xs text-muted">
                {{ stat.label }}
              </div><div class="text-2xl font-semibold mt-1">
                {{ stat.value }}
              </div>
            </div>
          </div>
          <section
            v-for="epic in visibleEpics"
            :key="epic.id"
            class="rounded-xl border border-default overflow-hidden"
          >
            <header class="flex items-center gap-2 p-3 bg-elevated/60">
              <UButton
                :icon="expanded.has(epic.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="`Expandir ${epic.title}`"
                @click="toggleEpic(epic.id)"
              />
              <span class="font-mono text-xs text-primary">{{ epic.issueKey }}</span><UBadge
                color="primary"
                variant="soft"
                size="xs"
                title="Épica"
              >EP</UBadge><span class="font-medium truncate flex-1">{{ epic.title }}</span>
              <UBadge
                v-if="epic.archived"
                color="neutral"
                variant="subtle"
              >
                Archivada
              </UBadge><UBadge
                color="neutral"
                variant="subtle"
              >
                {{ epicItems(epic.id).filter(i => i.work_item_type === 'story').length }} historias · {{ epicItems(epic.id).filter(i => i.work_item_type === 'task').length }} tareas
              </UBadge>
              <UButton
                v-if="canEdit && !epic.archived"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Editar épica"
                @click="openEditEpic(epic)"
              />
              <UButton
                v-if="canEdit && !epic.archived"
                icon="i-lucide-archive"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Archivar épica"
                @click="archiveEpic(epic)"
              />
              <UButton
                v-if="canEdit"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Eliminar épica"
                @click="deleteEpic(epic)"
              />
              <UButton
                v-if="canCreate && !epic.archived"
                icon="i-lucide-plus"
                label="Historia"
                size="xs"
                variant="soft"
                @click="openCreate('story', epic.id)"
              />
            </header>
            <div
              v-if="expanded.has(epic.id)"
              class="divide-y divide-default"
            >
              <ItemRow
                v-for="epicItem in epicDisplayItems(epic.id)"
                :key="epicItem.id"
                :item="epicItem"
                :children="subtasks[epicItem.id] ?? []"
                :bugs="visibleRelatedBugs(epicItem.id)"
                :bugs-by-item="bugsByTarget"
                :subtasks-by-parent="subtasks"
                :can-edit="canEdit"
                :can-create="canCreate"
                :can-add-subtasks="canAddSubtasks"
                :can-delete="canDeleteTask"
                @edit="openEdit"
                @subtask="item => openCreate('task', undefined, item)"
                @delete="deleteItem"
              />
              <div
                v-if="!epicItems(epic.id).length"
                class="p-4 text-sm text-muted"
              >
                Sin historias asociadas.
              </div>
            </div>
          </section>
          <section class="rounded-xl border border-default overflow-hidden">
            <header class="p-3 bg-elevated/60 flex items-center justify-between">
              <span class="font-semibold">{{ typeFilter === 'all' ? 'Historias sin épica y elementos independientes' : `Elementos · ${typeLabel(typeFilter)}` }}</span><UButton
                v-if="canCreate"
                icon="i-lucide-plus"
                label="Agregar elemento"
                size="xs"
                variant="soft"
                @click="openCreateFiltered()"
              />
            </header>
            <div class="divide-y divide-default">
              <ItemRow
                v-for="backlogItem in unlinkedDisplayItems"
                :key="backlogItem.id"
                :item="backlogItem"
                :children="subtasks[backlogItem.id] ?? []"
                :bugs="visibleRelatedBugs(backlogItem.id)"
                :bugs-by-item="bugsByTarget"
                :subtasks-by-parent="subtasks"
                :can-edit="canEdit"
                :can-create="canCreate"
                :can-add-subtasks="canAddSubtasks"
                :can-delete="canDeleteTask"
                @edit="openEdit"
                @subtask="item => openCreate('task', undefined, item)"
                @delete="deleteItem"
              />
              <div
                v-if="filtered(unlinkedItems).length === 0"
                class="p-6 text-center text-sm text-muted"
              >
                No hay elementos que coincidan.
              </div>
            </div>
          </section>
          <div
            v-if="!itemsComplete"
            class="flex justify-center"
          >
            <UButton
              icon="i-lucide-chevrons-down"
              label="Cargar más elementos"
              variant="outline"
              :loading="loadingMore"
              @click="loadMoreItems"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="canCreate"
              data-testid="scrum-create-epic"
              icon="i-lucide-layers-3"
              label="Nueva épica"
              variant="outline"
              @click="openCreateEpic"
            />
            <UButton
              v-if="canCreate"
              icon="i-lucide-check-square"
              label="Tarea técnica"
              variant="outline"
              @click="openCreate('task')"
            />
            <UButton
              v-if="canCreate"
              icon="i-lucide-bug"
              label="Reportar bug"
              variant="outline"
              @click="openCreate('bug')"
            />
          </div>
        </template>

        <template v-else-if="view === 'planning'">
          <div class="flex flex-wrap items-end gap-3 rounded-xl border border-default p-4">
            <div class="min-w-56 flex-1">
              <label class="text-xs text-muted">Sprint</label><USelect
                v-model="selectedSprint"
                data-testid="scrum-sprint-select"
                :items="sprintOptions"
                class="mt-1"
              />
            </div>
            <div class="min-w-56 flex-1">
              <label class="text-xs text-muted">Épica</label><USelect
                v-model="planningEpicFilter"
                data-testid="scrum-planning-epic-filter"
                :items="planningEpicOptions"
                class="mt-1"
              />
            </div>
            <div class="text-sm text-muted pb-2">
              {{ selectedForSprint.length }} elementos · {{ sprintPoints }} puntos estimados
            </div>
            <UButton
              :disabled="!canAssign || selectedSprint === NONE_VALUE || !selectedForSprint.length"
              icon="i-lucide-rocket"
              label="Asignar selección"
              @click="assignSprint"
            />
          </div>
          <p
            v-if="selectedSprintData?.capacity != null"
            class="text-sm text-muted"
          >
            Capacidad registrada: {{ selectedSprintData.capacity }} · En selección: {{ sprintPoints }}. La suma de carga total se muestra en la vista de planificación del sprint.
          </p>
          <div class="rounded-xl border border-default divide-y divide-default">
            <label
              v-for="plannedItem in filteredPlanningItems"
              :key="plannedItem.id"
              class="flex items-center gap-3 p-3 hover:bg-elevated/50"
              :class="plannedItem.parent_id != null ? 'border-l-2 border-primary/40 pl-6' : ''"
            >
              <UCheckbox
                :model-value="selectedIds.includes(plannedItem.id)"
                @update:model-value="toggleSelected(plannedItem.id, $event)"
              />
              <span class="font-mono text-xs text-muted">{{ plannedItem.issue_key }}</span><UBadge
                :color="typeColor(plannedItem.work_item_type)"
                variant="subtle"
                size="xs"
                :title="plannedItem.parent_id != null ? 'Subtarea' : typeLabel(plannedItem.work_item_type)"
              >{{ workTypeCode(plannedItem.work_item_type, plannedItem.parent_id != null) }}</UBadge><span class="flex-1 truncate">{{ plannedItem.description }}</span>
              <UBadge
                v-if="epicForItem(plannedItem)"
                color="primary"
                variant="subtle"
                size="xs"
                class="max-w-56 truncate"
                :title="`Épica: ${epicForItem(plannedItem)?.issueKey} · ${epicForItem(plannedItem)?.title}`"
              >{{ epicForItem(plannedItem)?.issueKey }} · {{ epicForItem(plannedItem)?.title }}</UBadge>
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                size="xs"
              >Sin épica</UBadge>
              <UBadge
                v-if="plannedItem.parent_id != null"
                color="neutral"
                variant="subtle"
              >Subtarea</UBadge>
              <span class="text-xs text-muted">{{ plannedItem.sprint_id ? `Sprint ${plannedItem.sprint_id}` : 'Backlog' }}</span>
            </label>
            <div
              v-if="!filteredPlanningItems.length"
              class="p-6 text-center text-sm text-muted"
            >
              No hay elementos para planificar.
            </div>
          </div>
        </template>
        <template v-else>
          <KanbanBoard class="h-[calc(100vh-13rem)]" />
          <div class="rounded-xl border border-default p-6 flex flex-col items-center gap-3 text-center">
            <p class="text-sm text-muted">
              Este tablero usa las columnas y movimientos persistentes del Kanban original.
            </p>
            <UButton
              icon="i-lucide-arrow-up-right"
              label="Abrir vista Kanban completa"
              :to="{ name: 'kanban', params: { projectId } }"
              :disabled="!canViewKanban"
            />
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="column in statuses"
              :key="column.id"
              color="neutral"
              variant="subtle"
            >
              {{ column.name }}
            </UBadge>
          </div>
        </template>
      </div>
    </template>
  </UDashboardPanel>
  <TvTaskDetailOverlay />

  <UModal
    v-model:open="modalOpen"
    :title="modalTitle"
    :description="modalDescription"
  >
    <template #body>
      <form
        class="space-y-3"
        @submit.prevent="save"
      >
        <UFormField
          v-if="formMode === 'create-item'"
          label="Tipo"
        >
          <USelect
            v-model="form.type"
            :items="typeOptions.filter(x => x.value !== 'all')"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Título">
          <UInput
            v-model="form.description"
            data-testid="scrum-title"
            required
            maxlength="500"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Descripción detallada">
          <UTextarea
            v-model="form.note"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <template v-if="formMode !== 'epic'">
          <UFormField label="Criterios de aceptación">
            <UTextarea
              v-model="form.acceptanceCriteria"
              :rows="3"
              placeholder="Texto libre"
              class="w-full"
            />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-3">
            <UFormField label="Prioridad">
              <USelect
                v-model="form.priorityId"
                :items="priorityOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Estado">
              <USelect
                v-model="form.statusId"
                :items="statusOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="form.type === 'story' || form.type === 'task'"
              label="Épica"
            >
              <USelect
                v-model="form.epicId"
                :items="epicOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="form.type === 'bug'"
              label="Elemento afectado"
            >
              <USelect
                v-model="form.relatedTaskId"
                :items="affectedOptions"
                class="w-full"
              />
            </UFormField>
            <UFormField
              v-if="canAssignUsers"
              label="Responsable"
            >
              <USelect
                v-model="form.owner"
                :items="ownerOptions"
                :disabled="!canAssignUsers"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Estimación">
              <UInput
                v-model="form.estimateValue"
                type="number"
                min="0"
                step="0.5"
                class="w-full"
              />
            </UFormField>
          </div>
          <div
            v-if="formMode === 'create-item' && parentItem"
            class="text-xs text-muted"
          >
            Subtarea de {{ parentItem.issue_key }} · {{ parentItem.description }}
          </div>
        </template>
        <section
          v-if="formMode === 'edit-item' && currentItem"
          class="rounded-lg border border-default p-3 space-y-3"
          data-testid="scrum-qa-panel"
        >
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="font-medium">
                QA funcional
              </div><div class="text-xs text-muted">
                Validación independiente del estado de desarrollo.
              </div>
            </div>
            <UBadge
              v-if="latestQa"
              :color="latestQa.status === 'approved' ? 'success' : latestQa.status === 'observed' ? 'error' : 'neutral'"
              variant="subtle"
            >
              {{ latestQaStatus }}
            </UBadge>
          </div>
          <UTextarea
            v-model="qaEvidence"
            :rows="2"
            placeholder="Evidencia de validación"
          />
          <UTextarea
            v-model="qaObservation"
            :rows="2"
            placeholder="Observación QA (opcional)"
          />
          <USelect
            v-model="qaBugId"
            :items="qaBugOptions"
            class="w-full"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Enviar a QA"
              color="neutral"
              variant="outline"
              :loading="qaSaving"
              :disabled="!canEdit || qaSaving"
              @click="saveQa('pending')"
            />
            <UButton
              label="Registrar observación"
              color="error"
              variant="soft"
              :loading="qaSaving"
              :disabled="!canEdit || qaSaving || !qaObservation.trim()"
              @click="saveQa('observed')"
            />
            <UButton
              label="Aprobar QA"
              color="success"
              :loading="qaSaving"
              :disabled="!canEdit || qaSaving"
              @click="saveQa('approved')"
            />
          </div>
          <ul
            v-if="latestQa?.observations?.length"
            class="space-y-1 text-xs text-muted"
          >
            <li
              v-for="observation in latestQa.observations"
              :key="observation.id"
            >
              • {{ observation.note }}<span v-if="observation.bugTaskId"> · bug #{{ observation.bugTaskId }}</span>
            </li>
          </ul>
        </section>
        <div class="flex justify-between gap-2 pt-2">
          <UButton
            v-if="formMode === 'edit-item' && currentItem"
            color="neutral"
            variant="ghost"
            label="Ver tarea completa"
            icon="i-lucide-history"
            @click="openLegacyDetail"
          /><span v-else /><div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Cancelar"
              :disabled="saving"
              @click="closeModal"
            /><UButton
              type="submit"
              :loading="saving"
              :disabled="!canSave || saving"
              label="Guardar"
            />
          </div>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { QaReview, QaReviewStatus, ScrumEpic, ScrumItem, ScrumWorkType } from 'taskview-api'
import { $tvApi } from '@/plugins/axios'
import { useGoalsStore } from '@/stores/goals.store'
import { useGoalPermissionsFor } from '@/composables/useGoalPermissions'
import { useCurrentProjectColor } from '@/composables/useCurrentProjectColor'
import TvCollapseSidebarDesktop from '@/components/features/base/TvCollapseSidebarDesktop.vue'
import KanbanBoard from '@/components/features/kanban/KanbanBoard.vue'
import TvTaskDetailOverlay from '@/components/features/tasks/TvTaskDetailOverlay.vue'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useKanbanStore } from '@/stores/kanban.store'
import { useTaskDetailPanel } from '@/composables/useTaskDetailPanel'

function workTypeCode(type: string, isSubtask = false) {
  if (isSubtask) return 'ST'
  return ({ story: 'HI', task: 'TR', bug: 'BG' } as Record<string, string>)[type] ?? '??'
}

const ItemRow = defineComponent({
  props: { item: { type: Object as () => ScrumItem, required: true }, children: { type: Array as () => ScrumItem[], default: () => [] }, bugs: { type: Array as () => ScrumItem[], default: () => [] }, bugsByItem: { type: Object as () => Record<number, ScrumItem[]>, default: () => ({}) }, subtasksByParent: { type: Object as () => Record<number, ScrumItem[]>, default: () => ({}) }, canEdit: Boolean, canCreate: Boolean, canAddSubtasks: Boolean, canDelete: Boolean },
  emits: ['edit', 'subtask', 'delete'],
  setup(props, { emit }) {
    return () => h('div', { class: 'border-t border-default/60' }, [
      h('div', { class: 'flex items-center gap-2 px-3 py-2.5 pl-8 hover:bg-elevated/40' }, [
        h('span', { class: 'font-mono text-xs text-muted shrink-0' }, props.item.issue_key),
        h('span', { class: `font-mono text-[10px] uppercase shrink-0 ${props.item.work_item_type === 'bug' ? 'text-error' : 'text-muted'}`, title: typeLabel(props.item.work_item_type) }, workTypeCode(props.item.work_item_type)),
        h('span', { class: 'truncate flex-1 cursor-pointer', 'data-item-id': props.item.id, onClick: () => emit('edit', props.item) }, props.item.description),
        h('span', { class: 'text-xs text-muted hidden sm:block' }, props.item.sprint_id ? `Sprint ${props.item.sprint_id}` : ''),
        h('span', { class: 'text-xs text-muted' }, props.item.priority_id ? `P${props.item.priority_id}` : ''),
        h('button', { class: 'text-xs text-primary hover:underline', onClick: () => emit('edit', props.item) }, 'Detalle'),
        props.canDelete ? h('button', { class: 'text-xs text-error hover:underline', 'aria-label': `Eliminar ${props.item.issue_key}`, onClick: () => emit('delete', props.item, props.children.length) }, 'Eliminar') : null,
        props.canCreate && props.canAddSubtasks && props.item.parent_id == null ? h('button', { class: 'text-xs text-muted hover:text-primary', 'data-testid': `scrum-add-subtask-${props.item.id}`, onClick: () => emit('subtask', props.item) }, '＋ subtarea') : null,
      ]),
      ...props.children.map(child => h('div', {}, [
        h('div', { class: 'flex items-center gap-2 pl-16 pr-3 py-2 text-sm bg-elevated/20' }, [
          h('span', { class: 'text-muted' }, '↳'),
          h('span', { class: 'font-mono text-xs text-muted' }, child.issue_key),
          h('span', { class: 'font-mono text-[10px] uppercase text-muted shrink-0', title: 'Subtarea' }, 'ST'),
          h('button', { class: 'truncate flex-1 text-left hover:text-primary', onClick: () => emit('edit', child) }, child.description),
          props.canCreate && props.canAddSubtasks && props.item.work_item_type === 'story' && child.work_item_type === 'task' ? h('button', { class: 'text-xs text-muted hover:text-primary', 'data-testid': `scrum-add-nested-subtask-${child.id}`, onClick: () => emit('subtask', child) }, '＋ subtarea') : null,
          props.canDelete ? h('button', { class: 'text-xs text-error hover:underline', 'aria-label': `Eliminar ${child.issue_key}`, onClick: () => emit('delete', child, 0) }, 'Eliminar') : null,
        ]),
        ...((props.bugsByItem[child.id] ?? []).map(bug => h('div', { class: 'flex items-center gap-2 pl-24 pr-3 py-2 text-sm bg-red-950/10' }, [
          h('span', { class: 'text-error' }, '↳'),
          h('span', { class: 'font-mono text-xs text-muted' }, bug.issue_key),
          h('span', { class: 'font-mono text-[10px] uppercase text-error', title: 'Bug' }, 'BG'),
          h('button', { class: 'truncate flex-1 text-left hover:text-primary', onClick: () => emit('edit', bug) }, bug.description),
          props.canDelete ? h('button', { class: 'text-xs text-error hover:underline', 'aria-label': `Eliminar ${bug.issue_key}`, onClick: () => emit('delete', bug, 0) }, 'Eliminar') : null,
        ]))),
        ...((props.subtasksByParent[child.id] ?? []).map(grandchild => h('div', { class: 'flex items-center gap-2 pl-24 pr-3 py-2 text-sm bg-elevated/10' }, [
          h('span', { class: 'text-muted' }, '↳'),
          h('span', { class: 'font-mono text-xs text-muted' }, grandchild.issue_key),
          h('span', { class: 'font-mono text-[10px] uppercase text-muted shrink-0', title: 'Subtarea' }, 'ST'),
          h('button', { class: 'truncate flex-1 text-left hover:text-primary', onClick: () => emit('edit', grandchild) }, grandchild.description),
          props.canDelete ? h('button', { class: 'text-xs text-error hover:underline', 'aria-label': `Eliminar ${grandchild.issue_key}`, onClick: () => emit('delete', grandchild, 0) }, 'Eliminar') : null,
        ]))),
      ])),
      ...props.bugs.map(bug => h('div', { class: 'flex items-center gap-2 pl-16 pr-3 py-2 text-sm bg-red-950/10' }, [
        h('span', { class: 'text-error' }, '↳'),
        h('span', { class: 'font-mono text-xs text-muted' }, bug.issue_key),
        h('span', { class: 'font-mono text-[10px] uppercase text-error', title: 'Bug' }, 'BG'),
        h('button', { class: 'truncate flex-1 text-left hover:text-primary', onClick: () => emit('edit', bug) }, bug.description),
        props.canDelete ? h('button', { class: 'text-xs text-error hover:underline', 'aria-label': `Eliminar ${bug.issue_key}`, onClick: () => emit('delete', bug, 0) }, 'Eliminar') : null,
      ])),
    ])
  },
})

const { navbarToggle, navbarAttrs } = useCurrentProjectColor()
const route = useRoute()
const { openTask: openTaskDetails } = useTaskDetailPanel()
const projectId = computed(() => Number(route.params.projectId))
const goals = useGoalsStore()
const project = computed(() => goals.goalMap.get(projectId.value) ?? null)
const projectName = computed(() => project.value?.name ?? '')
const perms = useGoalPermissionsFor(project)
const collaboration = useCollaborationStore()
const kanbanStore = useKanbanStore()
const canView = perms.canViewTasks
const canCreate = perms.canAddTask
const canAddSubtasks = perms.canAddTaskSubtasks
const canEdit = perms.canEditComponents
const canDeleteTask = perms.canDeleteTask
const canAssign = perms.canAssignSprintTasks
const canAssignUsers = perms.canAssignUsersToTask
const canViewKanban = perms.canViewKanban
const canViewSprints = perms.canViewSprints
const canSave = computed(() => formMode.value === 'epic' ? canCreate.value : formMode.value === 'create-item' ? canCreate.value : canEdit.value)
const loading = ref(false); const saving = ref(false); const error = ref(''); const hasLoaded = ref(false)
const loadingMore = ref(false); const itemsComplete = ref(false)
const epics = ref<ScrumEpic[]>([]); const items = ref<ScrumItem[]>([]); const subtasks = ref<Record<number, ScrumItem[]>>({})
const sprints = ref<Awaited<ReturnType<typeof $tvApi.sprints.listForGoal>>>([])
const statuses = computed(() => kanbanStore.statuses.filter(status => status.id > 0))
const view = ref<'backlog' | 'planning' | 'board'>('backlog')
const tabs = computed(() => [
  { id: 'backlog' as const, label: 'Backlog', icon: 'i-lucide-list-tree' },
  ...(canViewSprints.value ? [{ id: 'planning' as const, label: 'Sprint Planning', icon: 'i-lucide-rocket' }] : []),
  ...(canViewKanban.value ? [{ id: 'board' as const, label: 'Kanban', icon: 'i-lucide-kanban' }] : []),
])
const search = ref(''); const typeFilter = ref('all'); const expanded = ref(new Set<number>())
const NONE_VALUE = '__none__'
const typeOptions = [{ label: 'Todos los tipos', value: 'all' }, { label: 'Historia', value: 'story' }, { label: 'Tarea', value: 'task' }, { label: 'Bug', value: 'bug' }]
const priorityOptions = [{ label: 'Sin prioridad', value: NONE_VALUE }, { label: 'Baja', value: '1' }, { label: 'Media', value: '2' }, { label: 'Alta', value: '3' }]
const epicOptions = computed(() => [{ label: 'Sin épica', value: NONE_VALUE }, ...epics.value.filter(e => !e.archived).map(e => ({ label: `${e.issueKey} · ${e.title}`, value: String(e.id) }))])
const planningEpicFilter = ref('all')
const planningEpicOptions = computed(() => [
  { label: 'Todas las épicas', value: 'all' },
  { label: 'Sin épica', value: NONE_VALUE },
  ...epics.value.map(epic => ({ label: `${epic.issueKey} · ${epic.title}${epic.archived ? ' (Archivada)' : ''}`, value: String(epic.id) })),
])
const kanbanEpicFilter = ref('all')
const kanbanEpicOptions = computed(() => [
  { label: 'Todas las épicas', value: 'all' },
  { label: 'Sin épica', value: '__none__' },
  ...epics.value.map(epic => ({ label: `${epic.issueKey} · ${epic.title}${epic.archived ? ' (Archivada)' : ''}`, value: String(epic.id) })),
])
const ownerOptions = computed(() => [{ label: 'Sin responsable', value: NONE_VALUE }, ...collaboration.users.map(user => ({ label: user.email, value: String(user.id) }))])
const statusOptions = computed(() => [{ label: 'Estado predeterminado', value: NONE_VALUE }, ...statuses.value.map(s => ({ label: s.name, value: String(s.id) }))])
const affectedOptions = computed(() => [{ label: 'Sin elemento afectado', value: NONE_VALUE }, ...items.value.filter(i => i.work_item_type !== 'bug').map(i => ({ label: `${i.issue_key} · ${i.description}`, value: String(i.id) }))])
const sprintOptions = computed(() => [{ label: 'Seleccionar sprint', value: NONE_VALUE }, ...sprints.value.filter(s => !['completed'].includes(s.status)).map(s => ({ label: `${s.name} · ${s.status}`, value: String(s.id) }))])
const selectedSprint = ref(NONE_VALUE); const selectedIds = ref<number[]>([])
const qaReviews = ref<QaReview[]>([]); const qaEvidence = ref(''); const qaObservation = ref(''); const qaBugId = ref(NONE_VALUE); const qaSaving = ref(false)
const latestQa = computed(() => qaReviews.value[0] ?? null)
const latestQaStatus = computed(() => latestQa.value?.status === 'approved' ? 'Aprobado' : latestQa.value?.status === 'observed' ? 'Observado' : 'Pendiente')
const qaBugOptions = computed(() => [{ label: 'Sin bug relacionado', value: NONE_VALUE }, ...items.value.filter(i => i.work_item_type === 'bug').map(i => ({ label: `${i.issue_key} · ${i.description}`, value: String(i.id) }))])
const selectedSprintData = computed(() => selectedSprint.value === NONE_VALUE ? undefined : sprints.value.find(s => String(s.id) === selectedSprint.value))
const plannableItems = computed(() => items.value)
const itemsById = computed(() => new Map(items.value.map(item => [item.id, item])))
const selectedForSprint = computed(() => plannableItems.value.filter(i => selectedIds.value.includes(i.id)))
const sprintPoints = computed(() => selectedForSprint.value.reduce((sum, i) => sum + Number(i.estimate_value ?? 0), 0))
function epicForItem(item: ScrumItem): ScrumEpic | undefined {
  const visited = new Set<number>()
  let current: ScrumItem | undefined = item
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    if (current.epic_id != null) return epics.value.find(epic => epic.id === current!.epic_id)
    const relatedId: number | null = current.work_item_type === 'bug' ? current.related_task_id : current.parent_id
    current = relatedId == null ? undefined : itemsById.value.get(relatedId)
  }
  return undefined
}
const filteredPlanningItems = computed(() => filtered(plannableItems.value).filter((item) => {
  if (planningEpicFilter.value === 'all') return true
  const epicId = epicForItem(item)?.id
  return planningEpicFilter.value === NONE_VALUE
    ? epicId == null
    : String(epicId) === planningEpicFilter.value
}))
const epicItems = (id: number) => items.value.filter(i => ['story', 'task'].includes(i.work_item_type) && i.epic_id === id && i.parent_id == null)
const relatedBugs = (id: number) => items.value.filter(i => i.work_item_type === 'bug' && i.related_task_id === id)
const visibleRelatedBugs = (id: number) => relatedBugs(id).filter(matches)
const bugsByTarget = computed(() => Object.fromEntries(items.value.filter(i => i.work_item_type === 'bug' && i.related_task_id != null && matches(i)).map(i => [i.related_task_id!, [...(items.value.filter(candidate => candidate.work_item_type === 'bug' && candidate.related_task_id === i.related_task_id && matches(candidate)))]])))
const unlinkedItems = computed(() => items.value.filter(i => i.parent_id == null && !i.epic_id && !(i.work_item_type === 'bug' && i.related_task_id)))
const epicDisplayItems = (id: number) => epicItems(id).filter(i => matches(i) || relatedBugs(i.id).some(matches))
const unlinkedDisplayItems = computed(() => unlinkedItems.value.filter(i => matches(i) || relatedBugs(i.id).some(matches)))
const visibleEpics = computed(() => epics.value.filter(e => e.title.toLowerCase().includes(search.value.toLowerCase()) || e.issueKey.toLowerCase().includes(search.value.toLowerCase()) || epicDisplayItems(e.id).length > 0))
const summary = computed(() => [{ label: 'Épicas activas', value: epics.value.filter(e => !e.archived).length }, { label: 'Historias', value: items.value.filter(i => i.work_item_type === 'story' && i.parent_id == null).length }, { label: 'Tareas', value: items.value.filter(i => i.work_item_type === 'task' && i.parent_id == null).length }, { label: 'Bugs', value: items.value.filter(i => i.work_item_type === 'bug' && i.parent_id == null).length }])
function matches(i: ScrumItem) { return `${i.description} ${i.issue_key}`.toLowerCase().includes(search.value.trim().toLowerCase()) && (typeFilter.value === 'all' || i.work_item_type === typeFilter.value) }
function filtered(list: ScrumItem[]) { return list.filter(matches) }
function toggleEpic(id: number) { const next = new Set(expanded.value); if (next.has(id)) next.delete(id); else next.add(id); expanded.value = next }
function typeLabel(type: string) { return ({ story: 'Historia', task: 'Tarea', bug: 'Bug' } as Record<string, string>)[type] ?? type }
function typeColor(type: string) { return type === 'bug' ? 'error' : type === 'story' ? 'primary' : 'neutral' }

async function loadSubtasksForItem(item: ScrumItem) {
  try {
    const children = await $tvApi.scrum.listSubtasks(item.id)
    subtasks.value[item.id] = children
    if (item.work_item_type === 'story') {
      await Promise.all(children.filter(child => child.work_item_type === 'task').map(async child => {
        try { subtasks.value[child.id] = await $tvApi.scrum.listSubtasks(child.id) } catch { /* Hidden by the existing subtasks permission. */ }
      }))
    }
  } catch { /* Hidden by the existing subtasks permission. */ }
}

async function load() {
  if (!projectId.value || !canView.value) return
  if (!hasLoaded.value) loading.value = true
  error.value = ''
  try {
    const [e, all, sprintRows] = await Promise.all([
      $tvApi.scrum.listEpics(projectId.value),
      $tvApi.scrum.listItems({ goalId: projectId.value, limit: 500 }),
      canViewSprints.value ? $tvApi.sprints.listForGoal({ goalId: projectId.value }) : Promise.resolve([]),
    ])
    epics.value = e; items.value = all; sprints.value = sprintRows
    subtasks.value = {}
    itemsComplete.value = all.length < 500
    expanded.value = new Set(e.filter(x => !x.archived).map(x => x.id))
    await Promise.all(items.value.filter(i => i.parent_id == null).map(loadSubtasksForItem))
    hasLoaded.value = true
  } catch (e) { error.value = apiError(e) } finally { loading.value = false }
}
async function loadMoreItems() {
  if (loadingMore.value || itemsComplete.value) return
  loadingMore.value = true
  try {
    const next = await $tvApi.scrum.listItems({ goalId: projectId.value, limit: 500, offset: items.value.length })
    items.value = [...items.value, ...next]
    itemsComplete.value = next.length < 500
    await Promise.all(next.filter(i => i.parent_id == null).map(loadSubtasksForItem))
  } catch (e) { error.value = apiError(e) } finally { loadingMore.value = false }
}
function apiError(e: unknown) { const err = e as { response?: { data?: { error?: string } }; message?: string }; return err.response?.data?.error ?? err.message ?? 'Error de conexión.' }
watch([projectId, canView], () => { void load() }, { immediate: true })
onMounted(async () => {
  const id = Number(route.params.projectId)
  if (id <= 0 || goals.goalMap.has(id)) return
  try {
    const allAccessibleGoals = await $tvApi.goals.fetchGoals()
    const directMatch = allAccessibleGoals?.find(goal => Number(goal.id) === id)
    if (directMatch) {
      goals.goals = [...goals.goals.filter(goal => goal.id !== id), directMatch]
      return
    }
  } catch (e) {
    error.value = apiError(e)
  }
})
watch([projectId, canViewKanban, canAssignUsers], async ([id, canSeeKanban, canAssign]) => {
  if (id <= 0) return
  kanbanStore.goalId = id
  kanbanStore.statuses = []
  kanbanStore.tasksData = {}
  const jobs: Promise<unknown>[] = []
  if (canSeeKanban) jobs.push(kanbanStore.fetchStatuses(id))
  if (canAssign) jobs.push(collaboration.fetchCollaborationUsersForGoal(id).catch(() => undefined))
  await Promise.all(jobs)
}, { immediate: true })
watch(view, async (v) => {
  if ((v === 'board' && !canViewKanban.value) || (v === 'planning' && !canViewSprints.value)) {
    view.value = 'backlog'
    return
  }
  if (v === 'board' && canViewKanban.value) {
    applyKanbanFilters()
    if (kanbanStore.statuses.length === 0) await kanbanStore.fetchStatuses(projectId.value)
    else await kanbanStore.reloadColumns()
  }
})
function applyKanbanFilters() {
  const epicId = kanbanEpicFilter.value === 'all'
    ? undefined
    : kanbanEpicFilter.value === '__none__' ? null : Number(kanbanEpicFilter.value)
  const workItemTypes = ['story', 'task', 'bug'].includes(typeFilter.value)
    ? [typeFilter.value as 'story' | 'task' | 'bug']
    : undefined
  kanbanStore.setFilters({ ...kanbanStore.filters, epicId, workItemTypes })
}
watch([kanbanEpicFilter, typeFilter], () => {
  if (view.value !== 'board') return
  applyKanbanFilters()
  void kanbanStore.reloadColumns()
})

const modalOpen = ref(false); const formMode = ref<'epic' | 'create-item' | 'edit-item'>('create-item')
const currentEpic = ref<ScrumEpic | null>(null); const currentItem = ref<ScrumItem | null>(null); const parentItem = ref<ScrumItem | null>(null)
const modalTitle = computed(() => formMode.value === 'epic' ? (currentEpic.value ? 'Editar épica' : 'Nueva épica') : formMode.value === 'edit-item' ? `Editar ${typeLabel(form.type)}` : parentItem.value ? 'Nueva subtarea' : `Nuevo ${typeLabel(form.type)}`)
const modalDescription = computed(() => currentItem.value?.issue_key ?? currentEpic.value?.issueKey ?? 'Los cambios se guardan en el proyecto actual.')
let form = reactive({ type: 'story' as ScrumWorkType, description: '', note: '', acceptanceCriteria: '', priorityId: NONE_VALUE, statusId: NONE_VALUE, epicId: NONE_VALUE, relatedTaskId: NONE_VALUE, owner: NONE_VALUE, estimateValue: '' })
function resetForm(type: ScrumWorkType = 'story') { Object.assign(form, { type, description: '', note: '', acceptanceCriteria: '', priorityId: NONE_VALUE, statusId: NONE_VALUE, epicId: NONE_VALUE, relatedTaskId: NONE_VALUE, owner: NONE_VALUE, estimateValue: '' }); currentEpic.value = null; currentItem.value = null; parentItem.value = null; qaReviews.value = []; qaEvidence.value = ''; qaObservation.value = ''; qaBugId.value = NONE_VALUE }
function closeModal() { if (!saving.value) modalOpen.value = false }
function openCreate(type: ScrumWorkType = 'story', epicId?: number, parent?: ScrumItem) { resetForm(type); formMode.value = 'create-item'; form.epicId = epicId ? String(epicId) : NONE_VALUE; parentItem.value = parent ?? null; modalOpen.value = true }
function openCreateFiltered() { const type = typeFilter.value; openCreate(type === 'story' || type === 'task' || type === 'bug' ? type : 'story') }
function openCreateEpic() { resetForm(); formMode.value = 'epic'; modalOpen.value = true }
function openEditEpic(epic: ScrumEpic) { resetForm(); currentEpic.value = epic; form.description = epic.title; form.note = epic.details ?? ''; formMode.value = 'epic'; modalOpen.value = true }
function openEdit(item: ScrumItem) { resetForm(item.work_item_type); currentItem.value = item; Object.assign(form, { description: item.description, note: item.note ?? '', acceptanceCriteria: item.acceptance_criteria ?? '', priorityId: item.priority_id ? String(item.priority_id) : NONE_VALUE, statusId: item.status_id ? String(item.status_id) : NONE_VALUE, epicId: item.epic_id ? String(item.epic_id) : NONE_VALUE, relatedTaskId: item.related_task_id ? String(item.related_task_id) : NONE_VALUE, owner: item.owner ? String(item.owner) : NONE_VALUE, estimateValue: item.estimate_value == null ? '' : String(item.estimate_value) }); formMode.value = 'edit-item'; modalOpen.value = true; void loadQa(item.id) }
async function loadQa(taskId: number) { try { qaReviews.value = await $tvApi.scrum.listQaReviews(taskId) } catch { qaReviews.value = [] } }
async function saveQa(status: QaReviewStatus) {
  if (!currentItem.value || qaSaving.value || !canEdit.value) return
  qaSaving.value = true; error.value = ''
  try {
    const review = await $tvApi.scrum.createQaReview(currentItem.value.id, { status, evidence: qaEvidence.value || null })
    if (qaObservation.value.trim()) await $tvApi.scrum.addQaObservation(currentItem.value.id, { reviewId: review.id, note: qaObservation.value.trim(), bugTaskId: qaBugId.value === NONE_VALUE ? null : Number(qaBugId.value) })
    qaEvidence.value = ''; qaObservation.value = ''; qaBugId.value = NONE_VALUE; await loadQa(currentItem.value.id)
  } catch (e) { error.value = apiError(e) } finally { qaSaving.value = false }
}
async function save() {
  if (saving.value || !canSave.value) return
  saving.value = true; error.value = ''
  const n = (value: string) => value === NONE_VALUE || value === '' ? null : Number(value)
  try {
    if (formMode.value === 'epic') {
      const body = { title: form.description.trim(), details: form.note || null }
      if (currentEpic.value) await $tvApi.scrum.updateEpic(currentEpic.value.id, body); else await $tvApi.scrum.createEpic(projectId.value, body)
    } else {
      const body = { description: form.description.trim(), note: form.note || null, priorityId: n(form.priorityId), statusId: n(form.statusId), ...(canAssignUsers.value ? { owner: n(form.owner) } : {}), estimateValue: n(form.estimateValue), acceptanceCriteria: form.acceptanceCriteria || null, ...(['story', 'task'].includes(form.type) ? { epicId: n(form.epicId) } : {}), ...(form.type === 'bug' ? { relatedTaskId: n(form.relatedTaskId) } : {}) }
      if (formMode.value === 'edit-item' && currentItem.value) await $tvApi.scrum.updateItem(currentItem.value.id, body)
      else await $tvApi.scrum.createItem(projectId.value, { ...body, type: form.type, ...(parentItem.value ? { parentId: parentItem.value.id } : {}) })
    }
    modalOpen.value = false
    await load()
  } catch (e) { error.value = apiError(e) } finally { saving.value = false }
}
async function archiveEpic(epic: ScrumEpic) { if (!window.confirm(`Archivar ${epic.issueKey}? Las historias se conservarán.`)) return; try { await $tvApi.scrum.archiveEpic(epic.id); await load() } catch (e) { error.value = apiError(e) } }
async function deleteEpic(epic: ScrumEpic) { if (!window.confirm(`Eliminar permanentemente ${epic.issueKey} · ${epic.title}? Las historias y tareas se conservarán y quedarán sin épica. Esta acción no se puede deshacer.`)) return; error.value = ''; try { await $tvApi.scrum.deleteEpic(epic.id); await load() } catch (e) { error.value = apiError(e) } }
async function deleteItem(item: ScrumItem) { const cascadeNotice = ' Si tiene subtareas, también se eliminarán; los bugs relacionados se conservarán sin vínculo.'; if (!window.confirm(`Eliminar permanentemente ${item.issue_key} · ${item.description}?${cascadeNotice} Esta acción no se puede deshacer.`)) return; error.value = ''; try { await $tvApi.tasks.deleteTask(item.id); await load() } catch (e) { error.value = apiError(e) } }
function toggleSelected(id: number, checked: boolean | 'indeterminate') { selectedIds.value = checked === true ? [...new Set([...selectedIds.value, id])] : selectedIds.value.filter(selected => selected !== id) }
async function assignSprint() { if (selectedSprint.value === NONE_VALUE || !canAssign.value) return; error.value = ''; try { await Promise.all(selectedForSprint.value.map(i => $tvApi.sprints.setTaskSprint({ taskId: i.id, sprintId: Number(selectedSprint.value) }))); selectedIds.value = []; await load() } catch (e) { await load(); error.value = apiError(e) } }
async function openLegacyDetail() {
  const taskId = currentItem.value?.id
  if (!taskId) return
  modalOpen.value = false
  await nextTick()
  await new Promise(resolve => window.setTimeout(resolve, 250))
  await openTaskDetails(taskId)
}
</script>
