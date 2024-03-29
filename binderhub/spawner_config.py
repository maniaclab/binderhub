from .base import BaseHandler
import yaml
import requests
import json
from requests import HTTPError
import base64
import kubernetes.config
from kubernetes import client

from functools import lru_cache
import time

hub_api = 'http://proxy-public/hub/api/'

class SpawnerConfigHandler(BaseHandler):
    """Serve config"""
    try:
        kubernetes.config.load_incluster_config()
    except kubernetes.config.ConfigException:
        kubernetes.config.load_kube_config()
    api = client.CoreV1Api()
    secrets = api.list_namespaced_secret("binderhub")
    secret = next(s for s in secrets.items if s.metadata.name == "binderhub-values")
    hvstring=base64.b64decode(secret.data.get("values.yaml"))
    harborvalues=yaml.load(hvstring, Loader=yaml.SafeLoader)
    apitoken=harborvalues.get("jupyterhub",{}).get("hub",{}).get("services",{}).get("binder-manager",{}).get("apiToken","")

    def generate_config(self):
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
                gpu['available'] = gpu.get('count', 0) - count        

        return config

    async def get(self):
        self.write(self.generate_config())

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
        headers={'Authorization': 'token %s' % SpawnerConfigHandler.apitoken},
        data=data,
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
        for k, v in servers.items():
            if v["ready"] and int(v.get("user_options", {}).get("resource_requests",{}).get("gpuCount"))>0:
                resources = v.get("user_options", {}).get("resource_requests")
                gpu_count = int(resources.get("gpuCount"))
                gpu_model = resources.get("gpuModel")
                site = v.get("state",{}).get("site")
                if not sites.get(site):
                    sites[site] = {gpu_model:gpu_count}
                elif not sites[site].get(gpu_model):
                    sites[site][gpu_model] = gpu_count
                else:
                    sites[site][gpu_model] = sites[site][gpu_model] + gpu_count
                #print(gpu_count,gpu_model,v["name"])
    #print(sites)
    return sites
