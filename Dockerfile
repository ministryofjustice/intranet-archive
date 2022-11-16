FROM nginxinc/nginx-unprivileged

USER root

RUN apt-get update && apt-get install -y s3fs httrack nodejs npm

COPY conf/node/ /usr/local/bin
RUN chown -R nginx:nginx /usr/local/bin

ARG user=archiver
ARG uid=1001
RUN addgroup --gid ${uid} ${user} && \
    adduser --disabled-login --disabled-password --ingroup ${user} --home /${user} --gecos "${user} user" --shell /bin/bash --uid ${uid} ${user} && \
    usermod -a -G ${user} nginx

COPY dist/ /usr/share/nginx/html
COPY conf/nginx.conf /etc/nginx/conf.d/default.conf
COPY conf/s3fs-init.sh /docker-entrypoint.d/
COPY conf/start-node.sh /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/start-node.sh

USER ${uid}
