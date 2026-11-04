import { filterCuratedRepos } from "./curatedRepos";

const repos = [
  { name: "cpu-only", accelerator: "cpu" },
  { name: "gpu-only", accelerator: "gpu" },
  { name: "untagged" },
];

const names = (list) => list.map((r) => r.name);

test("without GPUs requested, hides GPU entries", () => {
  expect(names(filterCuratedRepos(repos, 0))).toEqual(["cpu-only", "untagged"]);
});

test("with GPUs requested, hides CPU entries", () => {
  expect(names(filterCuratedRepos(repos, 2))).toEqual(["gpu-only", "untagged"]);
});

test.each([undefined, null, NaN])(
  "treats a missing GPU count (%p) as no GPUs",
  (gpuCount) => {
    expect(names(filterCuratedRepos(repos, gpuCount))).toEqual([
      "cpu-only",
      "untagged",
    ]);
  },
);
