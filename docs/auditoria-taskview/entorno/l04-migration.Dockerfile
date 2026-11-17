FROM taskview-l01-migration:b5a7e65
COPY ./dist-migration/taskview/ /app-migration/taskview/
COPY ./dist-migration/taskview-db-migration.js /app-migration/taskview-db-migration.js
