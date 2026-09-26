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

require "spec_helper"

describe AccentColorExtractor do
  describe ".pick" do
    def swatch(count, hex)
      r = hex[0..1].to_i(16)
      g = hex[2..3].to_i(16)
      b = hex[4..5].to_i(16)
      described_class.send(:parse_histogram, "#{count}: (#{r},#{g},#{b})\n").first
    end

    it "returns nil for an empty list" do
      expect(described_class.send(:pick, [])).to be_nil
    end

    it "prefers the most common vibrant swatch over a more common gray one" do
      swatches = [swatch(900, "FFFFFF"), swatch(100, "1E88E5")]
      expect(described_class.send(:pick, swatches)).to eq "#1E88E5"
    end

    it "falls back to the most common swatch when nothing is vibrant" do
      swatches = [swatch(900, "FAFAFA"), swatch(100, "101010")]
      expect(described_class.send(:pick, swatches)).to eq "#FAFAFA"
    end
  end

  describe ".parse_histogram" do
    it "parses ImageMagick histogram:info: output, ignoring alpha" do
      output = <<~TEXT
        234: (255,255,255,255) #FFFFFFFF white
        12: ( 12, 24, 36,255) #0C1824FF srgb(12,24,36)
      TEXT

      swatches = described_class.send(:parse_histogram, output)
      expect(swatches.map(&:population)).to eq [234, 12]
      expect(swatches.map(&:hex)).to eq ["#FFFFFF", "#0C1824"]
    end
  end

  describe ".from_file" do
    def solid_color_png(hex)
      path = "#{Dir.tmpdir}/accent_color_extractor_spec_#{hex}.png"
      MiniMagick.convert do |convert|
        convert.size("20x20")
        convert << "xc:##{hex}"
        convert << path
      end
      path
    end

    it "extracts the dominant colour from a solid-colour image" do
      path = solid_color_png("2E7D32")
      expect(described_class.from_file(path)).to eq "#2E7D32"
    end

    it "returns nil for a nonexistent file" do
      expect(described_class.from_file("/tmp/does-not-exist-#{SecureRandom.uuid}.png")).to be_nil
    end
  end

  describe ".from_course" do
    it "reads from the course's attachment when image_id is set" do
      course = course_model
      attachment = attachment_model(context: course, uploaded_data: stub_png_data, content_type: "image/png")
      course.image_id = attachment.id

      expect(described_class.from_course(course)).to match(/\A#[0-9A-F]{6}\z/)
    end

    it "downloads image_url when image_id is not set" do
      course = course_model
      course.image_url = "http://example.com/course.png"

      expect(described_class).to receive(:from_url).with(course.image_url).and_return("#123456")
      expect(described_class.from_course(course)).to eq "#123456"
    end

    it "returns nil when neither image_id nor image_url is set" do
      course = course_model
      expect(described_class.from_course(course)).to be_nil
    end
  end
end
