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
describe TeacherWorkflow::GradingQueue::Tiering do
  let(:now) { Time.zone.parse("2026-10-01 12:00:00 UTC") }
  let(:check) { item(order: [1, 2], grade_requirement: true) }
  let(:later) { item(order: [1, 3], grade_requirement: false) }

  def item(order:, grade_requirement:)
    TeacherWorkflow::GradingQueue::ItemIndex::Item.new(tag: nil, unit_id: 1, unit_name: "U1", order:, grade_requirement:)
  end

  def tier(**args)
    described_class.call(due_at: nil, item: check, current_item: nil, player: true, provisional: false, now:, **args)
  end

  it "is 1 when the student is stuck on this item and the course is not provisional" do
    expect(tier(current_item: check)).to eq 1
  end

  it "is 2 when provisional and the student has moved past this item" do
    expect(tier(provisional: true, current_item: later)).to eq 2
  end

  it "is not 2 when the item has no grade requirement" do
    ungated = item(order: [1, 2], grade_requirement: false)
    expect(tier(item: ungated, provisional: true, current_item: later)).to eq 4
  end

  it "is 3 when due within 72 hours or already overdue" do
    expect(tier(due_at: now + 71.hours)).to eq 3
    expect(tier(due_at: now - 2.days)).to eq 3
    expect(tier(due_at: now + 73.hours)).to eq 4
  end

  it "ignores the self-paced tiers outside player courses" do
    expect(tier(player: false, current_item: check)).to eq 4
  end

  it "does not crash with no item and no current item" do
    expect(tier(item: nil, current_item: nil)).to eq 4
  end
end
