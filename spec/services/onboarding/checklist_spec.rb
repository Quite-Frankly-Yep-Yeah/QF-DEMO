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

describe Onboarding::Checklist do
  let_once(:root_account) { Account.default }
  let_once(:user) { user_factory }

  let(:detected) { { value: true } }
  let(:track) do
    state = detected
    Onboarding::Tracks::Track.new(
      key: "demo",
      title: "Demo",
      url: "/demo",
      available: ->(_) { true },
      steps: [
        Onboarding::Tracks::Step.new(key: "auto", title: "Auto", description: "", url: "/a", check: ->(_) { state[:value] }),
        Onboarding::Tracks::Step.new(key: "manual", title: "Manual", description: "", url: "/m"),
        Onboarding::Tracks::Step.new(key: "extra", title: "Extra", description: "", url: "/e", optional: true),
        Onboarding::Tracks::Step.new(key: "broken", title: "Broken", description: "", url: "/b", check: ->(_) { raise "boom" })
      ]
    )
  end

  subject(:checklist) { described_class.new(track, user, root_account) }

  def step(key)
    checklist.as_json[:steps].find { |s| s[:key] == key }
  end

  it "ticks a detected step and counts only required steps" do
    expect(step("auto")).to include(detectable: true, detected: true, done: true)
    expect(step("manual")).to include(detectable: false, detected: nil, done: false)
    expect(checklist.as_json).to include(done_count: 1, total: 3)
  end

  it "treats a check that raises as not done" do
    expect(step("broken")).to include(detected: false, done: false)
  end

  it "marks a step done by hand and back again, keeping no empty rows" do
    checklist.mark(track.step("manual"), done: true)
    expect(step("manual")).to include(done: true)
    expect(step("manual")[:completed_at]).to be_present

    checklist.mark(track.step("manual"), done: false)
    expect(step("manual")).to include(done: false, completed_at: nil)
    expect(Onboarding::Progress.count).to eq 0
  end

  it "keeps the first completion time when marked done twice" do
    checklist.mark(track.step("manual"), done: true)
    first = Onboarding::Progress.last.completed_at
    Timecop.travel(1.hour.from_now) { checklist.mark(track.step("manual"), done: true) }
    expect(Onboarding::Progress.last.completed_at).to eq first
  end

  it "sets a step aside without marking it done, and leaves done alone when only dismissed is given" do
    checklist.mark(track.step("manual"), done: true)
    checklist.mark(track.step("manual"), dismissed: true)
    expect(step("manual")[:dismissed_at]).to be_present
    expect(step("manual")).to include(done: true)
  end

  it "lets a step be marked done by hand when the check doesn't see it" do
    detected[:value] = false
    checklist.mark(track.step("auto"), done: true)
    expect(step("auto")).to include(detected: false, done: true)
  end

  it "starts over by forgetting only this track's marks" do
    checklist.mark(track.step("manual"), done: true)
    Onboarding::Progress.create!(user:, root_account:, step_key: "other.step", completed_at: Time.zone.now)
    checklist.reset!
    expect(step("manual")).to include(done: false)
    expect(Onboarding::Progress.pluck(:step_key)).to eq ["other.step"]
  end

  it "keeps one person's marks from another's" do
    checklist.mark(track.step("manual"), done: true)
    other = described_class.new(track, user_factory, root_account)
    expect(other.as_json[:steps].find { |s| s[:key] == "manual" }).to include(done: false)
  end
end
