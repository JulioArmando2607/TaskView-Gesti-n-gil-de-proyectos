# Reuse the laboratory migration runtime and install the freshly built bundle.
FROM taskview-l01-migration:b5a7e65
COPY ./dist-migration/ /app-migration/
