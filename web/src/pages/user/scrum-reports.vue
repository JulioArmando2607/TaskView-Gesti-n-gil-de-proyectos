<template>
  <UDashboardPanel id="scrum-reports">
    <template #header>
      <UDashboardNavbar :title="`${projectName} - Reportes Scrum`">
        <template #leading><TvCollapseSidebarDesktop /></template>
        <template #right>
          <UButton label="CSV" icon="i-lucide-download" color="neutral" variant="ghost" :disabled="loading" @click="download('csv')" />
          <UButton label="Excel" icon="i-lucide-file-spreadsheet" color="neutral" variant="soft" :disabled="loading" @click="download('xlsx')" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="!canView" class="flex flex-col items-center gap-2 py-16 text-center">
        <UIcon name="i-lucide-lock" class="size-8 text-dimmed" />
        <p class="text-muted">Se requiere permiso de analítica de sprint para consultar reportes.</p>
      </div>
      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <UInput v-model="sprintId" type="number" placeholder="Sprint (opcional)" @change="load" />
          <USelect v-model="type" :items="typeOptions" value-key="value" label-key="label" @update:model-value="load" />
          <UInput v-model="ownerId" type="number" placeholder="Responsable (opcional)" @change="load" />
          <UButton label="Actualizar" icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="loading" @click="load" />
        </div>
        <UAlert v-if="error" color="error" variant="soft" title="No se pudo cargar el reporte" :description="error" />
        <div v-if="loading" class="flex justify-center py-10"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" /></div>
        <template v-else-if="report">
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <UCard><p class="text-xs text-muted">QA pendiente</p><p class="text-2xl font-semibold">{{ report.qa.pending }}</p></UCard>
            <UCard><p class="text-xs text-muted">QA aprobado</p><p class="text-2xl font-semibold">{{ report.qa.approved }}</p></UCard>
            <UCard><p class="text-xs text-muted">Observadas</p><p class="text-2xl font-semibold">{{ report.qa.observed }}</p></UCard>
            <UCard><p class="text-xs text-muted">Bugs</p><p class="text-2xl font-semibold">{{ report.qa.bugs }}</p></UCard>
            <UCard><p class="text-xs text-muted">Revisadas</p><p class="text-2xl font-semibold">{{ report.qa.reviewed }}</p></UCard>
          </div>
          <UCard>
            <template #header><h2 class="font-semibold">Avance por sprint</h2></template>
            <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-muted"><th class="p-2">Sprint</th><th class="p-2">Periodo</th><th class="p-2">Comprometidas</th><th class="p-2">Terminadas</th><th class="p-2">Aceptadas</th><th class="p-2">Pendientes</th><th class="p-2">Avance</th></tr></thead><tbody><tr v-for="sprint in report.sprints" :key="sprint.id" class="border-t border-default"><td class="p-2">{{ sprint.name }}</td><td class="p-2">{{ sprint.startDate }} — {{ sprint.endDate }}</td><td class="p-2">{{ sprint.committed }}</td><td class="p-2">{{ sprint.completed }}</td><td class="p-2">{{ sprint.accepted }}</td><td class="p-2">{{ sprint.pending }}</td><td class="p-2">{{ sprint.progressPercent }}%</td></tr></tbody></table></div>
          </UCard>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <UCard><template #header><h2 class="font-semibold">Seguimiento por responsable</h2></template><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-muted"><th class="p-2">Integrante</th><th class="p-2">Historias</th><th class="p-2">Tareas</th><th class="p-2">Bugs</th><th class="p-2">Pendientes</th><th class="p-2">Finalizadas</th></tr></thead><tbody><tr v-for="person in report.assignees" :key="person.ownerId" class="border-t border-default"><td class="p-2">{{ person.ownerLogin }}</td><td class="p-2">{{ person.stories }}</td><td class="p-2">{{ person.tasks }}</td><td class="p-2">{{ person.bugs }}</td><td class="p-2">{{ person.pending }}</td><td class="p-2">{{ person.completed }}</td></tr></tbody></table></div></UCard>
            <UCard><template #header><h2 class="font-semibold">Bugs</h2></template><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-muted"><th class="p-2">Clave</th><th class="p-2">Descripción</th><th class="p-2">Prioridad</th><th class="p-2">Responsable</th><th class="p-2">Creado</th></tr></thead><tbody><tr v-for="bug in report.bugs" :key="bug.id" class="border-t border-default"><td class="p-2">{{ bug.issueKey }}</td><td class="p-2">{{ bug.description }}</td><td class="p-2">{{ bug.priorityId ?? '—' }}</td><td class="p-2">{{ bug.ownerLogin ?? 'Sin responsable' }}</td><td class="p-2">{{ bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : '—' }}</td></tr></tbody></table></div></UCard>
          </div>
          <UCard><template #header><h2 class="font-semibold">Elementos filtrados</h2></template><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-muted"><th class="p-2">Clave</th><th class="p-2">Tipo</th><th class="p-2">Descripción</th><th class="p-2">Estado</th><th class="p-2">Sprint</th><th class="p-2">Responsable</th></tr></thead><tbody><tr v-for="item in report.items" :key="item.id" class="border-t border-default"><td class="p-2">{{ item.issueKey }}</td><td class="p-2">{{ item.type }}</td><td class="p-2">{{ item.description }}</td><td class="p-2">{{ item.statusName ?? (item.complete ? 'Finalizada' : 'Pendiente') }}</td><td class="p-2">{{ item.sprintName ?? 'Backlog' }}</td><td class="p-2">{{ item.ownerLogin ?? 'Sin responsable' }}</td></tr></tbody></table></div></UCard>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import TvCollapseSidebarDesktop from '@/components/features/base/TvCollapseSidebarDesktop.vue'
