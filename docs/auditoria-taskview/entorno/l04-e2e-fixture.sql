\set ON_ERROR_STOP on

BEGIN;

INSERT INTO tv_auth.users (login, email, password, block, confirm_email_code)
SELECT fixture.login, fixture.email, :'password_hash', 0, ''
FROM (VALUES
    ('l04-owner', 'l04-owner@example.invalid'),
    ('l04-reader', 'l04-reader@example.invalid'),
    ('l04-editor', 'l04-editor@example.invalid'),
    ('l04-multi', 'l04-multi@example.invalid'),
    ('l04-noaccess', 'l04-noaccess@example.invalid')
) AS fixture(login, email)
WHERE NOT EXISTS (SELECT 1 FROM tv_auth.users existing WHERE existing.email = fixture.email);

INSERT INTO tv_auth.user_to_groups (user_id, group_id)
SELECT users.id, 1
FROM tv_auth.users users
WHERE users.email LIKE 'l04-%@example.invalid'
ON CONFLICT DO NOTHING;

SELECT id AS owner_id
FROM tv_auth.users
WHERE email = 'l04-owner@example.invalid'
\gset

INSERT INTO tv_auth.organizations (name, slug, owner_id, is_personal)
SELECT 'L04 Synthetic Organization', 'l04-synthetic-org', :owner_id, 0
WHERE NOT EXISTS (SELECT 1 FROM tv_auth.organizations WHERE slug = 'l04-synthetic-org');

SELECT id AS org_id
FROM tv_auth.organizations
WHERE slug = 'l04-synthetic-org'
\gset

INSERT INTO tv_auth.organization_members (organization_id, email, role)
SELECT :org_id, users.email,
       CASE WHEN users.email = 'l04-owner@example.invalid' THEN 'owner' ELSE 'member' END
FROM tv_auth.users users
WHERE users.email LIKE 'l04-%@example.invalid'
  AND NOT EXISTS (
      SELECT 1 FROM tv_auth.organization_members members
      WHERE members.organization_id = :org_id AND members.email = users.email
  );

INSERT INTO tasks.goals (name, description, owner, creator_id, organization_id, estimate_unit)
SELECT 'L04 Synthetic Scrum Project', 'Disposable integration verification project', :owner_id, :owner_id, :org_id, 'points'
WHERE NOT EXISTS (
    SELECT 1 FROM tasks.goals WHERE organization_id = :org_id AND name = 'L04 Synthetic Scrum Project'
);

SELECT id AS goal_id
FROM tasks.goals
WHERE organization_id = :org_id AND name = 'L04 Synthetic Scrum Project'
\gset

INSERT INTO tasks.goal_lists (name, description, goal_id, owner, creator_id)
SELECT 'L04 Synthetic List', 'Disposable integration verification list', :goal_id, :owner_id, :owner_id
WHERE NOT EXISTS (
    SELECT 1 FROM tasks.goal_lists WHERE goal_id = :goal_id AND name = 'L04 Synthetic List'
);

INSERT INTO tasks.statuses (name, goal_id, view_order)
SELECT fixture.name, :goal_id, fixture.view_order
FROM (VALUES ('TODO', 1), ('In Progress', 2), ('Done', 3)) AS fixture(name, view_order)
WHERE NOT EXISTS (
    SELECT 1 FROM tasks.statuses existing
    WHERE existing.goal_id = :goal_id AND existing.name = fixture.name
);

INSERT INTO tasks.sprints (goal_id, name, goal_text, status, start_date, end_date, capacity, creator_id)
SELECT :goal_id, 'L04 Synthetic Sprint', 'Validate Lista 04 integration', 'planned', CURRENT_DATE, CURRENT_DATE + 14, 40, :owner_id
WHERE NOT EXISTS (
    SELECT 1 FROM tasks.sprints WHERE goal_id = :goal_id AND name = 'L04 Synthetic Sprint'
);

INSERT INTO collaboration.users (email)
SELECT users.email
FROM tv_auth.users users
WHERE users.email LIKE 'l04-%@example.invalid'
  AND NOT EXISTS (SELECT 1 FROM collaboration.users existing WHERE existing.email = users.email);

