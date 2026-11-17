# Lista 01 only: overlay the verified local API bundle on the existing
# laboratory image. No dependency install, migration, container replacement,
# or connection to an external service occurs during this build.
FROM taskview-l01-api:b5a7e65
COPY ./dist/ /usr/src/app/
