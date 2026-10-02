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

# Words in a person's name, for comparing a name on a document with a name in
# the school's records. Order, case, punctuation and a middle name don't matter.
module Supports
  module NameMatch
    module_function

    # Lowercased alphabetic words: "Student, Pat Q." is %w[student pat q].
    def words(text)
      text.to_s.downcase.scan(/[[:alpha:]]+/)
    end

    # The same words, in any order.
    def exact?(first, second)
      a = words(first).to_set
      b = words(second).to_set
      a.any? && a == b
    end

    # One name's words are inside the other's, but they are not the same.
    def partial?(first, second)
      a = words(first).to_set
      b = words(second).to_set
      return false if a.empty? || b.empty? || a == b

      a.subset?(b) || b.subset?(a)
    end
  end
end
