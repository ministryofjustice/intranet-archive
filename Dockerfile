FROM nginxinc/nginx-unprivileged

USER root

RUN apt-get update && apt-get install -y s3fs httrack

ARG user=archiver
ARG uid=102
RUN addgroup --system --gid ${uid} ${user} && \
    adduser --system --disabled-login --ingroup ${user} --home /${user} --gecos "${user} user" --shell /bin/bash --uid ${uid} ${user} && \
    usermod -a -G ${user} nginx && \
    chmod -c g+w /archiver

USER nginx

COPY dist/ /usr/share/nginx/html
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY conf/s3fs-init.sh /docker-entrypoint.d/
COPY conf/start-node.sh /docker-entrypoint.d/
