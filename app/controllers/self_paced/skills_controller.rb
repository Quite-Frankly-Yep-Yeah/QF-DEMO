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

# JSON behind the Skills page: a course's outcomes with each student's level
# on each, and a way to add a skill (docs/fork-plan.md).
module SelfPaced
  class SkillsController < ApplicationController
    before_action :require_user
    before_action :load_course

    # GET /api/v1/courses/:course_id/self_paced/skills
    def show
      return render_unauthorized_action unless @course.grants_any_right?(@current_user, :manage_outcomes, :view_all_grades)

      render json: Skills.new(@course).as_json
    end

    # POST /api/v1/courses/:course_id/self_paced/skills   title, description
    def create
      return render_unauthorized_action unless @course.grants_right?(@current_user, :manage_outcomes)

      skill = Skills.new(@course).create!(title: params[:title], description: params[:description])
      render json: { id: skill.id.to_s, title: skill.title }, status: :created
    rescue ActiveRecord::RecordInvalid => e
      render json: { errors: e.record.errors.full_messages }, status: :unprocessable_content
    end

    private

    def load_course
      @course = Course.active.find(params[:course_id])
    end
  end
end
