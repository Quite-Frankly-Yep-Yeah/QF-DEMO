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

describe Supports::AnthropicConnectionTest do
  def client_answering(outcome)
    messages = Class.new do
      define_method(:create) do |**_kwargs|
        raise outcome if outcome.is_a?(Exception)

        outcome
      end
    end.new
    Struct.new(:messages).new(messages)
  end

  def api_error(klass, status: nil, message: "PROVIDER-TEXT sk-ant-secret")
    args = { url: URI("https://api.anthropic.com"), message: }
    args.merge!(status:, headers: {}, body: nil, request: nil, response: nil) if status
    klass.new(**args)
  end

  def call(outcome)
    described_class.call(api_key: "sk-ant-secret", model: "claude-opus-5-5", client: client_answering(outcome))
  end

  it "says it works when the service answers" do
    expect(call(Struct.new(:stop_reason).new(:end_turn))).to eq(ok: true, message: "It works.")
  end

  it "says the key was rejected" do
    expect(call(api_error(Anthropic::Errors::AuthenticationError, status: 401))).to eq(ok: false, message: "The key was rejected.")
    expect(call(api_error(Anthropic::Errors::PermissionDeniedError, status: 403))).to eq(ok: false, message: "The key was rejected.")
  end

  it "says the model isn't available to the key" do
    expect(call(api_error(Anthropic::Errors::NotFoundError, status: 404)))
      .to eq(ok: false, message: "That model isn't available to this key.")
    expect(call(api_error(Anthropic::Errors::BadRequestError, status: 400)))
      .to eq(ok: false, message: "That model isn't available to this key.")
  end

  it "says the service couldn't be reached, without the provider's text or the key" do
    result = call(api_error(Anthropic::Errors::APIConnectionError))
    expect(result).to eq(ok: false, message: "The service couldn't be reached.")
    expect(result.to_s).not_to include("PROVIDER-TEXT")
    expect(result.to_s).not_to include("sk-ant-secret")
  end

  it "sends one small request on the chosen model" do
    sent = []
    messages = Class.new do
      define_method(:create) do |**kwargs|
        sent << kwargs
        Struct.new(:stop_reason).new(:end_turn)
      end
    end.new
    described_class.call(api_key: "k", model: "claude-haiku-4-5", client: Struct.new(:messages).new(messages))
    expect(sent.size).to eq 1
    expect(sent.first).to include(model: "claude-haiku-4-5", max_tokens: 256)
  end
end
