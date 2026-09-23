puts "Shard.current: #{Shard.current.id}"
puts "Account.count: #{Account.count}"
Account.unscoped.order(:id).each { |a| puts "id=#{a.id} global_id=#{a.global_id} name=#{a.name.inspect} root_account_id=#{a.root_account_id}" }
puts "---"
begin
  puts "Account.site_admin: id=#{Account.site_admin.id} global_id=#{Account.site_admin.global_id}"
rescue => e
  puts "Account.site_admin ERROR: #{e.class}: #{e.message}"
end
begin
  puts "Account.default: id=#{Account.default.id} global_id=#{Account.default.global_id}"
rescue => e
  puts "Account.default ERROR: #{e.class}: #{e.message}"
end
puts "---"
puts "Setting default_account_id=#{Setting.get('default_account_id', 'nil')}"
puts "TermsOfService.count: #{TermsOfService.count}"
