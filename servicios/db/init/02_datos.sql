-- Datos de ejemplo en la base "servicios" (MYSQL_DATABASE)
CREATE TABLE IF NOT EXISTS inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host VARCHAR(30) NOT NULL,
  servicio VARCHAR(60) NOT NULL,
  ip VARCHAR(15) NOT NULL,
  puerto INT NOT NULL,
  creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventario (host, servicio, ip, puerto) VALUES
  ('web', 'nginx (HTTP)',  '172.30.0.11', 80),
  ('db',  'MySQL 8',       '172.30.0.12', 3306),
  ('dns', 'BIND9',         '172.30.0.13', 53),
  ('ftp', 'vsftpd',        '172.30.0.14', 21);
