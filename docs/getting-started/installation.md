# Installation

OpenCDaRR is not on PyPI, yet. Install it from a copy of the repository. Before you start, you need to have `Python >= 3.11`, `Git`, and `conda/venv` for the virtual environment.

## 1. Get the source code

Open a terminal. Then do these two commands:

```bash
git clone https://github.com/fazlurnu/OpenCDaRR.git
cd OpenCDaRR
```

Do all the subsequent commands in this directory.

## 2. Make a Python environment

Make an environment with conda:

```bash
conda create -n opencdarr python=3.11
conda activate opencdarr
```

If you do not have conda, make an environment with `venv`:

```bash
python -m venv .venv
source .venv/bin/activate
```

!!! note "On Windows, the activation command is different"
    Use `.venv\Scripts\activate` for `venv`. The conda commands do not change.

## 3. Install the library

```bash
pip install -e ".[examples]"
```

This command installs the library and the packages for the notebooks. It is all you need for the tutorials and the handbook. Step 5 shows the other install options.

The `-e` flag makes a link to your copy of the source code. Your changes to the source code become active immediately. You do not install the library again.

## 4. Check the installation

```bash
python -c "import opencdarr; print(opencdarr.__version__)"
```

The command prints `0.0.0`. The version is `0.0.0` because the project is before its first release.

## 5. Install options

The command in step 3 installs one option set: `examples`. Other sets are available. This table shows each one:

| Option | Packages | Purpose |
| --- | --- | --- |
| None | `numpy`, `pyyaml`, `joblib` | The models, the simulation loop, and both estimators. |
| `examples` | `matplotlib`, `ipykernel`, `pandas` | The tutorial notebooks and all the figures. |
| `dev` | `pytest`, `mypy`, `ruff` | The test suite and the code checks. |
| `fast` | `scipy` | More speed in `ProbabilisticFTR`. |

Add `dev` when you change the library and you want to run its test suite: `pip install -e ".[examples,dev]"`. You do not need it to use the library.

`joblib` is in the core install. Thus the rare-event estimator (IPS) runs on all the cores of your machine after step 3, and also after a plain `pip install -e .`.

The `fast` option is different. `scipy` is a large package, and it makes one criterion about 1.5 times faster. It changes the speed only, and the two results agree to 2 × 10⁻¹⁶. Install it when you use `ProbabilisticFTR` on a large sweep.

!!! note "`import opencdarr` does not import `joblib`"
    The library imports `matplotlib` and `joblib` in the functions that use them, and not at the top of the module. `joblib` costs about 0.6 s to import. Thus you pay that time only when you ask for more than one core.