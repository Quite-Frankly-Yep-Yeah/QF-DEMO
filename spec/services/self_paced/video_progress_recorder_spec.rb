# frozen_string_literal: true

#
# Copyright (C) 2026 - present EXAMPLE contributors
#
# This file is part of EXAMPLE LMS, a modified version of Canvas.
#
# EXAMPLE LMS is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# EXAMPLE LMS is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

describe SelfPaced::VideoProgressRecorder do
  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let_once(:context_module) { course.context_modules.create!(name: "Unit 1") }
  let_once(:video_tag) { context_module.add_item(type: "wiki_page", id: course.wiki_pages.create!(title: "Video lesson").id) }
  let(:start) { Time.zone.parse("2026-09-22 15:00:00 UTC") }

  before do
    course.root_account.enable_feature!(:self_paced)
    course.enable_feature!(:self_paced_course_player)
    SelfPaced::ItemSetting.create!(content_tag: video_tag, course:, role: "instruction", watch_fraction: 0.9)
    context_module.update!(completion_requirements: [{ id: video_tag.id, type: "must_watch" }])
  end

  def record(fraction, at:, duration: 600)
    described_class.record(user: student, course:, tag: video_tag, fraction:, duration:, at:)
  end

  def watched_requirement_met?
    ContextModule.find(context_module.id).evaluate_for(student).requirements_met.pluck(:id).include?(video_tag.id)
  end

  it "keeps the highest share watched" do
    record(0.05, at: start)
    record(0.2, at: start + 10.minutes)
    record(0.1, at: start + 11.minutes)

    expect(SelfPaced::VideoProgress.find_by(user: student).max_fraction).to be 0.2
  end

  it "won't believe more than the time since the first report allows" do
    record(0.0, at: start)
    record(1.0, at: start + 1.minute) # 10 minutes of video in 1 minute

    # (60s * 2 + 60s slack) / 600s
    expect(SelfPaced::VideoProgress.find_by(user: student).max_fraction).to be 0.3
  end

  it "meets the must_watch requirement once enough has been watched" do
    record(0.0, at: start)
    record(0.5, at: start + 5.minutes)
    expect(watched_requirement_met?).to be false

    record(0.95, at: start + 10.minutes)
    expect(watched_requirement_met?).to be true
    expect(SelfPaced::VideoProgress.find_by(user: student).completed_at).to eql(start + 10.minutes)
  end

  it "ignores items that don't need watching" do
    SelfPaced::ItemSetting.find_by(content_tag: video_tag).update!(watch_fraction: nil)

    expect(record(0.5, at: start)).to be_nil
  end
end
