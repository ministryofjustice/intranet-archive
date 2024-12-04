#!/bin/bash

# pm2 will restart the node process on crashed, `--no-daemon` will attach to application log
pm2 start /usr/local/bin/node/server.js --no-daemon &