import { useGoalsStore } from '@/stores/goals.store'
import { useGoalPermissionsFor } from '@/composables/useGoalPermissions'
import { $tvApi } from '@/plugins/axios'
import type { GoalItem, ScrumReportsOverview } from 'taskview-api'

const route = useRoute()
const goalsStore = useGoalsStore()
const projectId = computed(() => Number(route.params.projectId) || 0)
const routeProject = ref<GoalItem | null>(null)
const project = computed(() => goalsStore.goalMap.get(projectId.value) ?? goalsStore.selectedGoal ?? routeProject.value)
const projectName = computed(() => project.value?.name ?? 'Proyecto')
const { canViewSprintAnalytics: goalCanView } = useGoalPermissionsFor(project)
// Direct navigation can render before UserLayout has populated the project store.
// In that short window, let the protected API decide access instead of suppressing
// the first request; a 403 remains an empty/denied report for unauthorized users.
const canView = computed(() => project.value ? goalCanView.value : true)
const loading = ref(false)
const error = ref<string | null>(null)
const report = ref<ScrumReportsOverview | null>(null)
const sprintId = ref('')
const ownerId = ref('')
const type = ref('')
const typeOptions = [{ label: 'Todos los tipos', value: '' }, { label: 'Historias', value: 'story' }, { label: 'Tareas', value: 'task' }, { label: 'Bugs', value: 'bug' }]

async function load() {
  if (!projectId.value || !canView.value) return
  loading.value = true; error.value = null
  try {
    report.value = await $tvApi.scrumReports.overview({ goalId: projectId.value, ...(sprintId.value ? { sprintId: Number(sprintId.value) } : {}), ...(ownerId.value ? { ownerId: Number(ownerId.value) } : {}), ...(type.value ? { type: type.value as 'story' | 'task' | 'bug' } : {}) })
  } catch (e) { error.value = e instanceof Error ? e.message : 'Error desconocido' } finally { loading.value = false }
}

async function download(format: 'csv' | 'xlsx') {
  if (!projectId.value) return
  const response = await $tvApi.scrumReports.export({ goalId: projectId.value, format, ...(sprintId.value ? { sprintId: Number(sprintId.value) } : {}), ...(ownerId.value ? { ownerId: Number(ownerId.value) } : {}), ...(type.value ? { type: type.value as 'story' | 'task' | 'bug' } : {}) })
  const blob = new Blob([response.data])
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `scrum-report.${format}`; link.click(); URL.revokeObjectURL(url)
}

watch([projectId, canView], () => { void load() }, { immediate: true })

onMounted(async () => {
  const id = Number(route.params.projectId)
  if (id <= 0 || project.value) return
  try {
    await goalsStore.fetchGoals()
    const loadedMatch = goalsStore.goalMap.get(id)
    if (loadedMatch) {
      routeProject.value = loadedMatch
      return
    }
    const allAccessibleGoals = await $tvApi.goals.fetchGoals() ?? []
    goalsStore.goals = [...goalsStore.goals.filter(goal => !allAccessibleGoals.some(item => Number(item.id) === Number(goal.id))), ...allAccessibleGoals]
    const directMatch = allAccessibleGoals?.find(goal => Number(goal.id) === id)
    if (directMatch) {
      routeProject.value = directMatch
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'No se pudo cargar el proyecto.'
  }
})
</script>
