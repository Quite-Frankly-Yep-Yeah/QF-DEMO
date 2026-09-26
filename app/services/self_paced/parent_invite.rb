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

require "rqrcode"

# An invitation for a parent to join a student (docs/fork-plan.md): a
# one-use pairing code that expires, a link to the sign-up page, and that
# link as a QR code staff can show or print. The code is Canvas's own observer
# pairing code, so it links the same way a student-made one does.
module SelfPaced
  module ParentInvite
    PATH = "/parents/join"

    # +base_url+ is the address the staff member is using, so a QR code made on
    # the school network points at the school network.
    def self.create(student, base_url)
      pairing = student.generate_observer_pairing_code
      url = "#{base_url.to_s.chomp("/")}#{PATH}/#{pairing.code}"
      { code: pairing.code, url:, expires_at: pairing.expires_at.iso8601, qr_svg: qr_svg(url) }
    end

    # The QR code as an inline <svg>, no XML header.
    def self.qr_svg(text)
      RQRCode::QRCode.new(text, level: :m)
                     .as_svg(module_size: 6,
                             standalone: true,
                             use_path: true,
                             viewbox: true,
                             svg_attributes: { role: "img", "aria-label": "QR code for the parent sign-up page" })
                     .sub(/\A<\?xml[^>]*\?>/, "")
    end
  end
end
