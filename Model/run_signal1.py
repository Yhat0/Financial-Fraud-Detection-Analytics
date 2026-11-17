"""Orquestador Fase 1: preparacion + Senal 1 (Mahalanobis).

Uso (desde Model/):  python run_signal1.py [--nrows N] [--sample-frac F] [--robust]
"""
import argparse
import time

from src import config as C
from src.data_prep import prepare
from src.evaluate import evaluate
from src.signal_mahalanobis import add_score


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nrows", type=int, default=None, help="leer solo N filas (smoke test)")
    ap.add_argument("--sample-frac", type=float, default=None, help="submuestreo tras filtrar")
    ap.add_argument("--robust", action="store_true", help="usar MinCovDet (submuestra)")
    a = ap.parse_args()

    t0 = time.time()
    df, m_train, m_test = prepare(a.nrows, a.sample_frac)
    print(f"[{time.time()-t0:.0f}s] filas={len(df):,} train={m_train.sum():,} "
          f"test={m_test.sum():,} fraudes={int(df.isFraud.sum()):,}")
    model, thr = add_score(df, m_train, robust=a.robust)
    print(f"[{time.time()-t0:.0f}s] score listo. diag={model['diagnostics']}")
    print("umbrales:", thr)
    m = evaluate(df, m_train, m_test, thr, model["diagnostics"])
    print(f"AUPRC test={m['auprc_test']:.4f} train={m['auprc_train']:.4f} "
          f"base={m['baseline_auprc_test']:.5f}")
    print("cuartiles test:", m["quartiles_test"])
    for r in m["deciles_test"]:
        print(r)
    print(f"[{time.time()-t0:.0f}s] fin. resultados en {C.RESULTS_DIR}")


if __name__ == "__main__":
    main()
