/*
 * Copyright (C) 2016 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// Listens for the postMessages that embedded content (discussions shown in
// SpeedGrader) uses to ask SpeedGrader to switch views or move focus.

// @ts-expect-error
function setup(EG, speedGraderWindow = window) {
  // @ts-expect-error
  function onMessage(e) {
    const message = e.data
    const prevButton = document.getElementById('prev-student-button')

    if (
      message &&
      message.subject &&
      message.subject.startsWith('SG.switchToFullContext&entryId=')
    ) {
      return EG.renderSubmissionPreview(
        'iframe',
        'discussion_view_with_context',
        message.subject.split('=')[1],
      )
    }
    switch (message?.subject) {
      case 'SG.focusPreviousStudentButton':
        if (prevButton) {
          return prevButton.focus()
        }
      /* falls through */
      case 'SG.switchToIndividualPosts':
        EG.renderSubmissionPreview('iframe', 'discussion_view_no_context')
        EG.clearDiscussionsNavigation()
        return
      /* falls through */
      case 'SG.switchToFullContext':
        EG.renderSubmissionPreview('iframe', 'discussion_view_with_context')
        EG.renderDiscussionsNavigation('discussion_view_with_context')
        return
      /* falls through */
      case 'SG.commentKeyPress':
        EG.addCommentTextAreaFocus()
        return
      /* falls through */
      case 'SG.gradeKeyPress':
        EG.gradeFocus()
        return
      /* falls through */
    }
  }

  speedGraderWindow.addEventListener('message', onMessage)

  // expose for testing
  return {onMessage}
}

export default {setup}
