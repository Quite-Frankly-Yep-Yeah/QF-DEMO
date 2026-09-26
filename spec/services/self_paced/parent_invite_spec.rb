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

describe SelfPaced::ParentInvite do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }

  it "makes a one-use code and a link on the address the staff member is using" do
    invite = described_class.create(maya, "http://192.168.1.154/")

    expect(invite[:url]).to eql("http://192.168.1.154/parents/join/#{invite[:code]}")
    expect(ObserverPairingCode.active.find_by(code: invite[:code]).user).to eq maya
    expect(Time.zone.parse(invite[:expires_at])).to be > 6.days.from_now
  end

  it "draws the link as an inline QR code with no XML header" do
    svg = described_class.create(maya, "http://localhost:3000")[:qr_svg]

    expect(svg).to start_with("<svg")
    expect(svg).to include("<path")
    expect(svg).not_to include("<?xml")
  end
end
