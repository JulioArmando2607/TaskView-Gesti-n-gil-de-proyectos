<template>
  <div class="p-4">
    <div
      v-if="!hasGoalSelected"
      class="flex flex-col items-center justify-center h-64 text-muted"
    >
      <UIcon
        name="i-lucide-users"
        class="size-12 mb-4"
      />
      <p>{{ t('collaboration.selectProject') }}</p>
    </div>

    <template v-else>
      <UTabs
        v-model="activeTab"
        :items="tabs"
        class="w-full"
        :ui="{ list: 'rounded-2xl', trigger: 'rounded-xl', indicator: 'rounded-xl' }"
      >
        <template #default="{ item }">
          <span :data-testid="`collab-tab-${item.value}`">{{ item.label }}</span>
        </template>

        <template #members>
          <MembersList
            :members="users"
            :roles="roles"
            :goal-id="projectId"
            :loading="loading"
            :creating-template="creatingRoleTemplate"
            @invite="handleInvite"
            @update-roles="handleUpdateMemberRoles"
            @remove="handleRemoveMember"
          />
        </template>

        <template #roles>
          <RolesList
            :roles="roles"
            :permissions="permissions"
            :roles-permissions="rolesPermissions"
            :goal-id="projectId"
            :loading="loading"
            @create="handleCreateRole"
            @create-template="handleCreateRoleTemplate"
            @toggle-permission="handleTogglePermission"
            @delete="handleDeleteRole"
          />
        </template>
      </UTabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
// import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useCollaborationStore } from '@/stores/collaboration.store'
import { useCollaborationRolesStore } from '@/stores/collaboration-roles.store'
import { useCollaborationPermissionsStore } from '@/stores/collaboration-permissions.store'
import MembersList from './parts/members/MembersList.vue'
import RolesList from './parts/roles/RolesList.vue'
import { useAppRouteInfo } from '@/composables/useAppRouteInfo'
const { t } = useI18n()
const { projectId } = useAppRouteInfo()

const collaborationStore = useCollaborationStore()
const rolesStore = useCollaborationRolesStore()
const permissionsStore = useCollaborationPermissionsStore()

const { users } = storeToRefs(collaborationStore)
const { roles, rolesPermissions } = storeToRefs(rolesStore)
const { permissions } = storeToRefs(permissionsStore)

const activeTab = ref('members')
const loading = ref(false)
const creatingRoleTemplate = ref<string | null>(null)

const hasGoalSelected = computed(() => projectId.value > 0)

const tabs = computed(() => [
  {
    label: t('collaboration.tabs.members'),
    slot: 'members',
    value: 'members',
  },
  {
    label: t('collaboration.tabs.roles'),
    slot: 'roles',
    value: 'roles',
  },
])

async function fetchData() {
  if (!hasGoalSelected.value) {
    return
  }

  loading.value = true
  try {
    await Promise.all([
      collaborationStore.fetchCollaborationUsersForGoal(projectId.value),
      rolesStore.fetchCollaborationRolesForGoal(projectId.value),
      permissionsStore.fetchAllPermissions(),
      rolesStore.fetchAllRolePermissionsForGoal(projectId.value),
    ])
  } finally {
    loading.value = false
  }
}

watch(projectId, () => {
  fetchData()
}, { immediate: true })

async function handleInvite(email: string) {
  await collaborationStore.addCollaborationUser({
    goalId: projectId.value,
    email,
  })
}

async function handleUpdateMemberRoles(data: { userId: number; roles: number[] }) {
  await collaborationStore.toggleUserRole({
    userId: data.userId,
    goalId: projectId.value,
    roles: data.roles,
  })
}

async function handleRemoveMember(userId: number) {
  await collaborationStore.deleteUserFromCollaboration({
    id: userId,
    goalId: projectId.value,
  })
}

async function handleCreateRole(roleName: string) {
  await rolesStore.addCollaborationRole({
    goalId: projectId.value,
    roleName,
  })
}

async function handleCreateRoleTemplate(template: { name: string; permissionNames: string[] }) {
  if (creatingRoleTemplate.value) return
  creatingRoleTemplate.value = template.name
  try {
    const role = await rolesStore.addCollaborationRole({
      goalId: projectId.value,
      roleName: template.name,
    })
    if (!role) return

    const permissionsByName = new Map(permissions.value.map(permission => [permission.name, permission.id]))
    const permissionIds = [...new Set(template.permissionNames)]
      .map(name => permissionsByName.get(name))
      .filter((id): id is number => id !== undefined)

    for (const permissionId of permissionIds) {
      await rolesStore.togglePermissionForRole({ roleId: role.id, permissionId })
    }
  } finally {
    creatingRoleTemplate.value = null
  }
}

async function handleTogglePermission(data: { roleId: number; permissionId: number }) {
  await rolesStore.togglePermissionForRole({
    roleId: data.roleId,
    permissionId: data.permissionId,
  })
}

async function handleDeleteRole(roleId: number) {
  await rolesStore.deleteCollaborationRole({
    id: roleId,
    goalId: projectId.value,
  })
}
</script>
