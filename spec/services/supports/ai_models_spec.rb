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

describe Supports::AiModels do
  it "lists the offered models in order, matching what a setting may hold" do
    expect(described_class.ids).to eq %w[claude-opus-5-5 claude-sonnet-5-5 claude-haiku-4-5]
    expect(Supports::AnthropicSetting::MODELS).to eq described_class.ids
  end

  it "gives each model a name, a general description, a use-it-when note, prices and context" do
    models = described_class.all
    opus, sonnet, haiku = models
    expect(opus).to include(value: "claude-opus-5-5",
                            label: "Claude Opus 5.5",
                            input_price: 4,
                            output_price: 20,
                            context_tokens: 1_000_000,
                            supports_effort: true)
    expect(sonnet).to include(value: "claude-sonnet-5-5",
                              label: "Claude Sonnet 5.5",
                              input_price: 2,
                              output_price: 10,
                              context_tokens: 1_000_000,
                              supports_effort: true)
    expect(haiku).to include(value: "claude-haiku-4-5",
                             label: "Claude Haiku 4.5",
                             input_price: 1,
                             output_price: 5,
                             context_tokens: 200_000,
                             supports_effort: false)
    models.each do |model|
      expect(model[:summary]).to be_present
      expect(model[:use_when]).to be_present
    end
  end

  it "describes the models generally, not for any one feature" do
    text = described_class.all.map { |model| [model[:summary], model[:use_when]] }.flatten.join(" ")
    expect(text).not_to match(/IEP|plan|student|document|scan/i)
  end

  it "says how much each costs compared with the cheapest" do
    expect(described_class.all.to_h { |model| [model[:value], model[:cost_vs_cheapest]] })
      .to eq("claude-opus-5-5" => 4, "claude-sonnet-5-5" => 2, "claude-haiku-4-5" => 1)
  end

  it "says when the prices were checked" do
    expect(described_class::PRICES_CHECKED).to eq "2026-09-25"
  end

  it "knows which models take the effort setting, which IepExtractor relies on" do
    expect(described_class.supports_effort?("claude-opus-5-5")).to be true
    expect(described_class.supports_effort?("claude-haiku-4-5")).to be false
  end
end
