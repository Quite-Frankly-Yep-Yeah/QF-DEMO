#!/bin/sh
export CANVAS_WEBPACK_START_HOOK='notify-send "Build Started" "EXAMPLE Webpack build started"'
export CANVAS_WEBPACK_FAILED_HOOK='notify-send "Build Error" "EXAMPLE Webpack build failed\"'
export CANVAS_WEBPACK_DONE_HOOK='notify-send "Build Finished" "EXAMPLE Webpack build finished"'
