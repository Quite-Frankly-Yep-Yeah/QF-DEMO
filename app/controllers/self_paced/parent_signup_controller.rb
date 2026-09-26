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

# The page a parent lands on from a QR code or link (SelfPaced::ParentInvite):
# they make an account, or if they are signed in, add the student to the one
# they have. Anyone with a live code can reach it, so it says nothing about the
# student beyond their first name.
module SelfPaced
  class ParentSignupController < ApplicationController
    # the whole point is that the parent has no account yet
    skip_before_action :require_user
    before_action :require_feature

    # GET /parents/join/:code
    def show
      signup = ParentSignup.find(params[:code], @domain_root_account)
      @page_title = t("Join your student")
      js_env({ SELF_PACED_PARENT_SIGNUP: {
               valid: signup.present?,
               student_first_name: signup&.student_first_name,
               signed_in_as: @current_user&.name,
               submit_url: parent_join_path(params[:code]),
               login_url: "/login?redirect=#{CGI.escape(request.path)}",
               authenticity_token: form_authenticity_token,
               password_policy: @domain_root_account.password_policy
             } })
      js_bundle :self_paced_parent_signup
      render html: '<div id="self_paced_parent_signup"></div>'.html_safe, layout: "bare"
    end

    # POST /parents/join/:code   name, email, password, password_confirmation
    # (or, when signed in, just the code)
    def create
      signup = ParentSignup.find(params[:code], @domain_root_account)
      return render json: { errors: [t("This invitation has expired. Ask the school for a new one.")] }, status: :not_found unless signup

      if @current_user
        signup.link!(@current_user)
      else
        pseudonym = signup.create!(name: params[:name],
                                   email: params[:email],
                                   password: params[:password],
                                   password_confirmation: params[:password_confirmation])
        PseudonymSession.new(pseudonym).save
      end
      render json: { redirect: "/" }
    rescue ParentSignup::Invalid => e
      render json: { errors: e.messages }, status: :unprocessable_content
    end

    private

    def require_feature
      return if SelfPaced.feature_enabled?(@domain_root_account, :self_paced_observer_view)

      render plain: t("This page isn't available."), status: :not_found
    end
  end
end
