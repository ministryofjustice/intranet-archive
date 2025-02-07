#!/usr/bin/env bash

DOTS="\n \033[0;32m***\033[0m"

echo -e "${DOTS} ${DOTS} Checking Dory... ${DOTS}\n"
chmod +x ./bin/dory-start.sh && ./bin/dory-start.sh

echo -e "${DOTS} ${DOTS} Firing the application up... ${DOTS}\n"

# bring docker online (background)
docker compose up -d
