# TinyEdge Validate — GitHub Action

Benchmark your model on **real edge devices** on every change and **fail the build
when it regresses** against a baseline (latency, memory, accuracy, thermals).

It's a thin wrapper around the `tinyedge` CLI: it installs the SDK, runs
`tinyedge validate`, and the exit code gates your job.

## Quick start

One repo secret (`TINYEDGE_API_KEY`, free key from the console) and three lines.
No baseline setup: the **first run saves the baseline automatically**, every
later run compares against it and fails the job on regression.

```yaml
name: Edge regression check
on:
  schedule: [{ cron: '0 6 * * *' }]   # daily — see only-on-change below
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: PhysicalSystems/tinyedge-actions/validate@v1
        with:
          api-key: ${{ secrets.TINYEDGE_API_KEY }}
          model: "hf:your-org/your-model-GGUF/your-model-Q4_K_M.gguf"
          device: jetson-orin-nano
          only-on-change: true        # skip the device run while the HF repo is unchanged
```

With `only-on-change: true`, a scheduled run first checks the Hugging Face
repo's commit sha (one metadata call). Unchanged → the step exits 0 without
queueing a device job; a new revision → full on-device validation against the
baseline. That's the whole "re-check my model on real hardware whenever it's
updated" loop.

## Gating pull requests

For models that live in your own repo, gate PRs instead of (or as well as) the
cron:

```yaml
on:
  pull_request:
    paths: ['models/**']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: PhysicalSystems/tinyedge-actions/validate@v1
        with:
          api-key: ${{ secrets.TINYEDGE_API_KEY }}
          model: ./models/model.gguf
          device: oppo-a74
          tolerance: 10                  # fail if a perf metric is >10% worse than baseline
          max-latency: 220               # hard p50 latency budget (ms)
          min-accuracy: 0.85             # hard accuracy floor
```

The job **fails (exit 1)** if any metric regresses past your thresholds, with a
per-metric breakdown in the log, and **passes (exit 0)** otherwise.

## Pinning a baseline

`baseline` defaults to `auto` (match by model + device, create on first run).
To pin a specific known-good run instead:

- in the console at **Validation → save a baseline**, or
- `tinyedge baseline save <job-id> --name "v1 / oppo-a74"` → copy the id,

then pass `baseline: bl_xxxxxxxx`.

## Prerequisites

1. A TinyEdge API key → store it as a repo secret, e.g. `TINYEDGE_API_KEY`.
2. A device online during the run (a mains-powered board like a Jetson is the
   natural CI device).

## Inputs

| Input | Required | Description |
|---|---|---|
| `api-key` | yes | TinyEdge API key (use a secret). |
| `model` | – | Model to validate: `hf:owner/repo/file.gguf` or a local `.onnx`/`.gguf` path. Omit if using `model-id`. |
| `model-id` | – | Id of an already-uploaded model. |
| `baseline` | – | Baseline id, or `auto` (default): match by model+device, save on first run. |
| `only-on-change` | – | `hf:` models — exit 0 without a device run when the repo revision hasn't changed since the last validation. |
| `device` | – | Device id. Defaults to the baseline's device; required on the first `auto` run. |
| `runtime` | – | Runtime override (e.g. `onnxruntime`, `tensorrt`, `llamacpp`). |
| `precision` | – | `fp32` (default) `\| fp16 \| int8 \| int4`. |
| `dataset` | – | Labeled test set (folder/archive) for on-device accuracy. |
| `tolerance` | – | Allowed % perf drift vs baseline (default 10). |
| `max-latency` | – | Absolute p50 latency budget (ms). |
| `max-rss` | – | Absolute peak-RAM budget (MB). |
| `min-accuracy` | – | Absolute minimum top-1 accuracy (0–1). |
| `api-base` | – | API base URL (default `https://tinyedge.ai/api`). |
| `tinyedge-version` | – | Pin the SDK version (default: latest, needs ≥ 0.10.0). |

## Notes

- Needs the `tinyedge` SDK **≥ 0.10.0** on PyPI (the version that ships
  `--baseline auto` and `--only-on-change`).
- A device must be online to claim the job; the run blocks until it completes or
  times out.
- `only-on-change` skips **only on a positive match** — if the repo's sha can't
  be resolved (network hiccup, gated repo), the run proceeds rather than faking
  a pass.
