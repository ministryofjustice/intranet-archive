FROM nginxinc/nginx-unprivileged

USER root

RUN apt-get update && apt-get install -y httrack nodejs npm pip cron
RUN pip install awscli

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

COPY dist/ /usr/share/nginx/html
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY conf/entrypoint/ /docker-entrypoint.d
COPY conf/s3-sync.sh /usr/bin/

## -> make init scripts executable
RUN chmod -R +x /docker-entrypoint.d/ && \
    chmod +x /usr/bin/s3-sync.sh

## -> set up our user to access the cron
RUN echo "*/10 * * * * /usr/bin/s3-sync.sh >/dev/null 2>&1" >> /etc/cron.d/s3-sync-cron && \
    crontab -u ${user} /etc/cron.d/s3-sync-cron && \
    chmod u+s /usr/sbin/cron

USER ${uid}
