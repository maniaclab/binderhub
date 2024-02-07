from .base import BaseHandler
import yaml

class SpawnerConfigHandler(BaseHandler):
    """Serve config"""

    def generate_config(self):
        config = dict()
        with open("/etc/binderhub/jhub_spawner_config.yaml",'r') as file:
            config = yaml.safe_load(file)
        return config

    async def get(self):
        self.write(self.generate_config())
