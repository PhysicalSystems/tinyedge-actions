# TinyEdge Decide — deployment decision in CI

Sweep a model across the quantization ladder on **real edge devices**, pick the
best deployable variant for a deployment profile, and emit a **signed,
tamper-evident deployment manifest** — all inside your pipeline. The build fails
if nothing meets the profile's constraints.

This is the decision engine wired into CI: push a model → TinyEdge benchmarks the
whole quant ladder on the device you target → tells you the single variant to
ship → hands you a cryptographic manifest of *what* was chosen and *why*.

## Prerequisites

- **A `TINYEDGE_API_KEY`** stored as a repo secret.
- **An always-on device** connected to your TinyEdge account during the run. The
  sweep queues real on-device jobs; a runner that's offline (a sleeping phone)
  will stall the step. A mains-powered board (e.g. a Jetson) is the natural CI
  device.
- `tinyedge >= 0.9.1` (the action installs it for you).

## Usage

```yaml
# .github/workflows/ship-edge-model.yml
name: Decide edge deployment
on:
  push:
    paths: ['models/**']        # run when a model changes
  workflow_dispatch:

jobs:
  decide:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: decide
        uses: PhysicalSystems/tinyedge-actions/decide@v1
        with:
          api-key: ${{ secrets.TINYEDGE_API_KEY }}
          model: models/llama-3.2-1b-f16.gguf
          device: jetson-orin-nano
          profile: max_quality          # or realtime / battery / cheapest_viable
          dataset: eval/wikitext         # enables on-device perplexity (quality axis)
          manifest-path: tinyedge-manifest.json

      # The signed manifest is the deployable artifact — keep it with the build.
      - uses: actions/upload-artifact@v4
        if: steps.decide.outputs.verdict == 'ok'
        with:
          name: tinyedge-manifest
          path: tinyedge-manifest.json

      - run: echo "Ship → ${{ steps.decide.outputs.verdict }} (sweep ${{ steps.decide.outputs.group-id }})"
```

If no variant fits the profile's constraints, the `decide` step exits non-zero
and **fails the job** — so a model that can't be deployed within budget never
silently passes.

## Inputs

| input | required | default | notes |
|-------|----------|---------|-------|
| `api-key` | yes | — | `${{ secrets.TINYEDGE_API_KEY }}` |
| `model` | yes | — | local `.onnx`/`.gguf` path, or `hf:owner/repo` |
| `device` | yes | — | device id to sweep on (use an always-on runner) |
| `profile` | no | `max_quality` | `max_quality` \| `cheapest_viable` \| `realtime` \| `battery` |
| `dataset` | no | — | labeled set / corpus for on-device quality (needed for `max_quality`) |
| `quants` | no | full ladder | override, e.g. `q8_0,q4_k_m` |
| `manifest-path` | no | `tinyedge-manifest.json` | where to write the signed manifest |
| `api-base` | no | `https://tinyedge.ai/api` | self-host / staging |
| `tinyedge-version` | no | latest | pin the SDK version |

## Outputs

| output | notes |
|--------|-------|
| `group-id` | the sweep group id (inspect it at `tinyedge.ai/dashboard/benchmarks/sweep/<id>`) |
| `verdict` | `ok` when a deployable variant was found, else the failure reason |
| `manifest-path` | path to the signed manifest (present when `verdict == ok`) |

## Verifying the manifest

The manifest is Ed25519-signed. Fetch the public key at
`https://tinyedge.ai/api/manifest/public-key` and verify the signature over the
canonical JSON (the `signature` + `signatureAlg` fields excluded) — anyone can
confirm which artifact was chosen, untampered.

## Gate-only variant

If you just want a regression gate against a fixed baseline (not a fresh
decision), use the sibling [`actions/validate`](../validate) action instead.
