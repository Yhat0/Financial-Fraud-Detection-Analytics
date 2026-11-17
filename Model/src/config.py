"""Configuracion central del pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "datos" / "paysim dataset.csv"
RESULTS_DIR = ROOT / "resultados"

RANDOM_STATE = 42
# El split temporal es sobre todo un mecanismo ANTI-LEAKAGE (features de grafo solo con pasado;
# train=pasado, test=futuro), no una simulacion de drift: en PaySim el fraude es casi estacionario
# y el volumen legitimo cae tras step~400. 323 da ~70/30 de filas (test grande y representativo).
STEP_SPLIT = 323  # train: step <= 323; test: step > 323
FRAUD_TYPES = ["TRANSFER", "CASH_OUT"]

# Nota PaySim: oldbalanceOrg pero newbalanceOrig (asi viene en el CSV).
USE_COLS = [
    "step", "type", "amount", "oldbalanceOrg", "newbalanceOrig",
    "oldbalanceDest", "newbalanceDest", "isFraud",
]
NAME_COLS = ["nameOrig", "nameDest"]  # solo se cargan para la Senal 2 (grafo)
DTYPES = {
    "step": "int16",
    "type": "category",
    "amount": "float32",
    "oldbalanceOrg": "float32",
    "newbalanceOrig": "float32",
    "oldbalanceDest": "float32",
    "newbalanceDest": "float32",
    "isFraud": "int8",
}

RAW_BALANCE_COLS = ["amount", "oldbalanceOrg", "newbalanceOrig",
                    "oldbalanceDest", "newbalanceDest"]
LOG_COLS = [f"log_{c}" for c in RAW_BALANCE_COLS]

MAHA_FEATURES = [
    "log_amount", "log_oldbalanceOrg", "log_newbalanceOrig",
    "log_oldbalanceDest", "log_newbalanceDest", "errorOrig", "errorDest",
]

# Regularizacion de Sigma si esta mal condicionada
COV_EPS = 1e-6
COND_MAX = 1e8  # si cond(Sigma) > COND_MAX se suma eps*I
CHI2_Q = 0.99
MCD_SUBSAMPLE = 100_000

# Senal 2 (grafo de destinos)
BURST_HOURS = 24          # ventana de rafaga en steps
BIG_AMOUNT_Q = 0.95       # percentil (del train) de amount que define "monto grande"
GRAPH_FEATURES = ["fan_in", "n_tx_dest", "monto_medio_in", "std_monto_in",
                  "dest_sin_historial", "burst"]
