set :application, 'vacay'
set :repo_url, 'git@github.com:vacay/vacay.git'

set :deploy_to, '/home/t3rr0r/vacay'
set :scm, :git

set :format, :pretty
set :log_level, :debug
set :pty, true

set :default_env, { 'NODE_ENV' => 'production' }
set :keep_releases, 2

set :rubygems_version, '2.1.7'
set :use_sudo, true

ec2_role :api, type: 'api', script_path: 'api/app.js'
ec2_role :worker, type: 'worker', script_path: 'worker/app.js'
ec2_role :monitor, type: 'monitor'
ec2_role :search, type: 'search'

namespace :deploy do
  after :updated, :npm_refresh_symlink
  after :updated, :assets_refresh_symlink
  after :updated, :npm_install
  after :updated, :worker_update_youtubedl
  after :updated, :assets
  
  desc 'Restart node script'
  after :publishing, :restart do
    invoke :forever_stop
    invoke :worker_clean_tmp
    invoke :clean_logs
    sleep 3
    invoke :forever_start
  end
end