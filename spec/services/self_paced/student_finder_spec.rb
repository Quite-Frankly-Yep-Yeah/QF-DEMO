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

describe SelfPaced::StudentFinder do
  let_once(:course) { course_factory(active_all: true, course_name: "Algebra 1") }
  let_once(:root) { course.root_account }
  let_once(:maya) { student_in_course(course:, active_all: true, name: "Maya Lopez").user }
  let_once(:mario) { student_in_course(course:, active_all: true, name: "Mario Lopez-Diaz").user }
  let_once(:jordan) { student_in_course(course:, active_all: true, name: "Jordan Kim").user }
  let_once(:parent) { user_with_pseudonym(active_all: true, name: "Pat Kim", account: root) }

  before do
    root.enable_feature!(:self_paced)
    root.enable_feature!(:self_paced_observer_view)
    course.enable_feature!(:self_paced_course_player)
  end

  def search(query, observer: parent)
    described_class.new(observer, root).search(query)[:students]
  end

  describe ".parts" do
    it "wants at least two parts of a name" do
      expect(described_class.parts("maya")).to be_empty
      expect(described_class.parts("Maya Lopez")).to eql(%w[maya lopez])
    end

    it "won't run on a single letter, so a search can't list the school" do
      expect(described_class.parts("m l")).to be_empty
      expect(described_class.parts("ma l")).to be_empty
    end

    it "ignores punctuation and stray spaces, and keeps hyphens and apostrophes" do
      expect(described_class.parts("  Maya,   O'Neil-Lopez. ")).to eql(%w[maya o'neil-lopez])
    end

    it "gives up on a paragraph" do
      expect(described_class.parts("a very long thing typed in here")).to be_empty
    end
  end

  describe "#search" do
    it "finds a student by the start of each part of their name" do
      expect(search("maya lo")).to eql([{ id: maya.id.to_s, name: "Maya Lopez" }])
      expect(search("lopez maya")).to eql([{ id: maya.id.to_s, name: "Maya Lopez" }])
    end

    it "matches a later word in a longer name, and the second half of a hyphenated one" do
      expect(search("mario diaz").pluck(:name)).to eql(["Mario Lopez-Diaz"])
      expect(search("mario lopez-d").pluck(:name)).to eql(["Mario Lopez-Diaz"])
    end

    it "matches only the start of words, not the middle" do
      expect(search("aya pez")).to be_empty
    end

    it "gives back only ids and names" do
      expect(search("maya lopez").first.keys).to contain_exactly(:id, :name)
    end

    it "never treats wildcard characters as part of the search" do
      expect(search("%% %%")).to be_empty
      expect(search("m_ya lopez")).to be_empty
      expect(search("m%ya lopez")).to be_empty
    end

    it "shows students in classes the parent view covers, and no one else" do
      # a class that isn't in the course player, with a student whose name also matches
      other = course_factory(active_all: true)
      student_in_course(course: other, active_all: true, name: "Maya Lopez-Stranger")

      expect(search("maya lopez").pluck(:name)).to eql(["Maya Lopez"])
    end

    it "leaves out a class that isn't a course-player class" do
      course.disable_feature!(:self_paced_course_player)

      expect(search("maya lopez")).to be_empty
    end

    it "leaves out students who aren't actively enrolled" do
      maya.student_enrollments.each(&:conclude)

      expect(search("maya lopez")).to be_empty
    end

    it "leaves out a student the parent already follows" do
      UserObservationLink.create_or_restore(student: maya, observer: parent, root_account: root)

      expect(search("maya lopez")).to be_empty
    end

    it "never offers the parent themselves" do
      student_in_course(course:, user: parent, active_all: true)

      expect(search("pat kim")).to be_empty
    end

    it "shows every match when there are only a few" do
      described_class::MAX_RESULTS.times { |i| student_in_course(course:, active_all: true, name: "Sam Twin#{("a".ord + i).chr}") }

      result = described_class.new(parent, root).search("sam twin")
      expect(result[:students].size).to eq described_class::MAX_RESULTS
      expect(result[:too_many]).to be false
    end

    it "shows nobody, and says to type more, when a search matches too many students" do
      (described_class::MAX_RESULTS + 1).times { |i| student_in_course(course:, active_all: true, name: "Sam Twin#{("a".ord + i).chr}") }

      expect(described_class.new(parent, root).search("sam twin")).to eql(students: [], too_many: true)
    end

    it "says the same when there are more matches than it even looks at" do
      stub_const("#{described_class}::MAX_CANDIDATES", 3)
      4.times { |i| student_in_course(course:, active_all: true, name: "Sam Twin#{("a".ord + i).chr}") }

      expect(described_class.new(parent, root).search("sam twin")).to eql(students: [], too_many: true)
    end

    it "gives nothing for a search that isn't specific enough" do
      expect(described_class.new(parent, root).search("maya")).to eql(students: [], too_many: false)
    end
  end

  describe "#findable?" do
    it "holds a request to the same rules as a search" do
      finder = described_class.new(parent, root)

      expect(finder.findable?(maya)).to be true
      expect(finder.findable?(parent)).to be false

      UserObservationLink.create_or_restore(student: maya, observer: parent, root_account: root)
      expect(described_class.new(parent, root).findable?(maya)).to be false
    end

    it "says no for a student outside the parent view" do
      course.disable_feature!(:self_paced_course_player)

      expect(described_class.new(parent, root).findable?(maya)).to be false
    end
  end
end
