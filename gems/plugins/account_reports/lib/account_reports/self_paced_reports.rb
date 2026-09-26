# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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

module AccountReports
  # The self-paced report family (docs/fork-plan.md Phase 7). Each report runs
  # SelfPaced::Reports over every tracked course in the school; teachers and
  # mentors get the same reports for their own courses from the dashboard.
  class SelfPacedReports
    include ReportHelper

    def initialize(account_report)
      @account_report = account_report
    end

    SelfPaced::Reports::KINDS.each do |kind|
      define_singleton_method(:"self_paced_#{kind}_csv") do |account_report|
        new(account_report).generate(kind)
      end
    end

    def generate(kind)
      reports = SelfPaced::Reports.new(courses, from: from_date, to: to_date)
      write_report reports.headers(kind) do |csv|
        reports.each_row(kind) { |row| csv << row }
      end
    end

    private

    # Nothing to report until the school has the reports turned on.
    def courses
      return [] unless SelfPaced.feature_enabled?(root_account, :self_paced_reports)

      ids = SelfPaced::StudentCourseState.where(root_account_id: root_account.id).distinct.pluck(:course_id)
      root_account.all_courses.active.where(id: ids).order(:name, :id)
    end

    def to_date
      parse(@account_report.parameters["end_at"]) || Time.zone.today
    end

    def from_date
      parse(@account_report.parameters["start_at"]) || (to_date - 29.days)
    end

    def parse(value)
      Date.iso8601(value.to_s[0, 10]) if value.present?
    rescue ArgumentError
      nil
    end
  end
end
