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
require "spec_helper"

describe QfThemes do
  it "lists the theme ids" do
    expect(QfThemes.ids).to eq(%w[light latte frappe macchiato mocha])
  end

  describe ".valid?" do
    it "accepts a known id" do
      expect(QfThemes.valid?("mocha")).to be true
    end

    it "rejects unknown ids and non-strings" do
      expect(QfThemes.valid?("nord")).to be false
      expect(QfThemes.valid?(nil)).to be false
      expect(QfThemes.valid?(["mocha"])).to be false
    end
  end

  describe ".css" do
    it "defines the tokens of every theme" do
      css = QfThemes.css
      expect(css).to include(':root[data-theme="mocha"]')
      expect(css).to include("--qf-surface:#1E1E2E")
      expect(css).to include("--qf-ink-secondary:")
    end

    it "points the global nav brand variables at the theme" do
      expect(QfThemes.css).to include("--ic-brand-global-nav-bgd:#181825")
    end

    it "leaves the institution's nav branding alone for the default theme" do
      light_rule = QfThemes.css.lines.find { |line| line.include?('data-theme="light"') }
      expect(light_rule).to include("--qf-app-bar:")
      expect(light_rule).not_to include("--ic-brand")
    end

    it "defines every Catppuccin flavor" do
      css = QfThemes.css
      expect(css).to include('data-theme="latte"]{', 'data-theme="frappe"]{', 'data-theme="macchiato"]{')
      expect(css).to include("--qf-paper:#EFF1F5") # Latte's base
    end

    it "colors the global nav labels with the theme's onAppBar" do
      css = QfThemes.css
      expect(css).to include("--ic-brand-global-nav-menu-item__text-color:#CDD6F4")
      expect(css).to include("--ic-brand-global-nav-menu-item__text-color--active:#CDD6F4")
    end
  end

  describe "accents" do
    it "validates accent ids" do
      expect(QfThemes.accent_valid?("material:teal")).to be true
      expect(QfThemes.accent_valid?("catppuccin:mauve")).to be true
      expect(QfThemes.accent_valid?("material:mauve")).to be false
      expect(QfThemes.accent_valid?("teal")).to be false
      expect(QfThemes.accent_valid?(nil)).to be false
      expect(QfThemes.accent_valid?(["material:teal"])).to be false
    end

    describe ".accent_style" do
      it "is empty without an accent" do
        expect(QfThemes.accent_style("mocha", nil)).to eq ""
      end

      it "resolves a Catppuccin accent to the flavor and fills the top bar" do
        style = QfThemes.accent_style("mocha", "catppuccin:mauve")
        expect(style).to include("--qf-accent:#CBA6F7;")
        expect(style).to include("--qf-app-bar:#CBA6F7;")
        expect(style).to include("--ic-brand-global-nav-bgd:#CBA6F7;")
        expect(QfThemes.accent_style("latte", "catppuccin:mauve")).to include("--qf-accent:#8839EF;")
        expect(QfThemes.accent_style("light", "catppuccin:mauve")).to include("--qf-accent:#8839EF;")
      end

      it "picks white or black text for the top bar by contrast" do
        expect(QfThemes.accent_style("light", "material:indigo")).to include("--qf-on-app-bar:#FFFFFF;")
        expect(QfThemes.accent_style("light", "material:yellow")).to include("--qf-on-app-bar:#000000;")
      end

      it "falls back to the theme's ink for link text when the accent is too faint on the card" do
        expect(QfThemes.accent_style("light", "material:yellow")).to include("--qf-accent-text:#212121;")
        expect(QfThemes.accent_style("light", "material:blue")).to include("--qf-accent-text:#2196F3;")
      end
    end
  end
end
