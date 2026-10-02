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

# Proposes the student an IEP belongs to, from the name and the student ID
# printed on it. It only proposes: a person confirms every match. Candidates
# are limited to the students the viewer may manage (Supports::StudentSearch).
#
# Ranking is a student ID (SIS user ID or login ID) equal to the one on the
# document, then a name equal as a set of words, then a partial name. The
# state is "confident" only when one student matches by ID and the name does
# not point to someone else, or no ID is printed and exactly one student has
# the exact name. Anything that could be wrong is "ambiguous", and no
# candidate at all is "none".
module Supports
  class StudentMatcher
    MAX_CANDIDATES = 5
    POOL = 200

    Match = Struct.new(:state, :candidates, :student_id_on_doc) do
      def to_h
        { "state" => state, "candidates" => candidates, "student_id_on_doc" => student_id_on_doc }
      end
    end

    def initialize(viewer, root_account)
      @search = StudentSearch.new(viewer, root_account)
    end

    def call(name:, student_id:)
      id = student_id.to_s.strip.presence
      name = name.to_s.strip.presence
      return Match.new("none", [], id) if @search.scope.none? || (id.nil? && name.nil?)

      by_id = id ? matching_id(id) : []
      all_words, any_word = name ? matching_name(name) : [[], []]
      by_name = all_words.select { |user| NameMatch.exact?(name, user.name) }
      partial = (all_words + any_word).uniq(&:id).select { |user| NameMatch.partial?(name, user.name) && !by_name.include?(user) }
      saturated = all_words.size >= POOL

      ranked = (by_id.map { |u| [u, "id"] } + by_name.map { |u| [u, "name"] } + partial.map { |u| [u, "partial"] })
               .uniq { |user, _| user.id }
      sis_ids = @search.sis_user_ids(ranked.map(&:first))
      candidates = ranked.first(MAX_CANDIDATES).map do |user, reason|
        { "id" => user.id.to_s, "name" => user.name, "sis_user_id" => sis_ids[user.id], "reason" => reason }
      end
      state = state_for(id:, name:, by_id:, by_name:, any: ranked.any?)
      # more students share these words than were looked at, so a unique exact name can't be told
      state = "ambiguous" if saturated && state == "confident"
      Match.new(state, candidates, id)
    end

    private

    def state_for(id:, name:, by_id:, by_name:, any:)
      return "none" unless any

      if id && by_id.size == 1
        user = by_id.first
        agrees = name.nil? || NameMatch.exact?(name, user.name) || NameMatch.partial?(name, user.name)
        points_elsewhere = by_name.any? { |other| other.id != user.id }
        (agrees && !points_elsewhere) ? "confident" : "ambiguous"
      elsif id.nil? && by_name.size == 1
        "confident"
      else
        "ambiguous"
      end
    end

    def matching_id(id)
      logins = @search.school_logins.where("LOWER(pseudonyms.sis_user_id) = :id OR LOWER(pseudonyms.unique_id) = :id", id: id.downcase)
      @search.scope.where(id: logins.select(:user_id)).order(:sortable_name, :id).to_a
    end

    # [students whose name has every one of the document's words, students with any of them].
    # Only the first can hold an exact name, so it is what decides confidence; if it fills the
    # pool some students were not looked at.
    def matching_name(name)
      words = NameMatch.words(name).select { |word| word.length >= 2 }.uniq
      return [[], []] if words.empty?

      likes = words.map { |word| User.where(User.wildcard("users.name", word, type: :full)) }
      every = @search.scope.merge(likes.reduce(:and)).order(:sortable_name, :id).limit(POOL).to_a
      any = @search.scope.merge(likes.reduce(:or)).order(:sortable_name, :id).limit(POOL).to_a
      [every, any]
    end
  end
end
