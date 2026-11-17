# Lista 02 laboratory image: install only the locally built API bundle.
# The base image supplies the already installed runtime dependencies.
FROM taskview-l01-api:b5a7e65
COPY ./dist/ /usr/src/app/
