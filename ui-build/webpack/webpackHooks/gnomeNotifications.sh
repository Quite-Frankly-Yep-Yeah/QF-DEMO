#!/bin/sh
export CANVAS_WEBPACK_START_HOOK='notify-send "Build Started" "quite frankly an example LMS Webpack build started"'
export CANVAS_WEBPACK_FAILED_HOOK='notify-send "Build Error" "quite frankly an example LMS Webpack build failed\"'
export CANVAS_WEBPACK_DONE_HOOK='notify-send "Build Finished" "quite frankly an example LMS Webpack build finished"'
