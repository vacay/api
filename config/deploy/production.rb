server 'ec2-54-84-243-147.compute-1.amazonaws.com', roles: %w{api}, ssh_options: {
  user: 'deploy', # overrides user setting above
  forward_agent: true,
  auth_methods: %w(publickey)
}
