# frozen_string_literal: true

gem 'arclight'
gem "blacklight_range_limit"

run 'bundle install'

generate 'blacklight:install', '--devise'
generate 'arclight:install', '-f'

rake 'db:migrate'
