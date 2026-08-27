# TinyEdge — decide-in-CI demo

This directory is a copy-ready workflow template maintained with the published TinyEdge Actions. Copy `decide.yml` into your repository as `.github/workflows/decide.yml`; it is not registered as a workflow in this repository, so it cannot accidentally schedule physical hardware.

Maintainers can verify its migration integrity and live action references with
`node --test test/examples.test.mjs` from the repository root.

**Pick the right quantized model for your edge device — automatically, in CI, with a signed proof.**

Click **Run workflow** and TinyEdge will:
1. **Sweep** a model's quantization ladder (Q8_0, Q4_K_M, …) on a **real edge device**,
2. measure **on-device perplexity + speed + size** for each variant,
3. **decide** the best variant for your deployment profile, and
4. emit a **signed, tamper-evident deployment manifest** — *"ship this exact variant, here's the evidence."*

If nothing meets the profile's constraints, the run **fails** — so an undeployable model never slips through.

---

## Run it (≈2 clicks)

1. Copy [`decide.yml`](decide.yml) to `.github/workflows/decide.yml` in your repository.
2. Add a repo secret **`TINYEDGE_API_KEY`** (Settings → Secrets and variables → Actions → New repository secret). Get a key at [tinyedge.ai](https://tinyedge.ai).
3. Go to the **Actions** tab → **Decide edge deployment** → **Run workflow**. Tweak the inputs if you like:

   | input | default | what it does |
   |-------|---------|--------------|
   | `model` | `hf:bartowski/Llama-3.2-1B-Instruct-GGUF` | a GGUF repo (or any `hf:owner/repo`) |
   | `profile` | `max_quality` | objective + constraints: `max_quality` / `cheapest_viable` / `realtime` / `battery` |
   | `device` | `jetson-orin-nano` | the edge device to sweep on — **must be online** |
   | `quants` | `q8_0,q4_k_m` | the ladder (kept small so the demo is fast + cheap) |

> **You need a device online.** The sweep runs on real hardware, so a TinyEdge device must be connected to your account when the workflow runs. (An always-on board like a Jetson is ideal; a sleeping phone will stall the run.)

## What you get

- A **run summary** showing the verdict and the variant to ship.
- The **signed manifest** (`tinyedge-manifest.json`) as a downloadable build artifact — the deployable decision plus its cryptographic proof.

## Verify the manifest

The manifest is **Ed25519-signed**. Anyone can confirm which variant was chosen, untampered:

```bash
curl -s https://tinyedge.ai/api/manifest/public-key -o pub.pem
# verify the signature over the canonical JSON (signature + signatureAlg excluded)
# — see the SDK's `tinyedge verify` (or server/manifest.js verifyManifest).
```

## How it works

This template is a thin workflow around the published **`actions/decide@v1`** action, which runs:

```
tinyedge optimize <model> --device <d> --json   →   tinyedge decide <group-id> --out manifest.json
```

…the same two SDK commands you can run locally (`pip install tinyedge`). The action sweeps the ladder on the device, then the decision engine selects the best in-envelope variant and signs the manifest.

## Use it in your own pipeline

Drop this into any repo's `.github/workflows/` to gate real model changes:

```yaml
on: { push: { paths: ['models/**'] } }
jobs:
  decide:
    runs-on: ubuntu-latest
    steps:
      - uses: TinyEdgeAI/tinyedge-actions/decide@v1
        with:
          api-key: ${{ secrets.TINYEDGE_API_KEY }}
          model: models/your-model-f16.gguf
          device: jetson-orin-nano
          profile: realtime
      - uses: actions/upload-artifact@v4
        if: steps.decide.outputs.verdict == 'ok'
        with: { name: manifest, path: tinyedge-manifest.json }
```

Want just a **regression gate** against a fixed baseline instead of a fresh decision? Use the sibling [`actions/validate@v1`](https://github.com/TinyEdgeAI/tinyedge-actions/tree/v1/validate) action.

---

<sub>Powered by [TinyEdge](https://tinyedge.ai) — benchmark, validate, and decide model deployments on real edge devices.</sub>
