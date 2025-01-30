FROM node:23-bookworm-slim AS base

ENV TZ="Europe/London"

RUN apt-get update && \
    apt-get -y install -qq \
    httrack

COPY conf/node /home/node/app

WORKDIR /home/node/app



# Create a development image, from the base image.
# The image is used for local development only.
FROM base AS dev

COPY conf/entrypoint/start-node-dev.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod -R +x  /usr/local/bin/docker-entrypoint.sh

RUN mkdir /home/node/app/node_modules && \
    chown -R node:node /home/node/app

ENV NODE_ENV=development

USER node

CMD []



# Create a production image, from the base image.
# The image is used for deployment, and can be run locally.
FROM base AS build-prod

# Set the environment to production for install & runtime.
ENV NODE_ENV=production

# Install the node modules.
RUN npm ci --only=prod

USER node

# Execute NodeJS (not NPM script) to handle SIGTERM and SIGINT signals.
CMD ["node", "./server.js"]
