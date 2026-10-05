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

describe Onboarding::InstallTrack do
  let_once(:root_account) { Account.default }

  let(:track) { described_class.build(root_account) }
  let(:context) { Onboarding::Tracks::Context.new(user: nil, root_account:) }

  def detected(key)
    track.step(key).detected(context)
  end

  it "is offered to site admins only" do
    expect(track.available?(Onboarding::Tracks::Context.new(user: site_admin_user, root_account:))).to be true
    expect(track.available?(Onboarding::Tracks::Context.new(user: account_admin_user(account: root_account), root_account:))).to be false
    expect(track.available?(Onboarding::Tracks::Context.new(user: nil, root_account:))).to be false
  end

  it "leaves the AI key and demo data optional" do
    expect(track.steps.select(&:optional).map(&:key)).to match_array %w[ai_key demo_data]
  end

  it "sees the domain and outgoing address from the config" do
    allow(HostUrl).to receive_messages(default_host: "lms.example.edu", outgoing_email_address: nil)
    expect(detected("domain")).to be true
    expect(detected("mail")).to be false
  end

  it "flags jobs as stuck when a ready job has waited too long" do
    expect(detected("jobs")).to be true
    Delayed::Job.enqueue(Delayed::PerformableMethod.new(Kernel, :sleep, args: [0]), run_at: 1.hour.ago)
    expect(detected("jobs")).to be false
  end

  it "sees the self-paced platform turned on" do
    expect(detected("self_paced")).to be false
    root_account.enable_feature!(:self_paced)
    expect(detected("self_paced")).to be true
  end

  it "sees courses with people in them" do
    expect(detected("people")).to be false
    course_with_student(account: root_account, active_all: true)
    expect(detected("people")).to be true
  end

  it "sees the demo course" do
    expect(detected("demo_data")).to be false
    QfDemoData.load!(root_account, password: "demo-password-123")
    expect(detected("demo_data")).to be true
  end
end
