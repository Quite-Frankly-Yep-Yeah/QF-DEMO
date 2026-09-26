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
describe SelfPaced::Reports do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:teacher) { teacher_in_course(course:, active_all: true, name: "Ms Lee").user }
  let_once(:student) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let(:from) { Date.new(2026, 9, 21) }
  let(:to) { Date.new(2026, 9, 27) }
  let(:tag) { course.context_modules.create!(name: "Unit 1").add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Lesson 1").id) }

  before do
    SelfPaced::StudentCourseState.create!(course:,
                                          user: student,
                                          root_account: course.root_account,
                                          current_content_tag: tag,
                                          percent_complete: 40,
                                          requirements_completed: 2,
                                          requirements_total: 5,
                                          current_score: 80,
                                          unposted_current_score: 90,
                                          days_behind: 2,
                                          expected_percent: 55,
                                          target_date: Date.new(2026, 10, 30))
  end

  def table(kind, **)
    CSV.parse(described_class.new([course], from:, to:, **).to_csv(kind), headers: true).map(&:to_h)
  end

  def day(date, seconds)
    SelfPaced::ActivityDay.create!(course:, user: student, root_account: course.root_account, day: date, active_seconds: seconds)
  end

  it "reports progress, with the grade the viewer may see" do
    expect(table("progress").first).to include("student" => "Maya Lopez",
                                               "percent complete" => "40.0",
                                               "current item" => "Lesson 1",
                                               "grade" => "90.0")
    expect(table("progress", grades: ->(_) { :posted }).first["grade"]).to eql("80.0")
    expect(table("progress", grades: ->(_) {}).first["grade"]).to be_nil
  end

  it "reports pacing" do
    expect(table("pacing").first).to include("days behind" => "2", "expected percent" => "55.0", "target date" => "2026-10-30")
  end

  it "adds up time on task inside the date range only" do
    day(from, 600)
    day(from + 1, 300)
    day(from - 1, 6000)

    expect(table("time_on_task").first).to include("active minutes" => "15", "days active" => "2", "last active day" => "2026-09-22")
  end

  it "lists the intervention log in the range" do
    SelfPaced::Intervention.create!(course:, student:, actor: teacher, kind: "note", reason: "Doing well")
    reports = described_class.new([course], from: Time.zone.today, to: Time.zone.today)
    rows = CSV.parse(reports.to_csv("interventions"), headers: true).map(&:to_h)

    expect(rows.first).to include("student" => "Maya Lopez", "action" => "note", "by" => "Ms Lee")
  end

  it "counts engaged days under the attendance policy" do
    day(from, 40 * 60)
    day(from + 1, 5 * 60)

    expect(table("engaged_days").first).to include("days engaged" => "1", "days with activity" => "2", "active minutes" => "45")
  end

  it "refuses an unknown report" do
    expect { described_class.new([course], from:, to:).to_csv("secrets") }.to raise_error(ArgumentError)
  end
end
