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
describe TeacherWorkflow do
  let_once(:course) { course_factory(active_all: true) }

  describe ".feature_enabled?" do
    it "is false until the umbrella and the phase flag are both on" do
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be false

      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be false

      course.root_account.enable_feature!(:teacher_workflow)
      expect(described_class.feature_enabled?(course, :workflow_grading_queue)).to be true
    end

    it "works for an account" do
      course.root_account.enable_feature!(:teacher_workflow)
      course.account.enable_feature!(:workflow_grading_queue)
      expect(described_class.feature_enabled?(course.account, :workflow_grading_queue)).to be true
    end

    it "rejects an unknown flag" do
      expect { described_class.feature_enabled?(course, :nope) }.to raise_error(ArgumentError)
    end
  end
end
