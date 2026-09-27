/*
 * Copyright (C) 2026 - present quite frankly an example LMS contributors
 *
 * This file is part of quite frankly an example LMS, a modified version of Canvas.
 *
 * quite frankly an example LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

// ENV.SELF_PACED_PARENTS (SelfPaced::ParentsController#show)
export type ParentsConfig = {
  flyer_url: string
  reset_url: string
  requests_url: string
}

// GET /api/v1/self_paced/parents/flyer (SelfPaced::ParentFlyer.build)
export type Flyer = {
  school_name: string
  url: string
  qr_svg: string
}

// GET /api/v1/self_paced/parents/requests (SelfPaced::LinkRequest.admin_json)
export type AdminRequest = {
  id: string
  status: 'pending' | 'approved' | 'declined' | 'cancelled'
  note: string | null
  response: string | null
  created_at: string
  decided_at: string | null
  decided_by: string | null
  observer: {id: string; name: string; email: string | null}
  student: {id: string; name: string; classes: string[]; parents: number}
}
