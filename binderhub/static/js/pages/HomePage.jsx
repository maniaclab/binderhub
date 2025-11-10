//import { LinkGenerator } from "@jupyterhub/binderhub-react-components/LinkGenerator.jsx";
import { BuilderLauncher } from "@jupyterhub/binderhub-react-components/BuilderLauncher.jsx";
import { HowItWorks } from "@jupyterhub/binderhub-react-components/HowItWorks.jsx";
import { useEffect, useState } from "react";
import { FaviconUpdater } from "@jupyterhub/binderhub-react-components/FaviconUpdater.jsx";
import { Spec, LaunchSpec } from "@jupyterhub/binderhub-client/spec.js";
import AdvancedSettings from './AdvSetting.jsx';
import { LinkGenerator } from './LinkGenerator.jsx';
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
  const [advSetting, setAdvSetting] = useState({
    sites: "local",
    qos: false,
    cpu: 1,
    memory: 1.0
  });

  const [curatedRepos, setCuratedRepos] = useState([]);

  // Fetch curated repos once
  useEffect(() => {
    const fetchCuratedRepos = async () => {
      try {
        const response = await fetch("_spawnerconfig");
        if (!response.ok) {
          throw new Error(`HTTP error! ${response.status}`);
        }
        const data = await response.json();
        if (data.curatedRepos) {
          setCuratedRepos(data.curatedRepos);
        }
      } catch (error) {
        console.error("Failed to fetch curated repos:", error);
      }
    };
    fetchCuratedRepos();
  }, []);

  // Update spec on changes
  useEffect(() => {
    const encodedRepo = selectedProvider.repo.urlEncode
      ? encodeURIComponent(repo)
      : repo;
    let actualRef = "";
    if (selectedProvider.ref.enabled) {
      actualRef = ref !== "" ? ref : selectedProvider.ref.default;
    }

    const searchParams = new URLSearchParams();
    if (advSetting.gpuProduct) searchParams.append("gpuModel", advSetting.gpuProduct);
    if (advSetting.gpuCount) searchParams.append("gpuCount", advSetting.gpuCount);
    if (advSetting.qos) searchParams.append("qos", advSetting.qos);
    if (advSetting.cpu) searchParams.append("cpu", advSetting.cpu);
    if (advSetting.memory) searchParams.append("memory", advSetting.memory);
    if (advSetting.sites) searchParams.append("site", advSetting.sites);

    const queryString = searchParams.toString();
    setSpec(
      new Spec(
        `${selectedProvider.id}/${encodedRepo}/${actualRef}?${queryString}`,
        new LaunchSpec(urlPath),
      ),
    );
  }, [selectedProvider, repo, ref, urlPath, advSetting]);

  // Log on initial render and whenever 'advSetting' changes
  useEffect(() => {
    console.log("advSetting has changed:", advSetting);
  }, [advSetting]);

  const handleCuratedRepoChange = (e) => {
    const selectedName = e.target.value;
    const chosen = curatedRepos.find((r) => r.name === selectedName);
    if (chosen) {
      const providerMatch = providers.find((p) => p.id === chosen.provider);
      if (providerMatch) {
        setSelectedProvider(providerMatch);
      }
      setRepo(chosen.repo);
      setRef(chosen.ref);
    }
  };

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
        className="bg-custom-dark p-4 pt-2"
        values={advSetting}
        onChange={setAdvSetting}
      />

      {/* Curated Repos Panel (only shown if present) */}
      {curatedRepos && curatedRepos.length > 0 && (
        <form className="bg-custom-dark p-4 pt-2 rounded-bottom">
          <h5 className="form-label mb-2">Curated Repositories</h5>
          <div className="input-group">
            <select
              className="form-control border border-2 border-end-0"
              onChange={(e) => {
                const selected = curatedRepos.find(
                  (r) => r.name === e.target.value
                );
                if (selected) {
                  setRepo(selected.repo);
                  setRef(selected.ref);
                  setSelectedProvider(
                    providers.find((p) => p.id === selected.provider) ||
                      selectedProvider
                  );
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                Select a curated repo...
              </option>
              {curatedRepos.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary border border-2 border-start-0"
              disabled
              style={{ cursor: "default" }}
            >
              <i className="bi bi-journal-code"></i>
            </button>
          </div>
        </form>
      )}

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

