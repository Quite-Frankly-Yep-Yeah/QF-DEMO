# frozen_string_literal: true

#
# Copyright (C) 2026 - present quite frankly an example LMS contributors
#
# This file is part of quite frankly an example LMS, a modified version of Canvas.
#
# quite frankly an example LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

# How a parent finds their student to ask the school to link them
# (SelfPaced::LinkRequest). The parent's account is one anybody with the
# flyer can make, so this is deliberately narrow: it takes at least two parts
# of a name (so typing "a" can't list the school), starts each part at the
# beginning of a word, shows a few matches, and gives back only a name. It
# never returns students who are already linked, and only ones in a class the
# observer view covers.
module SelfPaced
  class StudentFinder
    MIN_PART_LENGTH = 2
    MAX_PARTS = 4
    MAX_RESULTS = 8
    # Names are matched in the database first, then checked against their
    # classes, so this bounds the second step.
    MAX_CANDIDATES = 40

    def initialize(observer, root_account)
      @observer = observer
      @root_account = root_account
    end

    # Whether a search string is specific enough to run at all.
    def self.parts(query)
      parts = query.to_s.downcase.scan(/[[:alpha:]'’-]+/)
      return [] if parts.size < 2 || parts.size > MAX_PARTS || parts.any? { |part| part.length < MIN_PART_LENGTH }

      parts
    end

    # { students: [{ id:, name: }], too_many: }, best names first. A search that
    # matches more than a few students shows none of them and says so, so the
    # parent has to type more of the name: that is what stops "ma lo" from
    # listing half the school.
    def search(query)
      parts = self.class.parts(query)
      return { students: [], too_many: false } if parts.empty?

      candidates = parts.reduce(enrolled_students) { |scope, part| scope.where(*word_start(part)) }
                        .where.not(id: excluded_ids).order(:sortable_name).limit(MAX_CANDIDATES).to_a
      viewable = viewable_ids(candidates)
      found = candidates.select { |user| viewable.include?(user.id) }
      # hitting the candidate limit means there were more we never looked at
      return { students: [], too_many: true } if found.size > MAX_RESULTS || candidates.size == MAX_CANDIDATES

      { students: found.map { |user| { id: user.id.to_s, name: user.name } }, too_many: false }
    end

    # Whether +student+ is someone this parent could ask about, by the same
    # rules as a search, so a request can't name a student the search wouldn't
    # have shown.
    def findable?(student)
      return false if excluded_ids.include?(student.id)

      viewable_ids([student]).include?(student.id)
    end

    private

    def enrolled_students
      User.active.where(id: StudentEnrollment.where(root_account_id: @root_account.id, workflow_state: "active").select(:user_id))
    end

    # "maya" matches the start of the name or of any later word in it, including
    # the second half of a hyphenated one.
    def word_start(part)
      like = ActiveRecord::Base.sanitize_sql_like(part)
      ["(LOWER(users.name) LIKE ? OR LOWER(users.name) LIKE ? OR LOWER(users.name) LIKE ?)", "#{like}%", "% #{like}%", "%-#{like}%"]
    end

    def excluded_ids
      @excluded_ids ||= [@observer.id] | ObserverView.new(@observer).linked_student_ids.map(&:to_i)
    end

    def viewable_ids(users)
      StudentEnrollment.where(root_account_id: @root_account.id, workflow_state: "active", user_id: users.map(&:id))
                       .preload(:course)
                       .select { |enrollment| ObserverView.viewable_course?(enrollment.course) }
                       .to_set(&:user_id)
    end
  end
end
