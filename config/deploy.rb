# config valid only for Capistrano 3.0.1
lock '3.0.1'

set :application, 'vacay'
set :repo_url, 'git@github.com:vacay/api.git'

set :deploy_to, '/home/deploy/vacay'
set :pty, true

# Default value for :linked_files is []
# set :linked_files, %w{config/database.yml}

# Default value for linked_dirs is []
# set :linked_dirs, %w{bin log tmp/pids tmp/cache tmp/sockets vendor/bundle public/system}

set :default_env, { 'NODE_ENV' => 'production' }
set :keep_releases, 2

set :use_sudo, true

namespace :deploy do
  after :updated, :npm_refresh_symlink
  after :updated, :npm_install

  desc 'Restart node script'
  after :publishing, :restart do
    invoke :forever_stop
    invoke :clean_logs
    invoke :forever_cleanlogs
    sleep 3
    invoke :forever_start
  end
end
