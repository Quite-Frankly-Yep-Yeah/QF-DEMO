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

describe CoursesController do
  let(:account) { Account.default }
  let(:admin) { account_admin_user(account:) }
  let(:teacher) { course_with_teacher(account:).user }

  describe "GET index (admin course catalog)" do
    context "with the catalog flag off" do
      it "shows the usual course list to a teacher" do
        user_session(teacher)
        get :index
        expect(response).to be_successful
        expect(assigns[:js_env]).not_to have_key(:COURSE_CATALOG)
      end
    end

    context "with the catalog flag on" do
      before do
        account.enable_feature!(:self_paced)
        account.enable_feature!(:self_paced_admin_catalog)
      end

      it "renders the catalog for an admin" do
        user_session(admin)
        get :index
        expect(response).to be_successful
        catalog = assigns[:js_env][:COURSE_CATALOG]
        expect(catalog[:account]).to eql({ id: account.id.to_s, name: account.name })
        expect(catalog[:can_create]).to be true
      end

      it "sends a teacher to the home page" do
        user_session(teacher)
        get :index
        expect(response).to redirect_to(root_path)
      end

      it "leaves the JSON course list alone for everyone" do
        user_session(teacher)
        get :index, format: :json
        expect(response).to be_successful
      end
    end
  end
end
