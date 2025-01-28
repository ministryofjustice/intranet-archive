#!/bin/bash

# If there is a command, then run it and exit - used for running custom commands, i.e. CI.
if [ "$1" ]; then
  exec "$@"
  exit
fi

DOTS="\n \033[0;32m***\033[0m"

echo -e "${DOTS} ${DOTS} Grabbing dependencies for node... ${DOTS}\n"

# Install dependencies.
npm install

echo -e "${DOTS} ${DOTS} Running dev server ${DOTS}\n"

# Start the server in watch mode with the `dev` script.
npm run dev
