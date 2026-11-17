-- Allow an epic to group stories and root technical tasks. Bugs remain linked
-- through related_task_id so they are displayed with the item they affect.
ALTER TABLE tasks.tasks
    DROP CONSTRAINT tasks_epic_story_only,
    ADD CONSTRAINT tasks_epic_story_or_task CHECK (
        epic_id IS NULL OR work_item_type IN ('story', 'task')
    );
