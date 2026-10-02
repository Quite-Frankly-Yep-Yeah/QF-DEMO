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

# The Claude models an admin may choose, with a general description of each, when
# to use it, and what it costs. Prices are Anthropic's list prices per million
# tokens and change over time: update INFO and PRICES_CHECKED together.
module Supports
  module AiModels
    PRICES_CHECKED = "2026-09-25"

    INFO = {
      "claude-opus-5-5" => {
        label: -> { I18n.t("Claude Opus 5.5") },
        summary: -> { I18n.t("Most capable.") },
        use_when: -> { I18n.t("Complex, long or ambiguous work, and anywhere accuracy matters more than cost or speed.") },
        input_price: 4,
        output_price: 20,
        context_tokens: 1_000_000,
        supports_effort: true
      },
      "claude-sonnet-5-5" => {
        label: -> { I18n.t("Claude Sonnet 5.5") },
        summary: -> { I18n.t("Balanced.") },
        use_when: -> { I18n.t("A good default for most everyday work: strong quality at about half Opus's price.") },
        input_price: 2,
        output_price: 10,
        context_tokens: 1_000_000,
        supports_effort: true
      },
      "claude-haiku-4-5" => {
        label: -> { I18n.t("Claude Haiku 4.5") },
        summary: -> { I18n.t("Fastest and cheapest.") },
        use_when: -> { I18n.t("Simple, short or high-volume work where a quick, good-enough answer is fine.") },
        input_price: 1,
        output_price: 5,
        context_tokens: 200_000,
        supports_effort: false
      }
    }.freeze

    def self.ids
      INFO.keys
    end

    def self.supports_effort?(id)
      INFO.dig(id, :supports_effort) == true
    end

    # For the settings page: one hash per model, in order.
    def self.all
      cheapest = INFO.values.pluck(:input_price).min
      INFO.map do |id, info|
        { value: id,
          label: info[:label].call,
          summary: info[:summary].call,
          use_when: info[:use_when].call,
          input_price: info[:input_price],
          output_price: info[:output_price],
          context_tokens: info[:context_tokens],
          supports_effort: info[:supports_effort],
          cost_vs_cheapest: info[:input_price] / cheapest }
      end
    end
  end
end
