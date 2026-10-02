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
  ACCENT_SOURCE = Rails.root.join("ui/shared/material/accents.json")
  FLAVORS = %w[latte frappe macchiato mocha].freeze
  DARK_TEXT = "#000000"
  WHITE = "#FFFFFF"

  class << self
    def ids
      themes.keys
    end

    def valid?(id)
      id.is_a?(String) && themes.key?(id)
    end

    # One :root[data-theme=...] rule per theme: the --qf-* tokens plus, for
    # non-default themes, the global nav's brand variables so the existing nav
    # CSS picks them up.
    def css
      themes.map do |id, theme|
        tokens = theme["tokens"]
        declarations = tokens.map { |name, value| "--qf-#{name.gsub(/[A-Z]/) { |c| "-#{c.downcase}" }}:#{value}" }
        # the default theme keeps whatever nav branding the institution set
        declarations.concat(nav_variables(tokens)) unless id == DEFAULT
        %(:root[data-theme="#{id}"]{#{declarations.join(";")}})
      end.join("\n")
    end

    # "material:teal" or "catppuccin:mauve"
    def accent_valid?(id)
      return false unless id.is_a?(String)

      group, name = id.split(":", 2)
      case group
      when "material" then accents["material"].any? { |a| a["id"] == name }
      when "catppuccin" then accents["catppuccin"].any? { |a| a["id"] == name }
      else false
      end
    end

    # The inline CSS a custom accent sets on <html>: the accent, the top bar
    # filled with it, and the nav brand variables. Mirrors accentVariables in
    # ui/shared/material/accents.ts; keep the two in sync.
    def accent_style(theme_id, accent_id)
      return "" unless accent_valid?(accent_id)

      hex = accent_hex(theme_id, accent_id)
      tokens = themes.fetch(valid?(theme_id) ? theme_id : DEFAULT)["tokens"]
      on_bar = (contrast(WHITE, hex) >= contrast(DARK_TEXT, hex)) ? WHITE : DARK_TEXT
      text = (contrast(hex, tokens["paper"]) >= 3) ? hex : tokens["ink"]
      vars = {
        "--qf-accent" => hex,
        "--qf-accent-text" => text,
        "--qf-app-bar" => hex,
        "--qf-on-app-bar" => on_bar
      }
      nav_variables("appBar" => hex, "onAppBar" => on_bar).each do |declaration|
        name, value = declaration.split(":", 2)
        vars[name] = value
      end
      vars.map { |name, value| "#{name}:#{value};" }.join
    end

    private

    def accent_hex(theme_id, accent_id)
      group, name = accent_id.split(":", 2)
      return accents["material"].find { |a| a["id"] == name }["hex"] if group == "material"

      flavor = FLAVORS.include?(theme_id) ? theme_id : "latte"
      accents["catppuccin"].find { |a| a["id"] == name }[flavor]
    end

    def luminance(hex)
      r, g, b = hex.delete("#").scan(/../).map { |c| c.hex / 255.0 }.map do |c|
        (c <= 0.03928) ? c / 12.92 : ((c + 0.055) / 1.055)**2.4
      end
      (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    end

    def contrast(first, second)
      light, dark = [luminance(first), luminance(second)].sort.reverse
      (light + 0.05) / (dark + 0.05)
    end

    def accents
      @accents ||= JSON.parse(ACCENT_SOURCE.read)
    end

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
