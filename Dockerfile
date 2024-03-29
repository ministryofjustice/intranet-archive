FROM nginxinc/nginx-unprivileged

USER root

RUN apt-get update && apt-get -y install -qq libhttrack-dev httrack nodejs npm cron unzip curl

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

## nginx user uid=101
COPY --chown=101:101 conf/node /usr/local/bin

ARG user=archiver
ARG uid=1001
RUN addgroup --gid ${uid} ${user} && \
    adduser --disabled-login --disabled-password --ingroup ${user} --home /${user} --gecos "${user} user" --shell /bin/bash --uid ${uid} ${user} && \
    usermod -a -G ${user} nginx && \
    mkdir /usr/lib/cron && \
    echo "${user}" > /usr/lib/cron/cron.allow && \
    echo "${user}" > /etc/cron.allow

COPY src/ /usr/share/nginx/html
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY conf/entrypoint/ /docker-entrypoint.d
COPY conf/s3-sync.sh /usr/bin/s3sync
COPY conf/httrack /usr/local/bin/httrack

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

RUN apt remove -y unzip curl

USER ${uid}
