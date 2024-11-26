#!/bin/bash

DOTS="\n \033[0;32m***\033[0m"

echo -e "${DOTS} ${DOTS} Grabbing dependencies for node... ${DOTS}\n"

# Install dependencies.
npm install

echo -e "${DOTS} ${DOTS} Running dev server ${DOTS}\n"

# Start the server in watch mode with the `dev` script.
npm run dev &
