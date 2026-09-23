# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

require_relative "messages_helper"

describe "self_paced_item_relocked" do
  before :once do
    submission_model
  end

  let(:asset) { @submission }
  let(:notification_name) { :self_paced_item_relocked }

  it_behaves_like "a message"

  it "names the student and the item and links to the student dashboard for the course" do
    email = generate_message(:self_paced_item_relocked, :email, asset)

    expect(email.subject).to include(@submission.user.name, @submission.assignment.title)
    expect(email.body).to include("/self_paced/dashboard?course_id=#{@submission.course_id}")
  end
end
