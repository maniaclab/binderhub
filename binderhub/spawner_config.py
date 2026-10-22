from .base import BaseHandler
import asyncio
import os
import yaml
import requests
import json
from requests import HTTPError
from tornado.log import app_log

from functools import lru_cache
import time

hub_api = 'http://proxy-public/hub/api/'
# Seconds to wait for the hub API, so a slow hub can't hang the caller.
hub_api_timeout = 10

def hub_api_token():
    """The binder service's own hub token, which the chart injects from the hub
    Secret. Its scopes (servers, admin:users) cover listing users and their
    servers, so this pod needs no access to Kubernetes Secrets."""
    return os.environ.get("JUPYTERHUB_API_TOKEN", "")

class SpawnerConfigHandler(BaseHandler):
    """Serve config"""

    async def get(self):
        # Serve GPU availability with the servers in use subtracted. Fall back to
        # the static config if the hub can't be reached, so the page still loads.
        try:
            config = await asyncio.wrap_future(self.settings["executor"].submit(generate_config))
        except Exception:
            app_log.exception("Failed to add live GPU usage to the spawner config")
            config = generate_config_test()
        self.write(config)

def generate_config_test():
    """reads spawner config from configuration and add in live gpu availability data"""
    config = dict()
    with open("/etc/binderhub/jhub_spawner_config.yaml",'r') as file:
        config = yaml.safe_load(file)
    return config

def generate_config():
    """reads spawner config from configuration and add in live gpu availability data"""
    config = dict()
    with open("/etc/binderhub/jhub_spawner_config.yaml",'r') as file:
        config = yaml.safe_load(file)

    # count usage and update the data
    usage = update_gpu_usage(ttl_hash=get_ttl_hash())

    sites = config.get("sites", [])
    for site_name, gpu_usage in usage.items():
        site =  next((s for s in sites if s['name'] == site_name), {})
        for model, count in gpu_usage.items():
            gpu = next((g for g in site.get("resources",{}).get('gpu',[]) if g['product'] == model), {})
            gpu['available'] = max(gpu.get('count', 0) - count, 0)
    return config

def get_ttl_hash(seconds=10):
  """Return the same value withing `seconds` time period"""
  return round(time.time() / seconds)

@lru_cache(maxsize=2)
def update_gpu_usage(ttl_hash=None):
    users = api_request('users')
    usage = get_gpu_usage(users)
    return usage

def api_request(path, method='get', data=None):
    if data:
        data = json.dumps(data)
    
    r = requests.request(method, hub_api + path,
        headers={'Authorization': 'token %s' % hub_api_token()},
        data=data,
        timeout=hub_api_timeout,
    )
    try:
        r.raise_for_status()
    except Exception as e:
        try:
            info = r.json()
        except Exception:
            raise e
        if 'message' in info:
            # raise nice json error if there was one
            raise HTTPError("%s: %s" % (r.status_code, info['message'])) from None
        else:
            # raise original
            raise e
    if r.text:
        return r.json()
    else:
        return None

def get_gpu_usage(users):
    sites={}
    for u in users:
        servers = u.get("servers", {})
        #print(servers)
        for k, v in servers.items():
            # None is passed when the no gpu is requested
            if v["ready"] and v.get("user_options", {}).get("resource_requests",{}).get("gpuCount"):
                resources = v.get("user_options", {}).get("resource_requests")
                gpu_count = int(resources.get("gpuCount"))
                gpu_model = resources.get("gpuModel")
                # The server's state is only visible with admin:server_state, which
                # the binder token does not have; the requested site is in user_options.
                site = resources.get("site")
                if not sites.get(site):
                    sites[site] = {gpu_model:gpu_count}
                elif not sites[site].get(gpu_model):
                    sites[site][gpu_model] = gpu_count
                else:
                    sites[site][gpu_model] = sites[site][gpu_model] + gpu_count
                #print(gpu_count,gpu_model,v["name"])
    #print(sites)
    return sites
