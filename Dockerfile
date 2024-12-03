FROM nginxinc/nginx-unprivileged AS base

USER root

RUN apt-get update && \
    apt-get -y install -qq \
    libhttrack-dev httrack nodejs npm cron unzip curl

# Get AWS CLI V2
RUN set -eux; \
    \
	dpkgArch="$(dpkg --print-architecture)"; \
	case "${dpkgArch##*-}" in \
		amd64) arch='x86_64' ;; \
		armhf) arch='aarch64' ;; \
		arm64) arch='aarch64' ;; \
		*) arch='unimplemented' ; \
			echo >&2; echo >&2 "warning: current architecture ($dpkgArch) does not have a corresponding binary release."; echo >&2 ;; \
	esac; \
    \
    if [ "$arch" = 'unimplemented' ]; then \
        echo >&2; \
        echo >&2 'error: UNIMPLEMENTED'; \
        echo >&2 'TODO install awscli'; \
        echo >&2; \
        exit 1; \
    fi; \
    \
    curl "https://awscli.amazonaws.com/awscli-exe-linux-${arch}.zip" -o "awscli.zip"; \
    unzip awscli.zip; \
    ./aws/install; \
    rm awscli.zip;

ARG user=archiver
ARG uid=1001

RUN addgroup --gid ${uid} ${user} && \
    adduser --disabled-login --disabled-password --ingroup ${user} --home /${user} --gecos "${user} user" --shell /bin/bash --uid ${uid} ${user} && \
    usermod -a -G ${user} nginx && \
    mkdir /usr/lib/cron && \
    echo "${user}" > /usr/lib/cron/cron.allow && \
    echo "${user}" > /etc/cron.allow

COPY src/ /usr/share/nginx/html
COPY conf/node /usr/local/bin/node
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY conf/s3-sync.sh /usr/bin/s3sync
COPY conf/httrack /usr/local/bin/httrack
## -> Copy common entrypoint scripts (for both dev & prod images).
COPY conf/entrypoint/setup-credentials.sh conf/entrypoint/start-cron.sh /docker-entrypoint.d/

## -> make init scripts executable
RUN chmod -R +x /docker-entrypoint.d/ && \
    chmod +x /usr/bin/s3sync

## -> load in httrack configuration
RUN gcc -shared -o /archiver/strip_x_amz_query_param.so -fPIC -I/usr/include/httrack /usr/local/bin/httrack/strip_x_amz_query_param.c

## -> set up user to access the cron
RUN echo "*/10 * * * * /usr/bin/s3-sync >> /archiver/cron.log 2>&1" >> /etc/cron.d/s3-sync-cron && \
    crontab -u ${user} /etc/cron.d/s3-sync-cron && \
    chmod u+s /usr/sbin/cron

RUN touch /${user}/cron.log && \
    chmod 644 /${user}/cron.log



# Create a development image, from the base image.
# The image is used for local development only.
FROM base AS dev

WORKDIR /usr/local/bin/node

COPY conf/entrypoint/start-node-dev.sh /docker-entrypoint.d/
RUN chmod -R +x /docker-entrypoint.d/start-node-dev.sh

RUN mkdir /usr/local/bin/node/node_modules && \
    chown -R ${uid}:${uid} /usr/local/bin/node

ENV NODE_ENV=development

USER ${uid}



# Create a production image, from the base image.
# The image is used for deployment, and can be run locally.
FROM base AS build-prod

WORKDIR /usr/local/bin/node

COPY conf/entrypoint/start-node-prod.sh /docker-entrypoint.d/
RUN chmod -R +x /docker-entrypoint.d/start-node-prod.sh

# Set the environment to production for install & runtime.
ENV NODE_ENV=production

# Install the node modules.
RUN npm ci --only=prod 

# Remove the npm package manager.
RUN apt remove -y curl npm unzip

USER ${uid}
