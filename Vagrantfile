# -*- mode: ruby -*-
# vi: set ft=ruby :
#
# Proyecto 7 - Monitoreo de infraestructura con Zabbix
# Servicios Telematicos 2026
#
# Dos maquinas NUEVAS (distintas de "servidor" 192.168.50.3 y "cliente" 192.168.50.2
# de las practicas anteriores), en su propia red privada 192.168.60.0/24:
#
#   zbx-server    192.168.60.10  -> Docker: PostgreSQL + Zabbix Server (imagen propia)
#                                   + Zabbix Web + Zabbix Agent 2 + MailHog
#   zbx-servicios 192.168.60.20  -> Docker: web (nginx), db (MySQL), dns (BIND9), ftp (vsftpd)
#                                   cada uno con su Zabbix Agent 2 + Zabbix Proxy
#
# Uso:  vagrant up            (levanta las dos, primero el servidor)
#       vagrant ssh zbx-server
#       vagrant ssh zbx-servicios

SERVER_IP    = "192.168.60.10"
SERVICIOS_IP = "192.168.60.20"
BOX          = "bento/ubuntu-22.04"
# Memoria ajustable si el anfitrion tiene poca RAM libre, p. ej.:
#   PowerShell: $env:ST_MEM_SERVER=2048; $env:ST_MEM_SERVICIOS=1792; vagrant up
MEM_SERVER    = (ENV["ST_MEM_SERVER"]    || 3072).to_i
MEM_SERVICIOS = (ENV["ST_MEM_SERVICIOS"] || 2560).to_i
# vCPU: el frontend de Zabbix (PHP-FPM + PostgreSQL) es el cuello de botella bajo carga
CPU_SERVER    = (ENV["ST_CPU_SERVER"]    || 4).to_i
CPU_SERVICIOS = (ENV["ST_CPU_SERVICIOS"] || 2).to_i

Vagrant.configure("2") do |config|
  config.vm.box = BOX
  config.vm.boot_timeout = 600

  # Resolver DNS a traves de Windows (evita VMs sin DNS en la red NAT)
  config.vm.provider "virtualbox" do |vb|
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
  end

  # ------------------------------------------------------------------
  # VM 1: Servidor de monitoreo Zabbix
  # ------------------------------------------------------------------
  config.vm.define "zbx-server", primary: true do |srv|
    srv.vm.hostname = "zbx-server"
    srv.vm.network :private_network, ip: SERVER_IP
    srv.vm.provider "virtualbox" do |vb|
      vb.name   = "ST-P7-zbx-server"
      vb.memory = MEM_SERVER
      vb.cpus   = CPU_SERVER
    end
    srv.vm.provision "shell", path: "provision/instalar_docker.sh"
    srv.vm.provision "shell", path: "provision/desplegar.sh", args: ["servidor"]
  end

  # ------------------------------------------------------------------
  # VM 2: Infraestructura monitoreada (4 hosts en contenedores)
  # ------------------------------------------------------------------
  config.vm.define "zbx-servicios" do |svc|
    svc.vm.hostname = "zbx-servicios"
    svc.vm.network :private_network, ip: SERVICIOS_IP
    svc.vm.provider "virtualbox" do |vb|
      vb.name   = "ST-P7-zbx-servicios"
      vb.memory = MEM_SERVICIOS
      vb.cpus   = CPU_SERVICIOS
    end
    svc.vm.provision "shell", path: "provision/instalar_docker.sh"
    svc.vm.provision "shell", path: "provision/desplegar.sh", args: ["servicios"]
  end
end
