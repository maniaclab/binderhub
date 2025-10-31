import { LinkGenerator } from "@jupyterhub/binderhub-react-components/LinkGenerator.jsx";
import { BuilderLauncher } from "@jupyterhub/binderhub-react-components/BuilderLauncher.jsx";
import { HowItWorks } from "@jupyterhub/binderhub-react-components/HowItWorks.jsx";
import { useEffect, useState } from "react";
import { FaviconUpdater } from "@jupyterhub/binderhub-react-components/FaviconUpdater.jsx";
import { Spec, LaunchSpec } from "@jupyterhub/binderhub-client/spec.js";

import AdvancedSettings from './AdvSetting.jsx'

/**
 * @typedef {object} HomePageProps
 * @prop {import("../App.jsx").Provider[]} providers
 * @prop {URL} publicBaseUrl
 * @prop {URL} baseUrl
 * @param {HomePageProps} props
 */
export function HomePage({ providers, publicBaseUrl, baseUrl }) {
  const defaultProvider = providers[0];
  const [selectedProvider, setSelectedProvider] = useState(defaultProvider);
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [urlPath, setUrlPath] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [spec, setSpec] = useState("");
  const [progressState, setProgressState] = useState(null);
  const [advSetting, setAdvSetting] = useState({site: "local", qos: false, cpu: 1, memory: 1.0});

  useEffect(() => {
    const encodedRepo = selectedProvider.repo.urlEncode
      ? encodeURIComponent(repo)
      : repo;
    let actualRef = "";
    if (selectedProvider.ref.enabled) {
      actualRef = ref !== "" ? ref : selectedProvider.ref.default;
    }
    const searchParams = new URLSearchParams();
    if (advSetting.gpuProduct) {
      searchParams.append('gpuModel', advSetting.gpuProduct);
    }
    if (advSetting.gpuCount) {
      searchParams.append('gpuCount', advSetting.gpuCount);
    }
    if (advSetting.qos) {
      searchParams.append('qos', advSetting.qos);
    }
    if (advSetting.cpu) {
      searchParams.append('cpu', advSetting.cpu);
    }
    if (advSetting.memory) {
      searchParams.append('memory', advSetting.memory);
    }
    if (advSetting.sites) {
      searchParams.append('site', advSetting.sites);
    }
    const queryString = searchParams.toString();
    setSpec(
      new Spec(
        `${selectedProvider.id}/${encodedRepo}/${actualRef}?${queryString}`,
        new LaunchSpec(urlPath),
      ),
    );
  }, [selectedProvider, repo, ref, urlPath, advSetting]);

  // Log on initial render and whenever 'count' changes
  useEffect(() => {
    console.log('advSetting has changed:', advSetting);
  }, [advSetting]);

  return (
    <>
      <div className="text-center col-10 mx-auto">
        <h5>Turn a Git repo into a collection of interactive notebooks</h5>
        <p>
          Have a repository full of Jupyter notebooks? With Binder, open those
          notebooks in an executable environment, making your code immediately
          reproducible by anyone, anywhere.
        </p>
        <p className="fw-lighter mt-8">
          New to Binder? Get started with a{" "}
          <a
            href="https://the-turing-way.netlify.app/communication/binder/zero-to-binder.html"
            target="_blank"
            rel="noreferrer"
          >
            Zero-to-Binder tutorial
          </a>{" "}
          in Julia, Python, or R.
        </p>
      </div>
      <LinkGenerator
        className="bg-custom-dark p-4 pb-0 rounded-top"
        publicBaseUrl={publicBaseUrl}
        providers={providers}
        selectedProvider={selectedProvider}
        setSelectedProvider={setSelectedProvider}
        repo={repo}
        setRepo={setRepo}
        reference={ref}
        setReference={setRef}
        urlPath={urlPath}
        setUrlPath={setUrlPath}
        isLaunching={isLaunching}
        setIsLaunching={setIsLaunching}
      />
      <AdvancedSettings 
        className="bg-custom-dark p-4 pt-2 rounded-bottom"
	values={advSetting}
        onChange={setAdvSetting}
	  />
      <BuilderLauncher
        className="bg-custom-dark p-4 pt-2 rounded-bottom"
        baseUrl={baseUrl}
        spec={spec}
        isLaunching={isLaunching}
        setIsLaunching={setIsLaunching}
        progressState={progressState}
        setProgressState={setProgressState}
      />
      <FaviconUpdater progressState={progressState} />
      <HowItWorks />
    </>
  );
}
