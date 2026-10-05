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

# The installer's checklist, shown at /install_status to site admins. It works
# without the qf_onboarding flag so a fresh install can reach it first.
module Onboarding
  module InstallTrack
    KEY = "install"
    # A ready job that has waited longer than this means no runner is picking
    # jobs up.
    JOB_WAIT_LIMIT = 15.minutes
    DOCS_URL = "https://github.com/Quite-Frankly-Yep-Yeah/QF-DEMO/blob/main/docs/install.md"

    def self.build(root_account)
      Tracks::Track.new(
        key: KEY,
        title: I18n.t("Finish installing"),
        url: "/install_status",
        available: ->(context) { site_manager?(context.user) },
        steps: steps(root_account)
      )
    end

    def self.site_manager?(user)
      user.present? && Account.site_admin.grants_right?(user, :manage_site_settings)
    end

    def self.jobs_flowing?
      !Delayed::Job.where(locked_by: nil, next_in_strand: true)
                   .where(run_at: ...JOB_WAIT_LIMIT.ago)
                   .exists?
    end

    def self.steps(root_account)
      account_path = "/accounts/#{root_account.id}"
      [
        Tracks::Step.new(
          key: "domain",
          title: I18n.t("Set the site's domain"),
          description: I18n.t("Put the address people use in config/domain.yml, so links in email and LTI launches point at this server."),
          url: "#{DOCS_URL}#domain",
          check: ->(_) { HostUrl.default_host.present? }
        ),
        Tracks::Step.new(
          key: "mail",
          title: I18n.t("Set up outgoing mail"),
          description: I18n.t("Add config/outgoing_mail.yml with a from address, so the site can send notifications and password resets."),
          url: "#{DOCS_URL}#mail",
          check: ->(_) { HostUrl.outgoing_email_address.present? }
        ),
        Tracks::Step.new(
          key: "jobs",
          title: I18n.t("Start the background job runner"),
          description: I18n.t("Notifications, imports and the nightly self-paced jobs need it. Ticked while no job has waited more than 15 minutes."),
          url: "/jobs",
          check: ->(_) { jobs_flowing? }
        ),
        Tracks::Step.new(
          key: "self_paced",
          title: I18n.t("Turn on the self-paced platform"),
          description: I18n.t("Turn on Self-Paced Platform under Feature Options, then the self-paced features you want."),
          url: "#{account_path}/settings#tab-features",
          check: ->(_) { root_account.feature_enabled?(:self_paced) }
        ),
        Tracks::Step.new(
          key: "people",
          title: I18n.t("Add courses and people"),
          description: I18n.t("Create or import courses, then enroll teachers and students."),
          url: "#{account_path}/courses",
          check: ->(_) { Enrollment.active.where(root_account_id: root_account.id).exists? }
        ),
        Tracks::Step.new(
          key: "ai_key",
          title: I18n.t("Add an Anthropic API key"),
          description: I18n.t("Only needed for the AI features, such as IEP scanning."),
          url: "#{account_path}/ai_settings",
          check: ->(_) { Supports::AnthropicConfig.for(root_account).present? },
          optional: true
        ),
        Tracks::Step.new(
          key: "demo_data",
          title: I18n.t("Load demo data"),
          description: I18n.t("Run rake qf:demo_data for a sample course with a teacher and three students. Skip this on a production site."),
          url: "#{DOCS_URL}#demo-data",
          check: ->(_) { QfDemoData.loaded?(root_account) },
          optional: true
        )
      ]
    end
  end
end
