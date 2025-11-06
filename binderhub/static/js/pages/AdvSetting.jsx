import { useEffect, useState } from "react";

export default function AdvancedSettings({
  className,
  baseUrl = "/",
  values = {},
  onChange = () => {},
  refreshInterval = 60000, // default: refresh every 60 seconds
}) {
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [siteOptions, setSiteOptions] = useState([]);
  const [resources, setResources] = useState([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [hubUrl, setHubUrl] = useState(null); // <-- add this

  const handleInputChange = (field, value) => {
    onChange({ ...values, [field]: value });
  };

  //
  // Fetch site list and hub URL periodically
  //
  useEffect(() => {
    if (!badgeVisible) return;

    let isMounted = true;
    let interval;

    async function fetchSites() {
      try {
        setLoadingSites(true);
        setFetchError(null);
        const response = await fetch(`${baseUrl}_spawnerconfig`);
        if (!response.ok) throw new Error("Failed to fetch _spawnerconfig");
        const data = await response.json();
        if (isMounted) {
          if (Array.isArray(data.sites)) {
            setSiteOptions(data.sites);
            if (values.sites === "local" && data.sites.length > 0)
              values.sites = data.sites[0].name;
          }
          if (data.hub_connect_url) setHubUrl(data.hub_connect_url); // <-- get hub URL
        }
      } catch (err) {
        console.error("Failed to fetch site list:", err);
        if (isMounted) setFetchError("Failed to fetch site list");
      } finally {
        if (isMounted) setLoadingSites(false);
      }
    }

    fetchSites();
    interval = setInterval(fetchSites, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [badgeVisible, baseUrl, refreshInterval]);

  //
  // Fetch resources periodically for the selected site
  //
  useEffect(() => {
    if (!values.sites || siteOptions.length === 0) return;

    let isMounted = true;
    let interval;

    async function fetchResources() {
      setLoadingResources(true);
      try {
        const selectedSite = siteOptions.find((s) => s.name === values.sites);
        if (!selectedSite) return;

        let resourceData = [];

        if (selectedSite === siteOptions[0]) {
          // For first site, dynamically fetch resources from /resources
          const res = await fetch(`${baseUrl}resources`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.resources)) resourceData = data.resources;
          }
        } else if (Array.isArray(selectedSite.resources?.gpu)) {
          resourceData = selectedSite.resources.gpu;
        }

        if (isMounted) {
          setResources(resourceData);
          const anyAvailable = resourceData.some((r) => r.available > 0);
          if (anyAvailable && !values.gpuProduct)
            handleInputChange("gpuProduct", "Any");
        }
      } catch (err) {
        console.error("Failed to fetch resources:", err);
        if (isMounted) setResources([]);
      } finally {
        if (isMounted) setLoadingResources(false);
      }
    }

    fetchResources();
    interval = setInterval(fetchResources, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [values.sites, siteOptions, baseUrl, refreshInterval]);

  const gpuOptions = resources.map((gpu) => ({
    product: gpu.product,
    available: gpu.available,
    count: gpu.count,
  }));
  const anyAvailable = gpuOptions.some((gpu) => gpu.available > 0);

  return (
    <form className={`d-flex flex-column gap-3 ${className}`}>
      <div className="card">
        <div className="card-header d-flex align-items-baseline">
          <span className="flex-fill">
            Advanced setting - sites and resource customizations
          </span>
          <button
            id="btn-show-badge"
            className="btn btn-link"
            type="button"
            aria-controls="badge-container"
            aria-expanded={badgeVisible}
            onClick={() => setBadgeVisible((prev) => !prev)}
          >
            {badgeVisible ? "hide" : "show"}
          </button>
        </div>

        <div
          className={`card-body position-relative ${
            badgeVisible ? "" : "d-none"
          }`}
          id="badge-container"
        >
          {/* ---- Site selection ---- */}
          {siteOptions.length > 1 && (
            <div className="form-row row">
              <div className="form-group col-md-4">
                <label htmlFor="sites">Sites</label>
                <div className="input-group">
                  <select
                    id="sites"
                    className="form-control"
                    value={values.sites || ""}
                    onChange={(e) =>
                      handleInputChange("sites", e.target.value)
                    }
                    disabled={loadingSites}
                  >
                    {loadingSites ? (
                      <option>Fetching site list...</option>
                    ) : (
                      siteOptions.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {fetchError && (
                  <small className="text-danger">{fetchError}</small>
                )}
              </div>
            </div>
          )}

          {/* ---- GPU product and count ---- */}
          {gpuOptions.length > 0 && (
            <div className="form-row row" style={{ marginTop: "1rem" }}>
              <div className="form-group col-md-6">
                <label htmlFor="gpu-product">
                  GPU Model - name (avail/total)
                </label>
                <div className="input-group">
                  <select
                    id="gpu-product"
                    className="form-control"
                    value={values.gpuProduct || ""}
                    onChange={(e) =>
                      handleInputChange("gpuProduct", e.target.value)
                    }
                    disabled={loadingResources}
                  >
                    {loadingResources ? (
                      <option>Loading GPUs...</option>
                    ) : (
                      <>
                        {anyAvailable && (
                          <option value="Any">Any (auto-assign GPU)</option>
                        )}
                        {gpuOptions.map((gpu) => (
                          <option
                            key={gpu.product}
                            value={gpu.product}
                            disabled={gpu.available === 0}
                          >
                            {gpu.product} ({gpu.available}/{gpu.count})
                          </option>
                        ))}
                      </>
                    )}
                  </select>

                  <div className="input-group-btn" style={{ minWidth: "80px" }}>
                    <input
                      type="number"
                      className="form-control"
                      id="gpuCount"
                      min="0"
                      max="32"
                      value={values.gpuCount || 0}
                      onChange={(e) =>
                        handleInputChange("gpuCount", parseInt(e.target.value))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---- QoS, CPU, Memory ---- */}
          <div className="form-row row" style={{ marginTop: "1rem" }}>
            <div className="form-group col-md-2">
              <label htmlFor="qos">QoS</label>
              <div className="input-group">
                <div className="checkbox">
                  <label>
                    <input
                      type="checkbox"
                      id="qos"
                      checked={values.qos || false}
                      onChange={(e) =>
                        handleInputChange("qos", e.target.checked)
                      }
                    />{" "}
                    Guaranteed
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group col-md-2">
              <label htmlFor="cpu">CPU</label>
              <div className="input-group">
                <input
                  type="number"
                  id="cpu"
                  className="form-control"
                  min="1"
                  max="32"
                  value={values.cpu || 1}
                  onChange={(e) =>
                    handleInputChange("cpu", parseInt(e.target.value))
                  }
                  disabled={!values.qos}
                />
              </div>
            </div>

            <div className="form-group col-md-2">
              <label htmlFor="memory">Memory</label>
              <div className="input-group">
                <input
                  type="number"
                  id="memory"
                  className="form-control"
                  step="0.01"
                  value={values.memory || 1.0}
                  onChange={(e) =>
                    handleInputChange("memory", parseFloat(e.target.value))
                  }
                  disabled={!values.qos}
                />
                <span className="input-group-addon">GB</span>
              </div>
            </div>
          </div>

          {/* ---- JupyterHub Home link (bottom-right) ---- */}
          {hubUrl && (
            <div
              style={{
                position: "absolute",
                bottom: "10px",
                right: "15px",
              }}
            >
              <a
                href={hubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-link"
              >
                JupyterHub Home
              </a>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