INSERT INTO collaboration.users_to_goals (goal_id, user_id)
SELECT :goal_id, collaborators.id
FROM collaboration.users collaborators
WHERE collaborators.email IN (
    'l04-reader@example.invalid',
    'l04-editor@example.invalid',
    'l04-multi@example.invalid'
)
  AND NOT EXISTS (
      SELECT 1 FROM collaboration.users_to_goals existing
      WHERE existing.goal_id = :goal_id AND existing.user_id = collaborators.id
  );

INSERT INTO collaboration.roles (name, goal_id)
SELECT fixture.name, :goal_id
FROM (VALUES ('l04-reader'), ('l04-editor'), ('l04-executor')) AS fixture(name)
WHERE NOT EXISTS (
    SELECT 1 FROM collaboration.roles existing
    WHERE existing.goal_id = :goal_id AND existing.name = fixture.name
);

INSERT INTO collaboration.permissions_to_role (role_id, permission_id)
SELECT roles.id, permissions.id
FROM collaboration.roles roles
JOIN tv_auth.permissions permissions ON permissions.name = ANY (
    CASE roles.name
        WHEN 'l04-reader' THEN ARRAY[
            'component_can_watch_content', 'task_can_watch_details', 'task_can_watch_subtasks',
            'task_can_watch_priority', 'task_can_access_history', 'goal_can_watch_content',
            'task_can_watch_note', 'task_can_watch_assigned_users', 'kanban_can_view', 'sprint_can_view'
        ]::varchar[]
        WHEN 'l04-editor' THEN ARRAY[
            'component_can_delete', 'component_can_edit', 'component_can_watch_content', 'component_can_add_tasks',
            'goal_can_edit', 'goal_can_manage_users', 'task_can_delete', 'task_can_edit_description',
            'task_can_edit_status', 'task_can_edit_note', 'task_can_edit_deadline', 'task_can_watch_details',
            'task_can_watch_subtasks', 'task_can_add_subtasks', 'task_can_edit_tags', 'task_can_watch_tags',
            'task_can_watch_priority', 'task_can_edit_priority', 'task_can_access_history', 'task_can_recovery_history',
            'goal_can_watch_content', 'goal_can_add_task_list', 'task_can_watch_note', 'task_can_assign_users',
            'task_can_watch_assigned_users', 'kanban_can_manage', 'kanban_can_view', 'graph_can_manage',
            'graph_can_view', 'timetracking_can_view', 'timetracking_can_log', 'timetracking_can_manage_all',
            'sprint_can_view', 'sprint_can_manage', 'sprint_can_assign_tasks', 'sprint_can_view_analytics',
            'file_can_view', 'file_can_manage', 'automation_can_view', 'automation_can_manage'
        ]::varchar[]
        WHEN 'l04-executor' THEN ARRAY[
            'component_can_watch_content', 'component_can_add_tasks', 'task_can_watch_details',
            'task_can_watch_subtasks', 'task_can_add_subtasks', 'task_can_watch_tags',
            'task_can_watch_priority', 'task_can_edit_priority', 'task_can_watch_note',
            'task_can_assign_users', 'task_can_watch_assigned_users', 'kanban_can_view',
            'timetracking_can_view', 'timetracking_can_log', 'sprint_can_view',
            'sprint_can_assign_tasks', 'file_can_view', 'automation_can_view'
        ]::varchar[]
        ELSE ARRAY[]::varchar[]
    END
)
WHERE roles.goal_id = :goal_id
  AND roles.name IN ('l04-reader', 'l04-editor', 'l04-executor')
ON CONFLICT DO NOTHING;

INSERT INTO collaboration.users_to_roles (user_id, role_id)
SELECT collaborators.id, roles.id
FROM collaboration.users collaborators
JOIN collaboration.roles roles ON roles.goal_id = :goal_id
WHERE (collaborators.email = 'l04-reader@example.invalid' AND roles.name = 'l04-reader')
   OR (collaborators.email = 'l04-editor@example.invalid' AND roles.name = 'l04-editor')
   OR (collaborators.email = 'l04-multi@example.invalid' AND roles.name IN ('l04-editor', 'l04-executor'))
ON CONFLICT DO NOTHING;

COMMIT;
