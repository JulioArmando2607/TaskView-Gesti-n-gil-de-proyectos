CREATE TABLE tasks.scrum_epics (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id integer NOT NULL REFERENCES tasks.goals(id) ON DELETE CASCADE,
    title varchar NOT NULL,
    details varchar,
    archived boolean NOT NULL DEFAULT false,
    creator_id integer REFERENCES tv_auth.users(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    edited_at timestamp,
    CONSTRAINT scrum_epics_goal_id_id_unique UNIQUE (goal_id, id)
);

ALTER TABLE tasks.tasks
    ADD COLUMN work_item_type varchar(16) NOT NULL DEFAULT 'task',
    ADD COLUMN epic_id integer,
    ADD COLUMN acceptance_criteria varchar,
    ADD COLUMN related_task_id integer;

CREATE UNIQUE INDEX tasks_tasks_id_goal_unique ON tasks.tasks(goal_id, id);

ALTER TABLE tasks.tasks
    ADD CONSTRAINT tasks_work_item_type_check CHECK (work_item_type IN ('task', 'story', 'bug')),
    ADD CONSTRAINT tasks_epic_story_only CHECK (epic_id IS NULL OR work_item_type = 'story'),
    ADD CONSTRAINT tasks_related_item_bug_only CHECK (related_task_id IS NULL OR (work_item_type = 'bug' AND related_task_id <> id)),
    ADD CONSTRAINT tasks_parent_same_goal_fk FOREIGN KEY (goal_id, parent_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    ADD CONSTRAINT tasks_epic_same_goal_fk FOREIGN KEY (goal_id, epic_id)
        REFERENCES tasks.scrum_epics(goal_id, id) ON DELETE SET NULL (epic_id),
    ADD CONSTRAINT tasks_related_task_same_goal_fk FOREIGN KEY (goal_id, related_task_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE SET NULL (related_task_id);

CREATE INDEX scrum_epics_goal_active_idx ON tasks.scrum_epics(goal_id, archived, id);
CREATE INDEX tasks_work_item_type_goal_idx ON tasks.tasks(goal_id, work_item_type, id);
CREATE INDEX tasks_epic_id_idx ON tasks.tasks(epic_id) WHERE epic_id IS NOT NULL;
CREATE INDEX tasks_related_task_id_idx ON tasks.tasks(related_task_id) WHERE related_task_id IS NOT NULL;
