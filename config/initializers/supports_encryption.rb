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

# Rails attribute encryption (`encrypts`), used for the free text in student
# support records (docs/teacher-workflow-plan.md, Phase 0 spike 3). The app has
# no Rails credentials, so the keys are derived from Canvas's own encryption key
# in config/security.yml. Changing that key makes existing encrypted text
# unreadable, so rotating it needs a re-encryption step first.
Rails.application.config.after_initialize do
  base = CanvasSecurity.encryption_key
  next if base.blank?

  derive = lambda do |label|
    OpenSSL::KDF.hkdf(base, salt: "active_record_encryption", info: label, length: 32, hash: "SHA256").unpack1("H*")
  end
  ActiveRecord::Encryption.configure(
    primary_key: derive.call("primary"),
    deterministic_key: derive.call("deterministic"),
    key_derivation_salt: derive.call("salt")
  )
end
