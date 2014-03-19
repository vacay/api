set :stage, :production

set :ssh_options, {
  forward_agent: true,
  user: 't3rr0r'
}

set :filter, :roles => %w{api worker}