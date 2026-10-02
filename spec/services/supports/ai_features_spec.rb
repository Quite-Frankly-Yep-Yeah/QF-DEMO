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

describe Supports::AiFeatures do
  it "lists the AI features that have a model of their own" do
    expect(described_class.keys).to eq %i[iep_scan]
    expect(described_class.label(:iep_scan)).to eq "IEP scan"
    expect(described_class.valid?("iep_scan")).to be true
    expect(described_class.valid?("nope")).to be false
  end

  it "recommends Opus 5.5 for the IEP scan, with the reason" do
    expect(described_class.all).to eq [{ key: :iep_scan,
                                         label: "IEP scan",
                                         recommended: "claude-opus-5-5",
                                         why: "Most accurate on long or messy documents, and cost matters little here." }]
  end

  it "only recommends a model that is offered" do
    described_class::FEATURES.each_key do |key|
      recommended = described_class.all.find { |feature| feature[:key] == key }[:recommended]
      expect(recommended.nil? || Supports::AiModels.ids.include?(recommended)).to be true
    end
  end
end
