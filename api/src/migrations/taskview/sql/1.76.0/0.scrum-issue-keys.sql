-- Stable, project-scoped public references. Technical identity columns remain unchanged.
ALTER TABLE tasks.tasks ADD COLUMN issue_key varchar(40) DEFAULT '';
ALTER TABLE tasks.scrum_epics ADD COLUMN issue_key varchar(40) DEFAULT '';

CREATE TABLE tasks.scrum_issue_sequences (
    goal_id integer PRIMARY KEY REFERENCES tasks.goals(id) ON DELETE CASCADE,
    last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0)
);

-- Existing projects use an immutable derived prefix P<goal id>; historical rows are
-- ordered deterministically and never receive a new technical ID. The backfill is
-- metadata-only: suspend user triggers so legacy edit/history triggers do not turn
-- key allocation into a user-visible task edit.
ALTER TABLE tasks.tasks DISABLE TRIGGER USER;
ALTER TABLE tasks.scrum_epics DISABLE TRIGGER USER;

WITH ranked AS (
    SELECT kind, item_id, goal_id,
           row_number() OVER (PARTITION BY goal_id ORDER BY created_at NULLS FIRST, kind, item_id) AS seq
    FROM (
        SELECT 0 AS kind, id AS item_id, goal_id, date_creation AS created_at FROM tasks.tasks
        UNION ALL
        SELECT 1 AS kind, id AS item_id, goal_id, created_at FROM tasks.scrum_epics
    ) all_items
)
UPDATE tasks.tasks t
SET issue_key = 'P' || t.goal_id || '-' || ranked.seq
FROM ranked
WHERE ranked.kind = 0 AND ranked.item_id = t.id;

WITH ranked AS (
    SELECT kind, item_id, goal_id,
           row_number() OVER (PARTITION BY goal_id ORDER BY created_at NULLS FIRST, kind, item_id) AS seq
    FROM (
        SELECT 0 AS kind, id AS item_id, goal_id, date_creation AS created_at FROM tasks.tasks
        UNION ALL
        SELECT 1 AS kind, id AS item_id, goal_id, created_at FROM tasks.scrum_epics
    ) all_items
)
UPDATE tasks.scrum_epics e
SET issue_key = 'P' || e.goal_id || '-' || ranked.seq
FROM ranked
WHERE ranked.kind = 1 AND ranked.item_id = e.id;

ALTER TABLE tasks.tasks ENABLE TRIGGER USER;
ALTER TABLE tasks.scrum_epics ENABLE TRIGGER USER;

INSERT INTO tasks.scrum_issue_sequences(goal_id, last_value)
SELECT g.id, coalesce(max(x.seq), 0)
FROM tasks.goals g
LEFT JOIN (
    SELECT goal_id, max(substring(issue_key from '-([0-9]+)$')::bigint) AS seq
    FROM (
        SELECT goal_id, issue_key FROM tasks.tasks
        UNION ALL
        SELECT goal_id, issue_key FROM tasks.scrum_epics
    ) all_keys
    GROUP BY goal_id
) x ON x.goal_id = g.id
GROUP BY g.id, x.seq;

ALTER TABLE tasks.tasks ALTER COLUMN issue_key SET NOT NULL;
ALTER TABLE tasks.scrum_epics ALTER COLUMN issue_key SET NOT NULL;
ALTER TABLE tasks.tasks ADD CONSTRAINT tasks_issue_key_format CHECK (issue_key ~ '^P[1-9][0-9]*-[1-9][0-9]*$');
ALTER TABLE tasks.scrum_epics ADD CONSTRAINT scrum_epics_issue_key_format CHECK (issue_key ~ '^P[1-9][0-9]*-[1-9][0-9]*$');
CREATE UNIQUE INDEX tasks_goal_issue_key_unique ON tasks.tasks(goal_id, issue_key);
CREATE UNIQUE INDEX scrum_epics_goal_issue_key_unique ON tasks.scrum_epics(goal_id, issue_key);

CREATE OR REPLACE FUNCTION tasks.assign_scrum_issue_key()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    next_key bigint;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.goal_id = OLD.goal_id THEN
        RETURN NEW;
    END IF;
    INSERT INTO tasks.scrum_issue_sequences(goal_id, last_value)
    VALUES (NEW.goal_id, 0)
    ON CONFLICT (goal_id) DO NOTHING;
    UPDATE tasks.scrum_issue_sequences
    SET last_value = last_value + 1
    WHERE goal_id = NEW.goal_id
    RETURNING last_value INTO next_key;
    NEW.issue_key := 'P' || NEW.goal_id || '-' || next_key;
    RETURN NEW;
END $$;

-- Trigger names sort after before_insert_set_goal_id_for_task, so legacy inserts
-- that derive goal_id from goal_list_id receive their project before key allocation.
CREATE TRIGGER zz_assign_tasks_scrum_issue_key
BEFORE INSERT OR UPDATE OF goal_id ON tasks.tasks
FOR EACH ROW EXECUTE FUNCTION tasks.assign_scrum_issue_key();
CREATE TRIGGER zz_assign_epics_scrum_issue_key
BEFORE INSERT OR UPDATE OF goal_id ON tasks.scrum_epics
FOR EACH ROW EXECUTE FUNCTION tasks.assign_scrum_issue_key();
