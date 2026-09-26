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
describe SelfPaced::Attendance do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:teacher) { teacher_in_course(course:, active_all: true).user }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let(:monday) { Date.new(2026, 9, 21) }

  def fact(day, minutes: 0, submissions: 0)
    SelfPaced::ActivityDay.create!(course:,
                                   user: student,
                                   root_account: course.root_account,
                                   day:,
                                   active_seconds: minutes * 60,
                                   submissions_count: submissions)
  end

  def days(from: monday, to: monday + 6)
    described_class.days(course, from:, to:)[student.id]
  end

  it "counts a day with enough active minutes under the default policy" do
    fact(monday, minutes: 30)
    fact(monday + 1, minutes: 29)

    expect(days.map { |d| [d.day, d.present] }).to eql([[monday, true], [monday + 1, false]])
  end

  it "counts a submission as present unless the policy says otherwise" do
    fact(monday, minutes: 5, submissions: 1)
    expect(days.first.present).to be true

    SelfPaced::AttendancePolicy.create!(root_account: course.root_account,
                                        effective_on: monday - 1,
                                        min_active_minutes: 30,
                                        submission_counts: false)
    expect(described_class.days(course, from: monday, to: monday)[student.id].first.present).to be false
  end

  it "judges each day by the policy in force on that day" do
    fact(monday, minutes: 20)
    fact(monday + 3, minutes: 20)
    SelfPaced::AttendancePolicy.create!(root_account: course.root_account, effective_on: monday + 2, min_active_minutes: 15)

    expect(days.map(&:present)).to eql([false, true])
  end

  it "lets a staff correction beat the policy and add documented minutes" do
    fact(monday, minutes: 10)
    SelfPaced::AttendanceAdjustment.create!(course:,
                                            student:,
                                            day: monday,
                                            present: true,
                                            minutes: 60,
                                            reason: "Worked offline with a tutor",
                                            created_by: teacher)
    # a correction for a day with no activity at all still shows up
    SelfPaced::AttendanceAdjustment.create!(course:, student:, day: monday + 1, present: true, reason: "Field trip", created_by: teacher)

    expect(days.map { |d| [d.present, d.adjusted, d.active_minutes] }).to eql([[true, true, 70], [true, true, 0]])
  end

  it "uses the newest correction when there are several for a day" do
    2.times do |i|
      SelfPaced::AttendanceAdjustment.create!(course:, student:, day: monday, present: i.zero?, reason: "Try #{i}", created_by: teacher)
    end

    expect(days.first.present).to be false
  end
end
