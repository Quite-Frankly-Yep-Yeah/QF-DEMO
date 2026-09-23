# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::UserData do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:from_user) { student_in_course(course:, active_all: true).user }
  let_once(:target_user) { student_in_course(course:, active_all: true).user }
  let_once(:tag) do
    course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson").id)
  end
  let(:at) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  def ping(user, seconds)
    SelfPaced::ActivityLedger.record_ping(user:, course:, seconds:, content_tag: tag, at:)
  end

  describe ".merge" do
    it "adds the merged user's time to the target's rows for the same day and item" do
      ping(from_user, 40)
      ping(target_user, 20)
      described_class.merge(from_user, target_user)

      expect(SelfPaced::ActivityDay.where(course:).pluck(:user_id, :active_seconds)).to eql([[target_user.id, 60]])
      expect(SelfPaced::ItemTime.where(course:).pluck(:user_id, :active_seconds)).to eql([[target_user.id, 60]])
    end

    it "moves rows the target doesn't have yet" do
      ping(from_user, 40)
      described_class.merge(from_user, target_user)

      expect(SelfPaced::ActivityDay.where(course:).pluck(:user_id)).to eql([target_user.id])
    end

    it "drops the merged user's progress rows" do
      ping(from_user, 40)
      described_class.merge(from_user, target_user)

      expect(SelfPaced::StudentCourseState.where(user: from_user)).not_to exist
    end
  end

  describe ".purge" do
    it "deletes every self-paced row for the user and nobody else" do
      ping(from_user, 40)
      ping(target_user, 20)
      described_class.purge(from_user.id)

      expect([SelfPaced::ActivityDay, SelfPaced::ItemTime, SelfPaced::StudentCourseState].map { |k| k.where(user: from_user).count })
        .to eql([0, 0, 0])
      expect(SelfPaced::ActivityDay.where(user: target_user)).to exist
    end
  end

  describe "user lifecycle" do
    it "purges a user's rows when the user is deleted" do
      ping(from_user, 40)
      from_user.destroy
      run_jobs

      expect(SelfPaced::ActivityDay.where(user: from_user)).not_to exist
    end

    it "moves a user's rows when the user is merged into another" do
      ping(from_user, 40)
      UserMerge.from(from_user).into(target_user)
      run_jobs

      expect(SelfPaced::ActivityDay.where(course:).pluck(:user_id, :active_seconds)).to eql([[target_user.id, 40]])
    end
  end

  describe "caseload pins" do
    let_once(:mentor) { teacher_in_course(course:, active_all: true).user }

    it "moves a merged student's pins to the target user" do
      SelfPaced::MentorCaseload.create!(mentor:, student: from_user, root_account: course.root_account)
      described_class.merge(from_user, target_user)

      expect(SelfPaced::MentorCaseload.pluck(:mentor_id, :student_id)).to eql([[mentor.id, target_user.id]])
    end

    it "removes pins for and by a deleted user" do
      SelfPaced::MentorCaseload.create!(mentor:, student: from_user, root_account: course.root_account)
      SelfPaced::MentorCaseload.create!(mentor: from_user, student: target_user, root_account: course.root_account)
      described_class.purge(from_user.id)

      expect(SelfPaced::MentorCaseload.count).to be 0
    end
  end
end
