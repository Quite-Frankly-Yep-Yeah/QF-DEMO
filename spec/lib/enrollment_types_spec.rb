# frozen_string_literal: true

#
# Copyright (C) 2025 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe EnrollmentTypes do
  describe ".definitions" do
    it "returns enrollment type definitions" do
      definitions = EnrollmentTypes.definitions
      expect(definitions).to be_a(Hash)
      expect(definitions).to have_key("StudentEnrollment")
      expect(definitions).to have_key("TeacherEnrollment")
      expect(definitions).to have_key("TaEnrollment")
      expect(definitions).to have_key("DesignerEnrollment")
      expect(definitions).to have_key("ObserverEnrollment")
    end

    it "includes required fields for each enrollment type" do
      definitions = EnrollmentTypes.definitions
      definitions.each_value do |definition|
        expect(definition).to have_key(:base_role_name)
        expect(definition).to have_key(:name)
        expect(definition).to have_key(:label)
        expect(definition).to have_key(:plural_label)
        expect(definition[:label]).to respond_to(:call)
        expect(definition[:plural_label]).to respond_to(:call)
      end
    end
  end

  describe ".labels" do
    it "returns the label definitions for every enrollment type" do
      labels = EnrollmentTypes.labels
      expect(labels.length).to eq(5)

      student_enrollment = labels.find { |l| l[:name] == "StudentEnrollment" }
      expect(student_enrollment[:label].call).to eq("Student")
      expect(student_enrollment[:plural_label].call).to eq("Students")

      teacher_enrollment = labels.find { |l| l[:name] == "TeacherEnrollment" }
      expect(teacher_enrollment[:label].call).to eq("Teacher")
      expect(teacher_enrollment[:plural_label].call).to eq("Teachers")
    end
  end
end
