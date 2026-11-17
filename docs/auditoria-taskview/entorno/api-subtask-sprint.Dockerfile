# Lab-only API overlay. It keeps the currently verified lab runtime base and
# replaces only the compiled application bundle; it does not run migrations.
FROM taskview-l01-api:subtask-sprint-20261116
COPY ./dist/ /usr/src/app/
