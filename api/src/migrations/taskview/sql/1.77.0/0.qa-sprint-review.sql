CREATE TABLE tasks.qa_reviews (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id integer NOT NULL,
    task_id integer NOT NULL,
    status varchar(16) NOT NULL DEFAULT 'pending',
    evidence varchar,
    validated_by integer REFERENCES tv_auth.users(id) ON DELETE SET NULL,
    validated_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    edited_at timestamp,
    CONSTRAINT qa_reviews_goal_id_id_unique UNIQUE (goal_id, id),
    CONSTRAINT qa_reviews_status_check CHECK (status IN ('pending', 'approved', 'observed')),
    CONSTRAINT qa_reviews_task_same_goal_fk FOREIGN KEY (goal_id, task_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE CASCADE
);

CREATE TABLE tasks.qa_observations (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id integer NOT NULL,
    task_id integer NOT NULL,
    review_id integer NOT NULL,
    note varchar NOT NULL,
    bug_task_id integer,
    created_by integer REFERENCES tv_auth.users(id) ON DELETE SET NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT qa_observations_review_same_goal_fk FOREIGN KEY (goal_id, review_id)
        REFERENCES tasks.qa_reviews(goal_id, id) ON DELETE CASCADE,
    CONSTRAINT qa_observations_task_same_goal_fk FOREIGN KEY (goal_id, task_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE CASCADE,
    CONSTRAINT qa_observations_bug_same_goal_fk FOREIGN KEY (goal_id, bug_task_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE SET NULL
);

ALTER TABLE tasks.sprints
    ADD CONSTRAINT sprints_goal_id_id_unique UNIQUE (goal_id, id);

CREATE TABLE tasks.sprint_review_acceptances (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    goal_id integer NOT NULL,
    sprint_id integer NOT NULL,
    task_id integer NOT NULL,
    status varchar(16) NOT NULL,
    notes varchar,
    reviewed_by integer REFERENCES tv_auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamp NOT NULL DEFAULT now(),
    created_at timestamp NOT NULL DEFAULT now(),
    edited_at timestamp,
    CONSTRAINT sprint_review_acceptances_status_check CHECK (status IN ('accepted', 'observed', 'rejected')),
    CONSTRAINT sprint_review_acceptances_unique UNIQUE (sprint_id, task_id),
    CONSTRAINT sprint_review_acceptances_sprint_same_goal_fk FOREIGN KEY (goal_id, sprint_id)
        REFERENCES tasks.sprints(goal_id, id) ON DELETE CASCADE,
    CONSTRAINT sprint_review_acceptances_task_same_goal_fk FOREIGN KEY (goal_id, task_id)
        REFERENCES tasks.tasks(goal_id, id) ON DELETE CASCADE
);

CREATE INDEX qa_reviews_task_idx ON tasks.qa_reviews(goal_id, task_id, created_at DESC);
CREATE INDEX qa_observations_review_idx ON tasks.qa_observations(goal_id, review_id, created_at);
CREATE INDEX sprint_review_acceptances_sprint_idx ON tasks.sprint_review_acceptances(goal_id, sprint_id, status);
