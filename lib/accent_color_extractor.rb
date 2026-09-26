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

require "mini_magick"

# Picks a course's dashboard-card accent colour by sampling its course image.
#
# Downsamples the image to a small palette with ImageMagick and scores each
# swatch the way Android's Palette API / Vibrant.js do: prefer the most
# common swatch that's actually saturated and mid-toned (a "vibrant" colour),
# and only fall back to the most common swatch overall (which is often a
# background white/black/gray) when nothing in the image qualifies.
module AccentColorExtractor
  SAMPLE_GEOMETRY = "50x50"
  MAX_SWATCHES = 12
  MIN_SATURATION = 0.15
  MIN_LIGHTNESS = 0.15
  MAX_LIGHTNESS = 0.85

  Swatch = Struct.new(:population, :r, :g, :b) do
    def hex
      format("#%02X%02X%02X", r, g, b)
    end

    def saturation
      hsl[1]
    end

    def lightness
      hsl[2]
    end

    private

    def hsl
      @hsl ||= begin
        rf, gf, bf = [r, g, b].map { |c| c / 255.0 }
        max = [rf, gf, bf].max
        min = [rf, gf, bf].min
        l = (max + min) / 2.0
        if max == min
          [0.0, 0.0, l]
        else
          d = max - min
          s = (l > 0.5) ? d / (2.0 - max - min) : d / (max + min)
          [0.0, s, l]
        end
      end
    end
  end
  private_constant :Swatch

  HISTOGRAM_LINE = /^\s*(?<population>\d+):\s*\(\s*(?<r>\d+)\s*,\s*(?<g>\d+)\s*,\s*(?<b>\d+)\s*(?:,\s*\d+\s*)?\)/

  # Returns a "#RRGGBB" string, or nil if the file couldn't be read or
  # decoded as an image.
  def self.from_file(path)
    output = MiniMagick.convert do |convert|
      convert << path
      convert.resize(SAMPLE_GEOMETRY)
      convert.colors(MAX_SWATCHES.to_s)
      convert.depth(8)
      convert.format("%c")
      convert << "histogram:info:-"
    end
    pick(parse_histogram(output))
  rescue MiniMagick::Error, MiniMagick::Invalid, Errno::ENOENT
    nil
  end

  def self.parse_histogram(output)
    output.each_line.filter_map do |line|
      match = HISTOGRAM_LINE.match(line)
      next unless match

      Swatch.new(match[:population].to_i, match[:r].to_i, match[:g].to_i, match[:b].to_i)
    end
  end
  private_class_method :parse_histogram

  def self.pick(swatches)
    return nil if swatches.empty?

    vibrant = swatches.select do |s|
      s.saturation >= MIN_SATURATION && s.lightness.between?(MIN_LIGHTNESS, MAX_LIGHTNESS)
    end
    best = (vibrant.presence || swatches).max_by(&:population)
    best&.hex
  end
  private_class_method :pick

  # Fetches a course's image (whichever of image_id/image_url it has set)
  # and extracts an accent colour from it. Downloads happen synchronously,
  # so callers should only invoke this from a background job.
  def self.from_course(course)
    if course.image_id.present?
      from_attachment(course)
    elsif course.image_url.present?
      from_url(course.image_url)
    end
  end

  def self.from_attachment(course)
    attachment = course.attachments.active.where(id: course.image_id).first
    return nil unless attachment

    # without a block, #open returns the local (or downloaded-to-local)
    # file itself instead of streaming it chunk by chunk
    file = attachment.open
    return nil unless file

    from_file(file.path)
  rescue
    nil
  ensure
    file&.close
  end
  private_class_method :from_attachment

  def self.from_url(url)
    Tempfile.create("course_accent_color") do |tempfile|
      tempfile.binmode
      CanvasHttp.get(url) do |response|
        raise CanvasHttp::InvalidResponseCodeError, response.code unless response.is_a?(Net::HTTPSuccess)

        response.read_body { |chunk| tempfile.write(chunk) }
      end
      tempfile.flush
      from_file(tempfile.path)
    end
  rescue CanvasHttp::Error, *CanvasHttp::UPSTREAM_HTTP_ERRORS
    nil
  end
  private_class_method :from_url
end
