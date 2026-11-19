import kubernetes.config
from kubernetes import client

from traitlets import Any, default
from traitlets.config import LoggingConfigurable
from functools import lru_cache
import os
import time

import yaml

from .base import BaseHandler

# Path to the spawner config shared with the Hub/spawner. The binder pod mounts
# it (see the HelmRelease extraVolumeMounts). Overridable for tests.
SPAWNER_CONFIG_PATH = os.environ.get(
    "JHUB_SPAWNER_CONFIG", "/etc/binderhub/jhub_spawner_config.yaml"
)


def _local_site_gpu_filter():
    """Read the local site's GPU presentation filter from the spawner config.

    Returns ``(node_label_selector, product_allowlist)``:
      * node_label_selector: a label selector ANDed into the GPU node query to
        restrict which hosts/pools are considered (or None).
      * product_allowlist: list of GPU product names to present (empty = all).

    A missing file or missing keys yields ``(None, [])`` -> present every
    discovered GPU, i.e. the previous behavior. This reads the same config the
    spawner enforces at launch, so presentation and enforcement never drift.
    """
    try:
        with open(SPAWNER_CONFIG_PATH) as f:
            cfg = yaml.safe_load(f) or {}
    except Exception:
        return None, []
    site = next((s for s in cfg.get("sites", []) if s.get("local")), None)
    res = (site or {}).get("resources", {}) or {}
    return (
        res.get("gpu_node_label_selector") or None,
        list(res.get("gpu_allowlist") or []),
    )


class ResourcesHandler(BaseHandler,LoggingConfigurable):
    """Serve Resource availability"""

    try:
        kubernetes.config.load_incluster_config()
    except kubernetes.config.ConfigException:
        #kubernetes.config.load_kube_config()
        print("load incluster config exception")
    api = client.CoreV1Api()

    def generate_avail(self):
        #self.log.info("expensive to be called")
        node_label_selector, allowlist = _local_site_gpu_filter()
        avail = get_gpu_availability(
            node_label_selector=node_label_selector,
            ttl_hash=self.get_ttl_hash(),
        )
        if allowlist:
            allow = set(allowlist)
            avail = [g for g in avail if g["product"] in allow]
        return {"resources": avail}

    async def get(self):
        self.write(self.generate_avail())

    def get_ttl_hash(self, seconds=10):
      """Return the same value withing `seconds` time period"""
      return round(time.time() / seconds)

@lru_cache(maxsize=8)
def get_gpu_availability(product=None, memory=None, node_label_selector=None, ttl_hash=None):
    '''
    Looks up a GPU product by its product name or memory cache size, and gets its availability.
    When this function is called without arguments, it gets the availability of every GPU product.
    Returns a list of dicts.

    Function parameters:
    (All parameters are optional.)

    product: (string) The GPU product name
    memory: (int) The GPU memory cache size in megabytes (e.g. 40536)
    node_label_selector: (string) Extra node label selector ANDed with the GPU
        node query to restrict which hosts/pools are considered (e.g.
        "binderhub.io/gpu-pool=public").

    Algorithm for getting GPU availability:

    1. Create a hash map of GPUs grouped by their product name.
    2. Get a set of Kubernetes nodes that have GPU support.
        a. If a product name or cache size is specified, get the set of nodes that supports the product.
        b. If no product name or cache size is specified, get the set of all nodes that have an nvidia.com/gpu.product label.
        c. If a node_label_selector is specified, further restrict the node set to that selector.
    3. Iterate over the set of Kubernetes nodes.
        a. Get the GPU that is used by the node.
        b. Update the hash map.
            i. If the GPU is not in our hash map, add its name, cache size, and count to the hash map.
            ii. If the GPU is in our hash map, increase its count.
        b. Get the set of pods running on this node.
        c. Iterate over the set of pods
            i. Add up all the pod requests for this GPU
        d. To calculate availability, subtract the total number of requests for this GPU from the total number of instances
           <Number of available GPU instances> = <Number of GPU instances> - <Number of GPU requests>
    4. Get the hash map values as a list. Sort the list. Each entry in the list gives the availability of a unique GPU product.
       Return the sorted list of dicts.
    '''

    del ttl_hash  # to emphasize we don't use it and to shut pylint up

    gpus = dict()

    api = ResourcesHandler.api

    if product:
        selector = 'nvidia.com/gpu.product=%s' % product
    elif memory:
        selector = 'nvidia.com/gpu.memory=%s' % memory
    else:
        selector = 'nvidia.com/gpu.product'
    # Restrict discovery to a configured host/node pool so only selected hosts'
    # GPUs are presented.
    if node_label_selector:
        selector = '%s,%s' % (selector, node_label_selector)
    nodes = api.list_node(label_selector=selector)
    for node in nodes.items:
        product = node.metadata.labels['nvidia.com/gpu.product']
        memory = int(node.metadata.labels['nvidia.com/gpu.memory'])
        count = int(node.metadata.labels['nvidia.com/gpu.count'])
        if product not in gpus:
            gpus[product] = dict(product=product, memory=memory, count=count, total_requests=0)
        else:
            gpus[product]['count'] += count
        gpu = gpus[product]
        # Finished pods keep their resource requests in the spec but no longer hold
        # the GPU, so only count pods that are pending or running.
        pods = api.list_pod_for_all_namespaces(field_selector='spec.nodeName=%s,status.phase!=Succeeded,status.phase!=Failed' %node.metadata.name).items
        for pod in pods:
            for container in pod.spec.containers:
                requests = container.resources.requests
                if requests:
                    gpu['total_requests'] += int(requests.get('nvidia.com/gpu', 0))
        gpu['available'] = max(gpu['count'] - gpu['total_requests'], 0)
    return sorted(gpus.values(), key=lambda gpu : gpu['memory'])

#config.load_kube_config()
#logger.info('Loaded default kubeconfig file')
#config.load_incluster_config()
#print(get_gpu_availability())
