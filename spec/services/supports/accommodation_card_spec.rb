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

describe Supports::AccommodationCard do
  let_once(:root_account) { Account.default }
  let_once(:school) { root_account.sub_accounts.create!(name: "Lincoln High") }
  let_once(:math) { course_factory(account: school, active_all: true, course_name: "Math") }
  let_once(:english) { course_factory(account: school, active_all: true, course_name: "English") }
  let_once(:student) do
    student_in_course(course: math, active_all: true).user.tap do |user|
      english.enroll_student(user, enrollment_state: "active")
    end
  end
  let_once(:math_teacher) { teacher_in_course(course: math, active_all: true).user }
  let_once(:catalog) do
    Supports::Catalog.ensure_defaults!(root_account)
    Supports::AccommodationType.where(root_account:).index_by(&:kind)
  end
  let_once(:plan) do
    Supports::Plan.create!(account: school, student:, plan_type: "504", start_date: 1.month.ago.to_date)
  end

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    plan.accommodations.create!(accommodation_type: catalog["extended_time"], parameters: { multiplier: 1.5 },
                                teacher_note: "Seat near the front")
    plan.accommodations.create!(accommodation_type: catalog["informational"], course_ids: [english.id])
  end

  let(:card) { described_class.new(math_teacher, student, root_account) }

  describe "#as_json" do
    it "shows a teacher the accommodations for the courses they teach" do
      names = card.as_json[:accommodations].pluck(:name)
      expect(names).to eql ["Extended time on tests and quizzes"]
    end

    it "includes the teacher note and plain-language details, but not the plan type" do
      row = card.as_json[:accommodations].first
      expect(row[:teacher_note]).to eql "Seat near the front"
      expect(row[:details]).to eql "1.5x time on timed quizzes"
      expect(card.as_json.to_json).not_to include "504"
    end

    it "is nil for someone who doesn't teach the student" do
      stranger = teacher_in_course(course: course_factory(account: school, active_all: true), active_all: true).user
      expect(described_class.new(stranger, student, root_account).as_json).to be_nil
    end

    it "leaves out accommodations that haven't started or have ended" do
      plan.accommodations.create!(accommodation_type: catalog["extra_attempts"], parameters: { attempts: 1 },
                                  end_date: 1.day.ago.to_date)
      expect(card.as_json[:accommodations].size).to be 1
    end
  end

  describe "#acknowledge!" do
    it "records the teacher's acknowledgement of the current version" do
      card.acknowledge!
      expect(described_class.new(math_teacher, student, root_account).as_json[:acknowledged]).to be true
    end

    it "asks again after the accommodations change" do
      card.acknowledge!
      plan.bump_version!
      expect(described_class.new(math_teacher, student, root_account).as_json[:acknowledged]).to be false
    end
  end
end
