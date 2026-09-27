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

# Shared behavior for the student supports endpoints
# (docs/teacher-workflow-plan.md Phase 1): nothing works unless the
# supports_plans flag is on, and every read of a student's record goes through
# Supports::Access, which logs it with the real user when masquerading.
module Supports
  class BaseController < ApplicationController
    before_action :require_user
    before_action :require_plans_flag

    rescue_from Supports::PlanEditor::Forbidden, Supports::Importer::Forbidden, with: :render_forbidden
    rescue_from ActiveRecord::RecordInvalid, with: :render_invalid

    private

    def require_plans_flag
      render_unauthorized_action unless Supports.feature_enabled?(@domain_root_account, :supports_plans)
    end

    def real_user
      @real_current_user
    end

    def find_student
      @student = User.find_by(id: params[:student_id])
      render json: { message: t("Student not found.") }, status: :not_found unless @student
    end

    def render_forbidden
      render json: { message: t("You can't change this student's support records.") }, status: :forbidden
    end

    def render_invalid(error)
      render json: { errors: error.record.errors.full_messages }, status: :unprocessable_content
    end
  end
end
