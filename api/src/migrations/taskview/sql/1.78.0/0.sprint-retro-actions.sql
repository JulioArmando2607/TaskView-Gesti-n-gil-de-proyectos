CREATE TABLE tasks.sprint_retro_actions (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sprint_id integer NOT NULL REFERENCES tasks.sprints(id) ON DELETE CASCADE,
    description text NOT NULL,
    owner integer REFERENCES tv_auth.users(id) ON DELETE SET NULL,
    status varchar(20) NOT NULL DEFAULT 'planned',
    created_at timestamp NOT NULL DEFAULT now(),
    edited_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT sprint_retro_actions_status_check CHECK (status IN ('planned', 'in_progress', 'done')),
    CONSTRAINT sprint_retro_actions_sprint_id_id_unique UNIQUE (sprint_id, id)
);
CREATE INDEX sprint_retro_actions_sprint_idx ON tasks.sprint_retro_actions(sprint_id, status);
