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

# The administration hub: one Material page that lists everything an admin
# can open in an account. The links are the account's own navigation tabs
# (so the hub can never show more than the sidebar does), the tabs of the
# Settings page, and the self-paced tools.
class AdminHubController < ApplicationController
  before_action :require_user
  before_action :require_account_context

  # GET /accounts/:account_id/hub(.json)
  def show
    return unless authorized_action(@context, @current_user, :read_as_admin)

    # the nav's admin popover loads the same config without the page
    return render json: hub_config if request.format.json?

    @page_title = t("Administration")
    add_crumb t("Administration")
    add_body_class("full-width")
    @show_left_side = false
    js_env({ ADMIN_HUB: hub_config })
    js_bundle :admin_hub
    render html: '<div id="admin_hub"></div>'.html_safe, layout: true
  end

  private

  def hub_config
    {
      account: { id: @context.id.to_s, name: @context.name },
      tabs: navigation_tabs,
      settings_tabs:,
      self_paced: self_paced_links
    }
  end

  def navigation_tabs
    SectionTabHelper::AvailableSectionTabs
      .new(@context, @current_user, @domain_root_account, session)
      .to_a
      .map { |tab| SectionTabPresenter.new(tab, @context).to_h.slice(:css_class, :path, :label) }
  end

  # The tabs of the Settings page, under the same conditions as
  # app/views/accounts/settings.html.erb.
  def settings_tabs
    can = ->(right) { @context.grants_right?(@current_user, session, right) }
    manage = can.call(:manage_account_settings)
    root = @context.root_account?
    tabs = []
    tabs << ["settings", t("General settings")] if manage
    tabs << ["quotas", t("Quotas")] if can.call(:manage_storage_quotas)
    tabs << ["integrations", t("Integrations")] if manage && root && @context.feature_enabled?(:microsoft_group_enrollments_syncing)
    tabs << ["notifications", t("Notifications")] if manage && @context.primary_settings_root_account? && !@context.site_admin?
    tabs << ["users", t("Admins")]
    tabs << ["announcements", t("Announcements")]
    tabs << ["reports", t("Reports")] if can.call(:read_reports)
    tabs << ["tools", t("Tools")] if can.call(:read_as_admin)
    tabs << ["features", t("Feature options")] if can.call(:view_feature_flags)
    tabs << ["security", t("Security")] if manage && @context.root_account.feature_enabled?(:javascript_csp) && !@context.site_admin?

    tabs.map { |id, label| { id:, label:, path: "#{account_settings_path(@context)}#tab-#{id}" } }
  end

  def self_paced_links
    links = []
    if @context.feature_enabled?(:self_paced_teacher_dashboard)
      links << { id: "dashboard", label: t("Teacher dashboard"), path: self_paced_dashboard_path }
    end
    if SelfPaced.feature_enabled?(@context, :self_paced_observer_view) &&
       @context.grants_right?(@current_user, session, :manage_user_observers)
      links << { id: "parents", label: t("Parents"), path: self_paced_parents_page_path }
    end
    links
  end
end
