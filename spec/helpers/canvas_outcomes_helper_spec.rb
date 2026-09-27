# frozen_string_literal: true

#
# Copyright (C) 2020 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

require "webmock/rspec"

describe CanvasOutcomesHelper do
  def stub_get_alignments(params)
    stub_request(:get, "http://domain/api/outcomes/list?#{params}").with({
                                                                           headers: {
                                                                             Authorization: /\+*/,
                                                                             Accept: "*/*",
                                                                             "Accept-Encoding": /\+*/,
                                                                             "User-Agent": "Ruby"
                                                                           }
                                                                         })
  end

  subject { Object.new.extend CanvasOutcomesHelper }

  around do |example|
    WebMock.disable_net_connect!(allow_localhost: true)
    example.run
    WebMock.enable_net_connect!
  end

  before do
    course_with_teacher_logged_in(active_all: true)
  end

  let(:account) { @course.account }

  def create_page(attrs)
    page = @course.wiki_pages.create!(attrs)
    page.publish! if page.unpublished?
    page
  end

  describe "#set_outcomes_alignment_js_env" do
    let(:wiki_page) { create_page title: "title text", body: "body text" }

    context "without outcomes" do
      it "does not set JS_ENV" do
        expect(subject).not_to receive(:js_env)
        subject.set_outcomes_alignment_js_env(wiki_page, account, {})
      end
    end

    context "with outcomes" do
      before do
        outcome_model(context: account)
      end

      it "raises error on invalid artifact type" do
        expect { subject.set_outcomes_alignment_js_env(account, account, {}) }.to raise_error("Unsupported artifact type: Account")
      end

      shared_examples_for "valid js_env settings" do
        it "sets js_env values" do
          expect(subject).to receive(:extract_domain_jwt).and_return ["domain", "jwt"]
          expect(subject).to receive(:js_env).with({
                                                     canvas_outcomes: {
                                                       artifact_type: "canvas.page",
                                                       artifact_id: wiki_page.id,
                                                       context_uuid: account.uuid,
                                                       host: expected_host,
                                                       jwt: "jwt",
                                                       extra_key: "extra_value"
                                                     }
                                                   })
          subject.set_outcomes_alignment_js_env(wiki_page, account, extra_key: "extra_value")
        end
      end

      context "without overriding protocol" do
        let(:expected_host) { "http://domain" }

        it_behaves_like "valid js_env settings"
      end

      context "overriding protocol" do
        let(:expected_host) { "https://domain" }

        before do
          ENV["OUTCOMES_SERVICE_PROTOCOL"] = "https"
        end

        after do
          ENV.delete("OUTCOMES_SERVICE_PROTOCOL")
        end

        it_behaves_like "valid js_env settings"
      end

      context "within a Group" do
        before do
          outcome_model(context: @course)
          @group = @course.groups.create(name: "some group")
        end

        it "sets js_env with the group.context values" do
          expect(subject).to receive(:extract_domain_jwt).and_return ["domain", "jwt"]
          expect(subject).to receive(:js_env).with({
                                                     canvas_outcomes: {
                                                       artifact_type: "canvas.page",
                                                       artifact_id: wiki_page.id,
                                                       context_uuid: @course.uuid,
                                                       host: "http://domain",
                                                       jwt: "jwt"
                                                     }
                                                   })
          subject.set_outcomes_alignment_js_env(wiki_page, @group, {})
        end
      end
    end
  end

  describe "#extract_domain_jwt" do
    it "returns nil domain and jwt with no provision settings" do
      expect(subject.extract_domain_jwt(account, "")).to eq [nil, nil]
    end

    it "returns nil domain and jwt with no outcomes provision settings" do
      account.settings[:provision] = {}
      account.save!
      expect(subject.extract_domain_jwt(account, "")).to eq [nil, nil]
    end

    it "returns domain and jwt with outcomes provision settings" do
      settings = { consumer_key: "key", jwt_secret: "secret", domain: "domain" }
      account.settings[:provision] = { "outcomes" => settings }
      account.save!
      expect(JWT).to receive(:encode).and_return "encoded"
      expect(subject.extract_domain_jwt(account, "")).to eq ["domain", "encoded"]
    end

    describe "if ApplicationController.test_cluster_name is specified" do
      it "returns a domain using the test_cluster_name domain" do
        settings = { consumer_key: "key",
                     jwt_secret: "secret",
                     domain: "domain",
                     beta_domain: "beta.domain" }
        account.settings[:provision] = { "outcomes" => settings }
        account.save!
        expect(JWT).to receive(:encode).and_return "encoded"
        allow(ApplicationController).to receive(:test_cluster?).and_return(true)
        allow(ApplicationController).to receive(:test_cluster_name).and_return("beta")
        expect(subject.extract_domain_jwt(account, "")).to eq ["beta.domain", "encoded"]
        allow(ApplicationController).to receive(:test_cluster_name).and_return("invalid")
        expect(subject.extract_domain_jwt(account, "")).to eq [nil, nil]
      end
    end
  end

  describe "#build_request_url" do
    it "add params if present" do
      params = { param: "stuff" }
      expect(subject.build_request_url("protocol", "domain", "endpoint", params)).to eq "protocol://domain/endpoint?param=stuff"
    end

    it "does not add params when not present" do
      params = {}
      expect(subject.build_request_url("protocol", "domain", "endpoint", params)).to eq "protocol://domain/endpoint"
      params = nil
      expect(subject.build_request_url("protocol", "domain", "endpoint", params)).to eq "protocol://domain/endpoint"
    end
  end

  describe "#enqueue_rollup_calculation" do
    let(:course) { course_model }
    let(:student) { user_model }

    context "with feature flag enabled" do
      before do
        Account.site_admin.enable_feature!(:outcomes_rollup_propagation)
      end

      it "enqueues student rollup calculation with course_id and student_id" do
        expect(Outcomes::StudentOutcomeRollupCalculationService).to receive(:calculate_for_student)
          .with(course_id: course.id, student_id: student.id)

        subject.enqueue_rollup_calculation(course_id: course.id, student_id: student.id)
      end

      it "enqueues course rollup calculation with only course_id" do
        expect(Outcomes::StudentOutcomeRollupCalculationService).to receive(:calculate_for_course)
          .with(course_id: course.id)

        subject.enqueue_rollup_calculation(course_id: course.id)
      end

      it "accepts outcome_id parameter but does not affect behavior" do
        expect(Outcomes::StudentOutcomeRollupCalculationService).to receive(:calculate_for_student)
          .with(course_id: course.id, student_id: student.id)

        subject.enqueue_rollup_calculation(course_id: course.id, student_id: student.id, outcome_id: 123)
      end
    end

    context "with feature flag disabled" do
      before do
        Account.site_admin.disable_feature!(:outcomes_rollup_propagation)
      end

      it "does not enqueue rollup calculation when feature flag is disabled" do
        expect(Outcomes::StudentOutcomeRollupCalculationService).not_to receive(:calculate_for_student)
        expect(Outcomes::StudentOutcomeRollupCalculationService).not_to receive(:calculate_for_course)

        result = subject.enqueue_rollup_calculation(course_id: course.id, student_id: student.id)
        expect(result).to be_nil
      end
    end

    context "edge cases" do
      before do
        Account.site_admin.enable_feature!(:outcomes_rollup_propagation)
      end

      it "raises ArgumentError when course_id is not provided" do
        expect { subject.enqueue_rollup_calculation(student_id: student.id) }
          .to raise_error(ArgumentError, "Must provide at least course_id")
      end

      it "raises ArgumentError when neither course_id nor student_id is provided but outcome_id is provided" do
        expect { subject.enqueue_rollup_calculation(outcome_id: 123) }
          .to raise_error(ArgumentError, "Must provide at least course_id")
      end
    end
  end
end
