#!/usr/bin/env bash

DOTS="\n \033[0;32m***\033[0m"

echo -e "${DOTS} ${DOTS} Checking Dory... ${DOTS}\n"
chmod +x ./bin/dory-start.sh && ./bin/dory-start.sh

echo -e "${DOTS} ${DOTS} Firing the website up... ${DOTS}\n"

# bring docker online (background)
docker compose up -d

echo -e "${DOTS} ${DOTS} Starting S3FS... ${DOTS}\n"
docker compose exec spider /usr/sbin/s3fs-init.sh

# launch in browser
echo -e "${DOTS} ${DOTS} Launching your default browser... ${DOTS}\n"
sleep 2
python -m webbrowser http://spider.intranet.docker
