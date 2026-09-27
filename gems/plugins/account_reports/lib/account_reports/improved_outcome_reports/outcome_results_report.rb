# frozen_string_literal: true

#
# Copyright (C) 2013 - present Instructure, Inc.
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

module AccountReports
  module ImprovedOutcomeReports
    class OutcomeResultsReport < BaseOutcomeReport
      include CanvasOutcomesHelper

      HEADERS = [
        "student name",
        "student id",
        "student sis id",
        "assessment title",
        "assessment id",
        "assessment type",
        "submission date",
        "submission score",
        "learning outcome name",
        "learning outcome id",
        "attempt",
        "outcome score",
        "assessment question",
        "assessment question id",
        "course name",
        "course id",
        "course sis id",
        "section name",
        "section id",
        "section sis id",
        "assignment url",
        "learning outcome friendly name",
        "learning outcome points possible",
        "learning outcome mastery score",
        "learning outcome mastered",
        "learning outcome rating",
        "learning outcome rating points",
        "learning outcome group title",
        "learning outcome group id",
        "account id",
        "account name",
        "enrollment state"
      ].freeze

      # returns rows for each assessed outcome result (or question result)
      def generate
        # Add text to the report description if user supplied ordering parameter
        add_outcome_order_text
        results_scope = ReportHelper.activate_report_db { outcome_results_scope }
        write_outcomes_report(HEADERS, results_scope)
      end

      private

      def add_outcome_order_text
        order = determine_order_key
        if order
          add_extra_text(I18n.t("account_reports.outcomes.order", "Order: %{order}", order:))
        end
      end

      def join_course_sub_account_scope(account, scope, table = "courses")
        if account == account.root_account
          scope
        else
          scope.joins(<<~SQL.squish)
            join #{CourseAccountAssociation.quoted_table_name} caa
              ON caa.account_id = #{account.id}
              AND caa.course_id = #{table}.id
              AND caa.course_section_id IS NULL
          SQL
        end
      end

      def outcome_results_scope
        inst_identity = Pseudonym.column_names.include?("is_inst_id")
        students = account.learning_outcome_links.active
                          .select(<<~SQL.squish)
                            distinct on (#{outcome_order}, p.id, s.id, r.id, qr.id, q.id, a.id, subs.id, qs.id, aq.id)
                            u.sortable_name                             AS "student name",
                            p.user_id                                   AS "student id",
                            p.sis_user_id                               AS "student sis id",
                            a.id                                        AS "assignment id",
                            COALESCE(q.title, a.title)                  AS "assessment title",
                            COALESCE(q.id, a.id)                        AS "assessment id",
                            COALESCE(qs.finished_at, subs.submitted_at) AS "submission date",
                            COALESCE(qs.score, subs.score)              AS "submission score",
                            aq.name                                     AS "assessment question",
                            aq.id                                       AS "assessment question id",
                            learning_outcomes.short_description         AS "learning outcome name",
                            learning_outcomes.id                        AS "learning outcome id",
                            learning_outcomes.display_name              AS "learning outcome friendly name",
                            COALESCE(qr.possible, r.possible)           AS "learning outcome points possible",
                            COALESCE(qr.mastery, r.mastery)             AS "learning outcome mastered",
                            learning_outcomes.data                      AS "learning outcome data",
                            g.title                                     AS "learning outcome group title",
                            g.id                                        AS "learning outcome group id",
                            COALESCE(qr.attempt, r.attempt)             AS "attempt",
                            r.hide_points                               AS "learning outcome points hidden",
                            COALESCE(qr.score, r.score)                 AS "outcome score",
                            r.percent                                   AS "total percent outcome score",
                            c.name                                      AS "course name",
                            c.id                                        AS "course id",
                            c.sis_source_id                             AS "course sis id",
                            CASE WHEN r.association_type IN ('Quiz', 'Quizzes::Quiz') THEN 'quiz'
                                WHEN ct.content_type = 'Assignment' THEN 'assignment'
                            END                                         AS "assessment type",
                            s.name                                      AS "section name",
                            s.id                                        AS "section id",
                            s.sis_source_id                             AS "section sis id",
                            e.workflow_state                            AS "enrollment state",
                            acct.id                                     AS "account id",
                            acct.name                                   AS "account name"
                          SQL
                          .joins(<<~SQL.squish)
                            INNER JOIN #{LearningOutcomeGroup.quoted_table_name} g ON g.id = content_tags.associated_asset_id
                              AND content_tags.associated_asset_type = 'LearningOutcomeGroup'
                            INNER JOIN #{LearningOutcome.quoted_table_name} ON content_tags.content_id = learning_outcomes.id
                              AND content_tags.content_type = 'LearningOutcome'
                            INNER JOIN #{LearningOutcomeResult.quoted_table_name} r ON r.learning_outcome_id = learning_outcomes.id
                            INNER JOIN #{ContentTag.quoted_table_name} ct ON r.content_tag_id = ct.id
                            INNER JOIN #{User.quoted_table_name} u ON u.id = r.user_id
                            INNER JOIN #{Pseudonym.quoted_table_name} p on p.user_id = r.user_id
                              #{"AND p.is_inst_id = false" if inst_identity}
                            INNER JOIN #{Course.quoted_table_name} c ON r.context_id = c.id
                            INNER JOIN #{Account.quoted_table_name} acct ON acct.id = c.account_id
                            INNER JOIN #{Enrollment.quoted_table_name} e ON e.type = 'StudentEnrollment' and e.root_account_id = #{account.root_account.id}
                              AND e.user_id = p.user_id AND e.course_id = c.id
                              #{"AND e.workflow_state <> 'deleted'" unless @include_deleted}
                            INNER JOIN #{CourseSection.quoted_table_name} s ON e.course_section_id = s.id
                            LEFT OUTER JOIN #{LearningOutcomeQuestionResult.quoted_table_name} qr on qr.learning_outcome_result_id = r.id
                            LEFT OUTER JOIN #{Quizzes::Quiz.quoted_table_name} q ON q.id = r.association_id
                            AND r.association_type IN ('Quiz', 'Quizzes::Quiz')
                            LEFT OUTER JOIN #{Assignment.quoted_table_name} a ON a.type = 'Assignment' AND ((a.id = ct.content_id
                            AND ct.content_type = 'Assignment') OR a.id = q.assignment_id)
                            LEFT OUTER JOIN #{Submission.quoted_table_name} subs ON subs.assignment_id = a.id
                            AND subs.user_id = u.id AND subs.workflow_state <> 'deleted' AND subs.workflow_state <> 'unsubmitted'
                            LEFT OUTER JOIN #{Quizzes::QuizSubmission.quoted_table_name} qs ON r.artifact_id = qs.id
                            AND r.artifact_type IN ('QuizSubmission', 'Quizzes::QuizSubmission')
                            LEFT OUTER JOIN #{AssessmentQuestion.quoted_table_name} aq ON aq.id = qr.associated_asset_id
                            AND qr.associated_asset_type = 'AssessmentQuestion'
                          SQL
                          .where("ct.workflow_state <> 'deleted' AND r.workflow_state <> 'deleted' AND r.artifact_type <> 'Submission'")

        unless @include_deleted
          students = students.where("p.workflow_state<>'deleted' AND c.workflow_state IN ('available', 'completed')")
        end

        students = join_course_sub_account_scope(account, students, "c")
        students = add_term_scope(students, "c")
        students.order(outcome_order)
      end
    end
  end
end
