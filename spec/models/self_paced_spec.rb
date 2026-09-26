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

describe SelfPaced do
  # plain let, not let_once: a shared course would keep a stale copy of its
  # root account, with feature flag state cached from an earlier example
  let(:root_account) { Account.create! }
  let(:sub_account) { root_account.sub_accounts.create! }
  let(:course) { Course.create!(account: sub_account) }

  describe ".enabled?" do
    it "is false while the umbrella flag is off" do
      expect(SelfPaced.enabled?(course)).to be false
    end

    it "is true for the root account, its sub-accounts and their courses once the umbrella flag is on" do
      root_account.enable_feature!(:self_paced)

      expect([root_account, sub_account, course].map { |c| SelfPaced.enabled?(c) }).to eql([true, true, true])
    end

    it "is false without a context" do
      expect(SelfPaced.enabled?(nil)).to be false
    end
  end

  describe ".feature_enabled?" do
    it "rejects flags that aren't self-paced phase flags" do
      expect { SelfPaced.feature_enabled?(course, :quizzes_next) }.to raise_error(ArgumentError)
    end

    it "is false while the umbrella flag is off, even if the phase flag is on" do
      course.enable_feature!(:self_paced_course_player)

      expect(SelfPaced.feature_enabled?(course, :self_paced_course_player)).to be false
    end

    context "with the umbrella flag on" do
      before { root_account.enable_feature!(:self_paced) }

      it "checks course-scoped flags on the course" do
        course.enable_feature!(:self_paced_course_player)

        expect(SelfPaced.feature_enabled?(course, :self_paced_course_player)).to be true
      end

      it "checks account-scoped flags on the course's account" do
        sub_account.enable_feature!(:self_paced_teacher_dashboard)

        expect(SelfPaced.feature_enabled?(course, :self_paced_teacher_dashboard)).to be true
      end

      it "is false when the phase flag is off" do
        expect(SelfPaced.feature_enabled?(course, :self_paced_pacing)).to be false
      end
    end
  end

  describe "feature flag definitions" do
    it "defines the umbrella flag and every phase flag, all hidden" do
      flags = [SelfPaced::UMBRELLA_FLAG, *SelfPaced::PHASE_FLAGS].map { |f| Feature.definitions[f.to_s] }

      expect(flags.map(&:state)).to all(eql("hidden"))
    end

    it "hides the features that need Instructure's hosted services" do
      expect(%w[quizzes_next].map { |f| Feature.definitions[f].state })
        .to all(eql("hidden"))
    end
  end

  describe ".dashboard_available?" do
    let(:teacher) { teacher_in_course(course:, active_all: true).user }

    it "is true for a teacher once the dashboard is on" do
      root_account.enable_feature!(:self_paced)
      root_account.enable_feature!(:self_paced_activity_tracking)
      root_account.enable_feature!(:self_paced_teacher_dashboard)

      expect(SelfPaced.dashboard_available?(teacher, Account.find(root_account.id))).to be true
    end

    it "is false while self-paced is off" do
      expect(SelfPaced.dashboard_available?(teacher, root_account)).to be false
    end

    it "is false without a user" do
      expect(SelfPaced.dashboard_available?(nil, root_account)).to be false
    end
  end
end
