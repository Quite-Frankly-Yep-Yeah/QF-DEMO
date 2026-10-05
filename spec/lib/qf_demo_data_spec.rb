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

describe QfDemoData do
  let_once(:root_account) { Account.default }

  it "makes a teacher, three students and a two-unit course, all enrolled" do
    result = described_class.load!(root_account, password: "demo-password-123")
    course = result[:course]

    expect(course).to be_available
    expect(course.sis_source_id).to eq described_class::COURSE_SIS_ID
    expect(course.context_modules.count).to eq 2
    expect(course.context_modules.first.content_tags.count).to eq 2
    expect(course.teacher_enrollments.active.map(&:user)).to eq [result[:teacher]]
    expect(course.student_enrollments.active.map(&:user)).to match_array result[:students]
    expect(result[:created].size).to eq 4
    expect(described_class.loaded?(root_account)).to be true
  end

  it "reuses what is already there when run again" do
    described_class.load!(root_account, password: "demo-password-123")
    expect { described_class.load!(root_account, password: "other-password-456") }
      .not_to change { [Course.count, User.count, Enrollment.count, Pseudonym.count] }
  end

  it "keeps an existing login's password" do
    described_class.load!(root_account, password: "demo-password-123")
    result = described_class.load!(root_account, password: "other-password-456")
    expect(result[:created]).to be_empty
    pseudonym = root_account.pseudonyms.by_unique_id(described_class::TEACHER[:login]).first
    expect(pseudonym.valid_password?("demo-password-123")).to be true
  end
end
