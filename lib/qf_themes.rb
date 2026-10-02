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

# Themes are token maps in ui/shared/material/themes.json, shared with the
# frontend so the server and the picker cannot drift.
module QfThemes
  DEFAULT = "light"
  SOURCE = Rails.root.join("ui/shared/material/themes.json")

  class << self
    def ids
      themes.keys
    end

    def valid?(id)
      id.is_a?(String) && themes.key?(id)
    end

    # One :root[data-theme=...] rule per theme: the --qf-* tokens plus the
    # global nav's brand variables, so the existing nav CSS picks them up.
    def css
      themes.map do |id, theme|
        tokens = theme["tokens"]
        declarations = tokens.map { |name, value| "--qf-#{name.gsub(/[A-Z]/) { |c| "-#{c.downcase}" }}:#{value}" }
        declarations.concat(nav_variables(tokens))
        %(:root[data-theme="#{id}"]{#{declarations.join(";")}})
      end.join("\n")
    end

    private

    def nav_variables(tokens)
      [
        "--ic-brand-global-nav-bgd:#{tokens["appBar"]}",
        "--ic-brand-global-nav-logo-bgd:#{tokens["appBar"]}",
        "--ic-brand-global-nav-ic-icon-svg-fill:#{tokens["onAppBar"]}",
        "--ic-brand-global-nav-ic-icon-svg-fill--active:#{tokens["onAppBar"]}",
        "--ic-brand-global-nav-menu-item__text-color:#{tokens["onAppBar"]}",
        "--ic-brand-global-nav-menu-item__text-color--active:#{tokens["onAppBar"]}"
      ]
    end

    def themes
      @themes ||= JSON.parse(SOURCE.read)
    end
  end
end
