# -*- mode: ruby -*-
# vi: set ft=ruby :

# Vagrantfile API/syntax version. Don't touch unless you know what you're doing!
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.synced_folder "./project/", "/opt/project/"
  config.vm.network "forwarded_port", guest: 8000, host: 8000
  #config.vm.network :public_network, bridge: 'eth0'
  #config.vm.provider :virtualbox do |vb|
  #  vb.gui = true
  #end

  # config.ssh.forward_agent = true

  config.vm.provision "ansible" do |ansible|
    ansible.playbook = "playbook.yml"
  end
end
