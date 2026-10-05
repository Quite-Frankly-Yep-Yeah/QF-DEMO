# frozen_string_literal: true

namespace :qf do
  desc "Load a sample course with a teacher and three students (docs/install.md). " \
       "DEMO_PASSWORD sets the password for new logins; ACCOUNT_ID picks the school (default: the default account)."
  task demo_data: :environment do
    if Rails.env.production? && ENV["ALLOW_DEMO_DATA"] != "1"
      abort "Refusing to add demo logins to a production site. Set ALLOW_DEMO_DATA=1 if you really mean it."
    end

    root_account = ENV["ACCOUNT_ID"] ? Account.find(ENV["ACCOUNT_ID"]) : Account.default
    password = ENV["DEMO_PASSWORD"].presence || SecureRandom.alphanumeric(14)
    result = QfDemoData.load!(root_account, password:)

    puts "Demo course: #{result[:course].name} (id #{result[:course].id})"
    puts "Teacher: #{QfDemoData::TEACHER[:login]}"
    QfDemoData::STUDENTS.each { |s| puts "Student: #{s[:login]}" }
    if result[:created].any?
      puts "New logins (#{result[:created].size}) have the password: #{password}"
    else
      puts "All demo logins already existed and keep their passwords."
    end
  end
end
