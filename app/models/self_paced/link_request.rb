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

# A parent's request to be linked to a student (docs/fork-plan.md Phase 8).
# Parents who sign up from the school's flyer can't see anyone until the school
# says the link is right, so the request waits here for an admin. Approving
# makes Canvas's own observation link, exactly as if the admin had made it on
# the People page.
module SelfPaced
  class LinkRequest < ApplicationRecord
    self.table_name = "self_paced_link_requests"

    STATES = %w[pending approved declined cancelled].freeze
    NOTE_LIMIT = 300
    MAX_PENDING = 5
    CLASSES_SHOWN = 4

    # A request that can't be made, with something to tell the parent.
    class Refused < StandardError; end

    belongs_to :root_account, class_name: "Account"
    belongs_to :observer, class_name: "User"
    belongs_to :student, class_name: "User"
    belongs_to :decided_by, class_name: "User", optional: true

    validates :workflow_state, inclusion: { in: STATES }
    validates :note, :response, length: { maximum: NOTE_LIMIT }

    scope :pending, -> { where(workflow_state: "pending") }

    # Records that +observer+ is asking for +student+. Refuses when the answer
    # would be pointless: they are already linked, they already asked, or they
    # are asking about themselves or about too many students at once.
    def self.ask!(observer:, student:, root_account:, note: nil)
      raise Refused, I18n.t("You can't follow yourself.") if observer.id == student.id

      if UserObservationLink.active.where(observer:, student:).for_root_accounts(root_account).exists?
        raise Refused, I18n.t("You already follow %{student}.", student: student.name)
      end
      raise Refused, I18n.t("You've already asked to follow %{student}.", student: student.name) if pending.where(observer:, student:).exists?
      raise Refused, I18n.t("You have %{count} requests waiting. Wait for the school to answer some of them first.", count: MAX_PENDING) if pending.where(observer:).count >= MAX_PENDING

      create!(root_account:, observer:, student:, note: note.to_s.strip.presence)
    rescue ActiveRecord::RecordNotUnique
      raise Refused, I18n.t("You've already asked to follow %{student}.", student: student.name)
    rescue ActiveRecord::RecordInvalid => e
      raise Refused, e.record.errors.full_messages.to_sentence
    end

    def pending?
      workflow_state == "pending"
    end

    # Makes the link and closes the request. Does nothing if someone else got
    # to it first, so two admins can't fight over one request.
    def approve!(admin, now = Time.zone.now)
      transaction do
        lock!
        next unless pending?

        UserObservationLink.create_or_restore(student:, observer:, root_account:)
        update!(workflow_state: "approved", decided_by: admin, decided_at: now, response: nil)
      end
      self
    end

    # +response+ is shown to the parent, so an admin can say why.
    def decline!(admin, response = nil, now = Time.zone.now)
      transaction do
        lock!
        next unless pending?

        update!(workflow_state: "declined", decided_by: admin, decided_at: now, response: response.to_s.strip.presence)
      end
      self
    end

    # The parent changed their mind.
    def cancel!(now = Time.zone.now)
      transaction do
        lock!
        next unless pending?

        update!(workflow_state: "cancelled", decided_at: now)
      end
      self
    end

    # What the parent sees about their own request.
    def as_json_for_observer
      {
        id: id.to_s,
        status: workflow_state,
        student: { id: student_id.to_s, name: student.name },
        note:,
        response:,
        created_at: created_at.iso8601,
        decided_at: decided_at&.iso8601
      }
    end

    # The admin's rows, for a batch of requests. The parent's name and email,
    # the student's classes and how many parents the student already has are
    # what an admin needs to decide, and are loaded for the whole batch at
    # once.
    def self.admin_json(requests)
      requests = requests.to_a
      ActiveRecord::Associations::Preloader.new(records: requests, associations: %i[observer student decided_by]).call
      student_ids = requests.map(&:student_id).uniq

      classes = StudentEnrollment.where(workflow_state: "active", user_id: student_ids).preload(:course)
                                 .group_by(&:user_id)
      parents = UserObservationLink.active.where(user_id: student_ids).group(:user_id).count

      requests.map do |request|
        student_classes = classes.fetch(request.student_id, []).filter_map { |e| e.course&.name }.uniq
        request.as_json_for_observer.merge(
          observer: { id: request.observer_id.to_s, name: request.observer.name, email: request.observer.email },
          student: {
            id: request.student_id.to_s,
            name: request.student.name,
            classes: student_classes.first(CLASSES_SHOWN),
            parents: parents.fetch(request.student_id, 0)
          },
          decided_by: request.decided_by&.name
        )
      end
    end
  end
end
