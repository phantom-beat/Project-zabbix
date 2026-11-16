"""Cliente minimo de la API JSON-RPC de Zabbix 6.4 (solo libreria estandar)."""
import json
import os
import time
import urllib.error
import urllib.request

URL = os.environ.get("ZBX_URL", "http://zabbix-web:8080/api_jsonrpc.php")
USER = os.environ.get("ZBX_USER", "Admin")
PASSWORD = os.environ.get("ZBX_PASSWORD", "zabbix")


class ZabbixError(Exception):
    pass


class ZabbixAPI:
    def __init__(self, url=URL):
        self.url = url
        self.auth = None
        self._id = 0

    def call(self, method, params=None):
        self._id += 1
        body = {"jsonrpc": "2.0", "method": method, "params": params or {}, "id": self._id}
        if self.auth and method not in ("user.login", "apiinfo.version"):
            body["auth"] = self.auth
        req = urllib.request.Request(
            self.url,
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json-rpc"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)
        if "error" in data:
            err = data["error"]
            raise ZabbixError(f"{method}: {err.get('message')} {err.get('data')}")
        return data["result"]

    def login(self, user=USER, password=PASSWORD, wait_seconds=900):
        """Espera a que el frontend y la BD esten listos y hace login."""
        limite = time.time() + wait_seconds
        ultimo = None
        while time.time() < limite:
            try:
                version = self.call("apiinfo.version")
                self.auth = self.call("user.login", {"username": user, "password": password})
                print(f"[api] Conectado a Zabbix {version} en {self.url}")
                return version
            except (urllib.error.URLError, ConnectionError, TimeoutError, ZabbixError,
                    json.JSONDecodeError, OSError) as exc:
                if str(exc) != ultimo:
                    print(f"[api] Esperando API de Zabbix... ({exc})")
                    ultimo = str(exc)
                time.sleep(10)
        raise SystemExit("[api] La API de Zabbix no respondio a tiempo")
