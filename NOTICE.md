# Notice

## Origin

EXAMPLE is a modified version of Canvas LMS
(<https://github.com/instructure/canvas-lms>), Copyright (C) 2011 - present
Instructure, Inc., licensed under the GNU Affero General Public License,
version 3 (AGPL-3.0).

The original copyright and license notices are retained, unchanged, in the
source files and in the [COPYRIGHT](COPYRIGHT) and [LICENSE](LICENSE) files, as
the AGPL requires.

## Modifications

This version has been modified from the original (AGPL-3.0 section 5(a)).
Modified on: 2026-09-20.

The user-visible product name, documentation, and interface text were changed
from "Canvas" to "EXAMPLE". Internal identifiers were left as they are, so that
existing plugins, LTI tools, and API clients keep working. These include:

- the Ruby `Canvas` module and `canvas_*` gems
- `@canvas/*` JavaScript packages
- LTI custom variable names (`$Canvas.*`)
- REST API paths and plugin interfaces
- JWT issuer values and other protocol values

## Trademarks

EXAMPLE is not affiliated with, endorsed by, or sponsored by Instructure, Inc.
"Canvas" and "Instructure" are trademarks of Instructure, Inc. They are used
here only to describe the origin and compatibility of this software.

## Network use (AGPL-3.0 section 13)

If you run a modified version of this software and let others interact with it
over a network, you must offer those users the Corresponding Source of your
modified version.
