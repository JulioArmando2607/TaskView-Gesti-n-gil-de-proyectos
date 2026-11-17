-- Add a project-scoped testing stage before Done, preserving existing status order.
WITH goals_missing_testing AS (
    SELECT
        g.id AS goal_id,
        COALESCE(
            MIN(done.view_order),
            MAX(status.view_order) + 1,
            1
        ) AS testing_order
    FROM tasks.goals g
    LEFT JOIN tasks.statuses status ON status.goal_id = g.id
    LEFT JOIN tasks.statuses done ON done.goal_id = g.id AND LOWER(done.name) = 'done'
    WHERE NOT EXISTS (
        SELECT 1
        FROM tasks.statuses existing
        WHERE existing.goal_id = g.id AND LOWER(existing.name) = 'testing'
    )
    GROUP BY g.id
)
UPDATE tasks.statuses status
SET view_order = status.view_order + 1
FROM goals_missing_testing missing
WHERE status.goal_id = missing.goal_id
  AND status.view_order >= missing.testing_order;

INSERT INTO tasks.statuses (name, goal_id, view_order)
SELECT
    'Testing',
    g.id,
    COALESCE(
        (SELECT MIN(done.view_order) - 1 FROM tasks.statuses done WHERE done.goal_id = g.id AND LOWER(done.name) = 'done'),
        (SELECT MAX(status.view_order) FROM tasks.statuses status WHERE status.goal_id = g.id),
        0
    )
FROM tasks.goals g
WHERE NOT EXISTS (
    SELECT 1
    FROM tasks.statuses existing
    WHERE existing.goal_id = g.id AND LOWER(existing.name) = 'testing'
);

-- The status-order trigger assigns new statuses to the end, so place Testing
-- immediately before Done after the insert has completed.
UPDATE tasks.statuses testing
SET view_order = done.view_order - 1
FROM tasks.statuses done
WHERE testing.goal_id = done.goal_id
  AND LOWER(testing.name) = 'testing'
  AND LOWER(done.name) = 'done'
  AND testing.view_order > done.view_order;

-- Existing cards already placed in Done must also contribute to parent progress.
UPDATE tasks.tasks task
SET complete = TRUE
WHERE task.complete = FALSE
  AND task.status_id IN (
      SELECT status.id
      FROM tasks.statuses status
      WHERE LOWER(status.name) = 'done'
  );

-- New projects get the same Scrum-ready default workflow.
CREATE OR REPLACE FUNCTION tasks.kanban_add_default_columns()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tasks.statuses (name, goal_id, view_order)
    VALUES
        ('TODO', NEW.id, 1),
        ('In Progress', NEW.id, 2),
        ('Testing', NEW.id, 3),
        ('Done', NEW.id, 4);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
