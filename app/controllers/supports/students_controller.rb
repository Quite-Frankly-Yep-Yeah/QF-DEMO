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

# A student's accommodations card (tier 1, for teachers) and plan details
# (tier 2, for support staff), and finding a student to start a plan for.
module Supports
  class StudentsController < BaseController
    SEARCH_LIMIT = 20
    APPLICATIONS_LIMIT = 200

    before_action :find_student, except: :search

    # GET /api/v1/supports/students/:student_id/accommodations
    def accommodations
      json = AccommodationCard.new(@current_user, @student, @domain_root_account, real_user:).as_json
      return render_unauthorized_action unless json

      render json:
    end

    # POST /api/v1/supports/students/:student_id/acknowledgement
    def acknowledge
      card = AccommodationCard.new(@current_user, @student, @domain_root_account, real_user:)
      return render_unauthorized_action unless card.acknowledge!

      render json: card.as_json
    end

    # GET /api/v1/supports/students/:student_id
    def show
      json = PlanEditor.new(@current_user, @student, @domain_root_account, real_user:).as_json
      return render_unauthorized_action unless json

      render json:
    end

    # GET /api/v1/supports/students/:student_id/applications?days=7
    #
    # What the app applied for the student's accommodations lately: extra quiz
    # time and attempts, pacing, display settings (Phase 2). Tier 2.
    def applications
      access = Access.new(@current_user, @student, @domain_root_account)
      return render_unauthorized_action unless access.view!(:plan_details, subject: :applications, real_user:)

      days = (params[:days].presence || 7).to_i.clamp(1, 90)
      rows = Application.where(student: @student, root_account: @domain_root_account)
                        .since(days.days.ago).order(created_at: :desc, id: :desc).limit(APPLICATIONS_LIMIT)
                        .preload(student_accommodation: :accommodation_type).to_a
      course_names = Course.where(id: rows.filter_map(&:course_id).uniq).pluck(:id, :name).to_h
      quiz_titles = Quizzes::Quiz.where(id: rows.filter_map { |row| row.details["quiz_id"] }.uniq).pluck(:id, :title)
                                 .to_h { |id, title| [id.to_s, title] }
      render json: {
        days:,
        applications: rows.map do |row|
          row.as_api_json(course_names).merge(accommodation: row.student_accommodation&.accommodation_type&.name,
                                              quiz_title: quiz_titles[row.details["quiz_id"]])
        end
      }
    end

    # GET /api/v1/supports/students?search_term=
    #
    # Students the viewer may manage plans for, found by name, SIS user ID or
    # login ID (Supports::StudentSearch): everyone in the schools where they
    # manage every student's plans, or just their caseload. Names and SIS IDs
    # only: nothing protected.
    def search
      finder = StudentSearch.new(@current_user, @domain_root_account)
      return render_unauthorized_action unless finder.allowed?

      render json: { students: finder.search(params[:search_term], limit: SEARCH_LIMIT) }
    end
  end
end
