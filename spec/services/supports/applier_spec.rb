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

describe Supports::Applier do
  let_once(:root_account) { Account.default }
  let_once(:course) { course_factory(active_all: true) }
  let_once(:enrollment) { student_in_course(course:, active_all: true) }
  let_once(:student) { enrollment.user }
  let_once(:plan) { Supports::Plan.create!(account: root_account, student:, plan_type: "iep") }
  let_once(:unit) { course.context_modules.create!(name: "Unit 1") }
  let_once(:pages) do
    Array.new(4) { |i| unit.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson #{i + 1}").id) }
  end

  # Monday; the course runs Monday to Friday, with four 30-minute lessons
  let(:mon) { Date.new(2026, 10, 5) }

  before :once do
    root_account.enable_feature!(:student_supports)
    root_account.enable_feature!(:supports_plans)
    root_account.enable_feature!(:supports_accommodations_apply)
    Supports::Catalog.ensure_defaults!(root_account)
  end

  def type(kind)
    Supports::AccommodationType.find_by(root_account:, kind:)
  end

  def accommodate(kind, **parameters)
    plan.accommodations.create!(accommodation_type: type(kind), parameters:)
  end

  describe "pacing" do
    before do
      root_account.enable_feature!(:self_paced)
      course.enable_feature!(:self_paced_pacing)
      course.enable_feature!(:self_paced_course_player)
      pages.each { |tag| SelfPaced::ItemSetting.create!(content_tag: tag, course:, role: "instruction", estimated_minutes: 30) }
      unit.update!(completion_requirements: pages.map { |tag| { id: tag.id, type: "must_view" } })
      enrollment.update!(start_at: course.time_zone.local(2026, 10, 5, 8))
      course.update!(self_paced_target_date: (mon + 4).iso8601)
    end

    def pacer(today: mon)
      SelfPaced::Pacer.new(Course.find(course.id), student, today:)
    end

    it "moves the finish date out" do
      accommodate("extended_deadlines", percent: 100, mode: "extend_finish")
      plan = pacer.refresh!

      expect(plan.target_date).to eql(mon + 11)
      expect(plan.planned_dates.values.max).to be <= mon + 11
      expect(Supports::Application.where(student:, kind: "pacing").pluck(:details))
        .to eql([{ "mode" => "extend_finish",
                   "percent" => 100,
                   "target_before" => nil,
                   "target_date" => (mon + 11).iso8601,
                   "spread_end" => (mon + 11).iso8601 }])
    end

    it "lowers the daily target and keeps the finish date" do
      accommodate("extended_deadlines", percent: 50, mode: "lower_daily")
      plan = pacer.refresh!

      expect(plan.target_date).to eql(mon + 4)
      expect(plan.planned_dates.values.max).to be > mon + 4
      expect(plan.baseline["days"].last.first).to eql((mon + 11).iso8601)
    end

    it "keeps a date a teacher set by hand" do
      accommodate("extended_deadlines", percent: 100, mode: "extend_finish")
      teacher = teacher_in_course(course:, active_all: true).user
      pacer.set_target!(mon + 7, actor: teacher)

      expect(pacer(today: mon + 1).refresh!.target_date).to eql(mon + 7)
    end

    it "replans when the accommodation is added to an existing plan" do
      pacer.refresh!
      accommodate("extended_deadlines", percent: 100, mode: "extend_finish")
      described_class.sync(student.id, root_account.id)

      plan = SelfPaced::PacingPlan.find_by(course:, user: student)
      expect([plan.target_date, plan.version]).to eql([mon + 11, 2])
    end

    it "changes nothing for a student without one" do
      plan = pacer.refresh!

      expect(plan.target_date).to eql(mon + 4)
      expect(plan.baseline).not_to have_key("accommodation")
    end
  end

  describe "display settings" do
    it "turns the setting on once and leaves it to the student after that" do
      accommodate("display", setting: "use_dyslexic_font")
      described_class.sync(student.id, root_account.id)
      expect(student.reload.prefers_dyslexic_font?).to be true

      student.disable_feature!(:use_dyslexic_font)
      described_class.sync(student.id, root_account.id)

      expect(student.reload.prefers_dyslexic_font?).to be false
      expect(Supports::Application.where(student:, kind: "display").count).to be 1
    end

    it "does nothing with the flag off" do
      root_account.disable_feature!(:supports_accommodations_apply)
      accommodate("display", setting: "high_contrast")
      described_class.sync(student.id, root_account.id)

      expect(student.reload.prefers_high_contrast?).to be false
    end
  end

  describe ".sync_later" do
    it "is queued when an accommodation changes" do
      expect { accommodate("display", setting: "high_contrast") }
        .to change { Delayed::Job.where(tag: "Supports::Applier.sync").count }.by(1)
    end
  end

  describe "an application row" do
    it "can't be changed" do
      row = Supports::Application.record!(accommodate("display", setting: "high_contrast"), kind: "display", context: student)

      expect { row.update!(kind: "pacing") }.to raise_error(ActiveRecord::ReadOnlyRecord)
    end
  end
end
