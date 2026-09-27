# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

describe "QTI Generator" do
  before :once do
    quiz_with_question_group_pointing_to_question_bank
  end

  def qti_generator(user: nil)
    @rn = Object.new
    allow(@rn).to receive_messages(user:, course: @course, export_dir: {})
    allow(@rn).to receive(:export_object?).with(anything).and_return(true)
    @qg = CC::Qti::QtiGenerator.new @rn, nil, nil
  end

  describe ".generate_banks" do
    it "calls generate_question_bank for every account bank" do
      qti_generator
      allow(@qg).to receive(:generate_question_bank) do |bank|
        expect(bank.class.to_s).to eq "AssessmentQuestionBank"
      end
      @result = @qg.generate_banks [@bank.id]
    end

    context "permissions" do
      it "includes question banks for teachers" do
        teacher_in_course
        qti_generator(user: @teacher)
        expect(@qg).to receive(:generate_question_bank).at_least(:once)
        @qg.generate_banks [@bank.id]
      end

      it "excludes question banks for students" do
        qti_generator(user: @student)
        expect(@qg).not_to receive :generate_question_bank
        @qg.generate_banks [@bank.id]
      end
    end
  end

  describe ".generate_bank" do
    before do
      qti_generator
    end

    it "generates qti xml with the correct metadata" do
      doc = Builder::XmlMarkup.new(target: +"", indent: 2)
      course = course_model(name: "Test Course", uuid: "course_uuid")
      bank = course.assessment_question_banks.create!(title: "Test Bank")

      expected_xml =
        <<~XML
          <?xml version="1.0" encoding="UTF-8"?>
          <questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
            <objectbank ident="somemigrationid">
              <qtimetadata>
                <qtimetadatafield>
                  <fieldlabel>bank_title</fieldlabel>
                  <fieldentry>Test Bank</fieldentry>
                </qtimetadatafield>
                <qtimetadatafield>
                  <fieldlabel>bank_context_uuid</fieldlabel>
                  <fieldentry>course_uuid</fieldentry>
                </qtimetadatafield>
                <qtimetadatafield>
                  <fieldlabel>bank_state</fieldlabel>
                  <fieldentry>active</fieldentry>
                </qtimetadatafield>
              </qtimetadata>
            </objectbank>
          </questestinterop>
        XML

      expect(@qg.generate_bank(doc, bank, "somemigrationid")).to eq expected_xml
    end

    it "generates qti xml with bank_state as deleted for soft-deleted banks" do
      doc = Builder::XmlMarkup.new(target: +"", indent: 2)
      course = course_model(name: "Test Course", uuid: "course_uuid")
      bank = course.assessment_question_banks.create!(title: "Deleted Bank")
      bank.destroy

      expected_xml =
        <<~XML
          <?xml version="1.0" encoding="UTF-8"?>
          <questestinterop xmlns="http://www.imsglobal.org/xsd/ims_qtiasiv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsglobal.org/xsd/ims_qtiasiv1p2 http://www.imsglobal.org/xsd/ims_qtiasiv1p2p1.xsd">
            <objectbank ident="somemigrationid">
              <qtimetadata>
                <qtimetadatafield>
                  <fieldlabel>bank_title</fieldlabel>
                  <fieldentry>Deleted Bank</fieldentry>
                </qtimetadatafield>
                <qtimetadatafield>
                  <fieldlabel>bank_context_uuid</fieldlabel>
                  <fieldentry>course_uuid</fieldentry>
                </qtimetadatafield>
                <qtimetadatafield>
                  <fieldlabel>bank_state</fieldlabel>
                  <fieldentry>deleted</fieldentry>
                </qtimetadatafield>
              </qtimetadata>
            </objectbank>
          </questestinterop>
        XML

      expect(@qg.generate_bank(doc, bank, "somemigrationid")).to eq expected_xml
    end
  end

  describe "add_question for text_only_question" do
    it "includes the passage meta_field when question type is text_only_question" do
      qti_generator
      allow(@qg).to receive_messages(aq_mig_id: "dummy_id", qq_mig_id: "dummy_id")

      html_exporter = instance_double(CC::CCHelper::HtmlContentExporter)
      allow(html_exporter).to receive(:html_content) { |s| s }
      @qg.instance_variable_set(:@html_exporter, html_exporter)

      question = {
        "question_type" => "text_only_question",
        "points_possible" => 5,
        "answers" => [],
        "name" => "Text Only Question",
        "question_name" => "Text Only Question",
        "question_text" => "Some text"
      }

      output = +""
      doc = Builder::XmlMarkup.new(target: output, indent: 2)
      @qg.send(:add_question, doc, question)

      expected_xml = <<~XML
        <item ident="dummy_id" title="Text Only Question">
          <itemmetadata>
            <qtimetadata>
              <qtimetadatafield>
                <fieldlabel>question_type</fieldlabel>
                <fieldentry>text_only_question</fieldentry>
              </qtimetadatafield>
              <qtimetadatafield>
                <fieldlabel>points_possible</fieldlabel>
                <fieldentry>5</fieldentry>
              </qtimetadatafield>
              <qtimetadatafield>
                <fieldlabel>original_answer_ids</fieldlabel>
                <fieldentry></fieldentry>
              </qtimetadatafield>
              <qtimetadatafield>
                <fieldlabel>passage</fieldlabel>
                <fieldentry>true</fieldentry>
              </qtimetadatafield>
            </qtimetadata>
          </itemmetadata>
          <presentation>
            <material>
              <mattext texttype="text/html">&lt;div&gt;Some text&lt;/div&gt;</mattext>
            </material>
          </presentation>
        </item>
      XML

      expect(output).to eq(expected_xml)
    end
  end
end
