<template>
  <div class="space-y-4">
    <h3 class="text-lg font-semibold">
      {{ t('collaboration.roles.title') }}
    </h3>

    <RoleAddInput
      :loading="loading"
      @add="$emit('create', $event)"
    />

    <section class="space-y-2">
      <p class="text-sm text-muted">Plantillas de roles Scrum</p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="template in roleTemplates"
          :key="template.name"
          :label="template.name"
          :loading="creatingTemplate === template.name"
          :disabled="!!creatingTemplate || loading"
          color="neutral"
          variant="outline"
          size="sm"
          @click="createTemplate(template)"
        />
      </div>
      <p class="text-xs text-muted">Se crea el rol con permisos iniciales que puedes revisar y ajustar.</p>
    </section>

    <div
      v-if="loading"
      class="flex items-center justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="size-8 animate-spin text-muted"
      />
    </div>

    <div
      v-else-if="roles.length === 0"
      class="flex flex-col items-center justify-center py-12 text-muted"
    >
      <UIcon
        name="i-lucide-shield"
        class="size-12 mb-4"
      />
      <p>{{ t('collaboration.roles.empty') }}</p>
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <RoleItem
        v-for="role in roles"
        :key="role.id"
        :role="role"
        :permissions-count="getPermissionsCount(role.id)"
        @menu="openContextMenu($event, role)"
      />
    </div>

    <TvContextMenu ref="contextMenu">
      <div class="p-1 flex flex-col gap-1">
        <UButton
          :label="t('collaboration.roles.assignPermissions')"
          data-testid="collab-role-assign-permissions"
          icon="i-lucide-shield-check"
          variant="ghost"
          color="neutral"
          class="w-full justify-start"
          @click="openEditModal"
        />
        <USeparator class="my-1" />
        <UButton
          :label="t('contextMenu.delete')"
          data-testid="collab-role-delete"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          class="w-full justify-start"
          @click="openDeleteDialog"
        />
      </div>
    </TvContextMenu>

    <RoleEditModal
      v-model:open="isEditModalOpen"
      :role="selectedRole"
      :permissions="permissions"
      :role-permissions="getRolePermissions(selectedRole?.id)"
      @toggle-permission="handleTogglePermission"
    />

    <RoleDeleteDialog
      v-model:open="isDeleteDialogOpen"
      :role="selectedRole"
      @confirm="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CollaborationPermission } from 'taskview-api'
import type { CollaborationRole, CollaborationRolesStore } from '@/types/collaboration-roles.types'
import TvContextMenu from '@/components/features/base/TvContextMenu.vue'
import RoleItem from './RoleItem.vue'
import RoleAddInput from './RoleAddInput.vue'
import RoleEditModal from './RoleEditModal.vue'
import RoleDeleteDialog from './RoleDeleteDialog.vue'

const props = defineProps<{
  roles: CollaborationRole[]
  permissions: CollaborationPermission[]
  rolesPermissions: CollaborationRolesStore['rolesPermissions']
  goalId: number
  loading?: boolean
  creatingTemplate?: string | null
}>()

const emit = defineEmits<{
  create: [name: string]
  createTemplate: [template: { name: string; permissionNames: string[] }]
  togglePermission: [data: { roleId: number; permissionId: number }]
  delete: [roleId: number]
}>()

const { t } = useI18n()

const roleTemplates = [
  {
    name: 'Scrum Master',
    permissionNames: [
      'goal_can_watch_content', 'goal_can_add_task_list', 'component_can_watch_content',
      'component_can_add_tasks', 'component_can_add_subtasks', 'task_can_edit_description',
      'task_can_edit_status', 'task_can_edit_note', 'task_can_edit_deadline',
      'task_can_watch_details', 'task_can_watch_subtasks', 'task_can_add_subtasks',
      'task_can_edit_tags', 'task_can_watch_tags', 'task_can_watch_priority',
      'task_can_edit_priority', 'task_can_access_history', 'task_can_assign_users',
      'task_can_watch_assigned_users', 'sprint_can_view', 'sprint_can_manage',
      'sprint_can_assign_tasks', 'sprint_can_view_analytics', 'timetracking_can_view',
    ],
  },
  {
    name: 'Product Owner',
    permissionNames: [
      'goal_can_watch_content', 'goal_can_edit', 'goal_can_add_task_list',
      'component_can_watch_content', 'component_can_add_tasks', 'component_can_edit',
      'task_can_edit_description', 'task_can_edit_status', 'task_can_edit_deadline',
      'task_can_watch_details', 'task_can_watch_subtasks', 'task_can_edit_tags',
      'task_can_watch_tags', 'task_can_watch_priority', 'task_can_edit_priority',
      'task_can_assign_users', 'task_can_watch_assigned_users', 'sprint_can_view',
      'sprint_can_assign_tasks', 'sprint_can_view_analytics',
    ],
  },
  {
    name: 'Desarrollador',
    permissionNames: [
      'goal_can_watch_content', 'component_can_watch_content', 'task_can_edit_description',
      'task_can_edit_status', 'task_can_edit_note', 'task_can_watch_details',
      'task_can_watch_subtasks', 'task_can_add_subtasks', 'task_can_watch_tags',
      'task_can_watch_priority', 'task_can_watch_assigned_users', 'sprint_can_view',
      'timetracking_can_log',
    ],
  },
]

const contextMenu = ref<InstanceType<typeof TvContextMenu> | null>(null)
const selectedRole = ref<CollaborationRole | null>(null)
const isEditModalOpen = ref(false)
const isDeleteDialogOpen = ref(false)

function getPermissionsCount(roleId: number): number {
  const perms = props.rolesPermissions[roleId]
  return perms ? Object.keys(perms).length : 0
}

function createTemplate(template: typeof roleTemplates[number]) {
  emit('createTemplate', template)
}

function getRolePermissions(roleId?: number): Record<number, true> {
  if (!roleId) return {}
  return props.rolesPermissions[roleId] || {}
}

function openContextMenu(event: MouseEvent, role: CollaborationRole) {
  selectedRole.value = role
  contextMenu.value?.openAt(event)
}

function openEditModal() {
  contextMenu.value?.close()
  isEditModalOpen.value = true
}

function openDeleteDialog() {
  contextMenu.value?.close()
  isDeleteDialogOpen.value = true
}

function handleTogglePermission(permissionId: number) {
  if (selectedRole.value) {
    emit('togglePermission', {
      roleId: selectedRole.value.id,
      permissionId,
    })
  }
}

function handleDelete() {
  if (selectedRole.value) {
    emit('delete', selectedRole.value.id)
    isDeleteDialogOpen.value = false
  }
}
</script>
