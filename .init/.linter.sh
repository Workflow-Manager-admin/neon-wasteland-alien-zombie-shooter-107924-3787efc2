#!/bin/bash
cd /home/kavia/workspace/code-generation/neon-wasteland-alien-zombie-shooter-107924-3787efc2/frontend_web
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

