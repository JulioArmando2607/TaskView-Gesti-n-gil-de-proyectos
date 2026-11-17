<template>
  <section
    v-if="isScrumItem"
    class="rounded-2xl border border-default p-4 space-y-4"
    data-testid="task-acceptance-qa"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="font-semibold">Criterios de aceptación</h3>
      <UButton
        v-if="canEdit && criteria !== savedCriteria"
        size="sm"
        :loading="savingCriteria"
        :disabled="!item"
        label="Guardar criterios"
        @click="saveCriteria"
      />
    </div>
    <UTextarea
      v-model="criteria"
      :readonly="!canEdit"
      :rows="3"
      class="w-full"
      :placeholder="canEdit ? 'Añade los criterios de aceptación…' : 'Sin criterios de aceptación'"
    />
    <p v-if="loadError" class="text-xs text-error">No se pudieron cargar los datos Scrum de esta tarea.</p>

    <div class="border-t border-default pt-4 space-y-3" data-testid="task-qa-panel">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h3 class="font-semibold">QA funcional</h3>
          <p class="text-xs text-muted">Validación independiente del estado de desarrollo.</p>
        </div>
        <UBadge
          v-if="latestQa"
          :color="latestQa.status === 'approved' ? 'success' : latestQa.status === 'observed' ? 'error' : 'neutral'"
          variant="subtle"
        >
          {{ qaStatusLabel }}
        </UBadge>
      </div>
      <div v-if="qaLoading" class="text-sm text-muted">Cargando revisiones de QA…</div>
      <template v-else>
        <UTextarea v-model="evidence" :rows="2" :readonly="!canEdit" placeholder="Evidencia de validación" />
        <UTextarea v-model="observation" :rows="2" :readonly="!canEdit" placeholder="Observación QA (opcional)" />
        <USelect v-model="bugId" :items="bugOptions" class="w-full" :disabled="!canEdit" />
        <div v-if="canEdit" class="flex flex-wrap gap-2">
          <UButton label="Enviar a QA" color="neutral" variant="outline" :loading="savingQa" :disabled="savingQa || !item" @click="saveQa('pending')" />
          <UButton label="Registrar observación" color="error" variant="soft" :loading="savingQa" :disabled="savingQa || !item || !observation.trim()" @click="saveQa('observed')" />
          <UButton label="Aprobar QA" color="success" :loading="savingQa" :disabled="savingQa || !item" @click="saveQa('approved')" />
        </div>
        <div v-if="latestQa?.observations?.length" class="space-y-1 text-sm text-muted">
          <div v-for="entry in latestQa.observations" :key="entry.id">
            {{ entry.note }}<span v-if="entry.bugTaskId"> · bug #{{ entry.bugTaskId }}</span>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { QaReview, QaReviewStatus, ScrumItem } from 'taskview-api'
import { useGoalPermissions } from '@/composables/useGoalPermissions'
import { $tvApi } from '@/plugins/axios'

const props = defineProps<{
  taskId: number
  goalId: number
  workItemType?: 'task' | 'story' | 'bug'
  acceptanceCriteria?: string | null
}>()
const { permissions } = useGoalPermissions()
const canEdit = computed(() => permissions.COMPONENT_CAN_EDIT || permissions.COMPONENT_CAN_EDIT_ALL_TASKS)
const toast = useToast()
const NONE = '__none__'
const item = ref<ScrumItem | null>(null)
const reviews = ref<QaReview[]>([])
const bugs = ref<ScrumItem[]>([])
const criteria = ref('')
const savedCriteria = ref('')
const evidence = ref('')
const observation = ref('')
const bugId = ref(NONE)
const qaLoading = ref(false)
const loadError = ref(false)
const savingCriteria = ref(false)
const savingQa = ref(false)
let requestVersion = 0

const isScrumItem = computed(() => ['story', 'task', 'bug'].includes(item.value?.work_item_type ?? props.workItemType ?? ''))
const latestQa = computed(() => reviews.value[0] ?? null)
const qaStatusLabel = computed(() => latestQa.value?.status === 'approved' ? 'Aprobado' : latestQa.value?.status === 'observed' ? 'Observado' : 'Pendiente')
const bugOptions = computed(() => [
  { label: 'Sin bug relacionado', value: NONE },
  ...bugs.value.map(bug => ({ label: `${bug.issue_key} · ${bug.description}`, value: String(bug.id) })),
])

watch(() => [props.taskId, props.goalId] as const, async ([taskId, goalId]) => {
  const version = ++requestVersion
  item.value = null
  reviews.value = []
  bugs.value = []
  criteria.value = props.acceptanceCriteria ?? ''
  savedCriteria.value = criteria.value
  loadError.value = false
  qaLoading.value = true
  try {
    let loaded: ScrumItem | undefined
    try {
      loaded = await $tvApi.scrum.getItem(taskId)
    } catch {
      // Keep compatibility with deployments where the single-item route is
      // unavailable while the project Scrum listing is already enabled.
      const projectItems = await $tvApi.scrum.listItems({ goalId, limit: 500 })
      loaded = projectItems.find(candidate => candidate.id === taskId)
    }
    if (version !== requestVersion) return
    if (!loaded) return
    item.value = loaded
    criteria.value = loaded.acceptance_criteria ?? ''
    savedCriteria.value = criteria.value
    const [qaResult, bugResult] = await Promise.all([
      $tvApi.scrum.listQaReviews(taskId).catch(() => [] as QaReview[]),
      $tvApi.scrum.listItems({ goalId, type: 'bug', limit: 500 }).catch(() => [] as ScrumItem[]),
    ])
    if (version !== requestVersion) return
    reviews.value = qaResult
    bugs.value = bugResult
  } catch {
    loadError.value = true
  } finally {
    if (version === requestVersion) qaLoading.value = false
  }
}, { immediate: true })

async function saveCriteria() {
  if (!item.value || savingCriteria.value || !canEdit.value) return
  savingCriteria.value = true
  try {
    const updated = await $tvApi.scrum.updateItem(item.value.id, { acceptanceCriteria: criteria.value.trim() || null })
    item.value = updated
    savedCriteria.value = updated.acceptance_criteria ?? ''
    criteria.value = savedCriteria.value
    toast.add({ title: 'Criterios de aceptación guardados', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudieron guardar los criterios', color: 'error' })
  } finally {
    savingCriteria.value = false
  }
}

async function saveQa(status: QaReviewStatus) {
  if (!item.value || savingQa.value || !canEdit.value) return
  savingQa.value = true
  try {
    const review = await $tvApi.scrum.createQaReview(item.value.id, { status, evidence: evidence.value.trim() || null })
    if (observation.value.trim()) {
      await $tvApi.scrum.addQaObservation(item.value.id, {
        reviewId: review.id,
        note: observation.value.trim(),
        bugTaskId: bugId.value === NONE ? null : Number(bugId.value),
      })
    }
    reviews.value = await $tvApi.scrum.listQaReviews(item.value.id)
    evidence.value = ''
    observation.value = ''
    bugId.value = NONE
    toast.add({ title: status === 'approved' ? 'QA aprobado' : status === 'observed' ? 'Observación registrada' : 'Enviado a QA', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudo guardar la revisión de QA', color: 'error' })
  } finally {
    savingQa.value = false
  }
}
</script>
