/**
 * Curated repos to offer for the requested GPU count.
 *
 * An entry's optional `accelerator` ("cpu" or "gpu", from
 * jhub_spawner_config.yaml) says which kind of launch its image is for:
 * "gpu" entries show only when GPUs are requested, "cpu" entries only when
 * none are. Entries without it always show. A missing or non-numeric GPU
 * count (the advanced settings start without one) means no GPUs.
 *
 * @param {object[]} repos
 * @param {number | undefined} gpuCount
 * @returns {object[]}
 */
export function filterCuratedRepos(repos, gpuCount) {
  const wanted = (gpuCount || 0) > 0 ? "gpu" : "cpu";
  return repos.filter((r) => !r.accelerator || r.accelerator === wanted);
}
