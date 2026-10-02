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
    expect(QfThemes.ids).to eq(%w[light mocha])
  end

  describe ".valid?" do
    it "accepts a known id" do
      expect(QfThemes.valid?("mocha")).to be true
    end

    it "rejects unknown ids and non-strings" do
      expect(QfThemes.valid?("latte")).to be false
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

    it "colors the global nav labels with the theme's onAppBar" do
      css = QfThemes.css
      expect(css).to include("--ic-brand-global-nav-menu-item__text-color:#CDD6F4")
      expect(css).to include("--ic-brand-global-nav-menu-item__text-color--active:#CDD6F4")
    end
  end
end
