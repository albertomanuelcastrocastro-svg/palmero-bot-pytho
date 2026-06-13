#!/usr/bin/env python3
import time
import json
import requests
from datetime import datetime

PAIR = "XRPUSDT"
TIMEFRAME = "5m"
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
VOL_MULT = 1.3
FUERZA_4H_MIN = 0.2

def get_klines(pair, interval, limit=500):
    url = "https://api.binance.com/api/v3/klines"
    params = {"symbol": pair, "interval": interval, "limit": limit}
    try:
        resp = requests.get(url, params=params, timeout=10)
        return resp.json()
    except:
        return []

def ema(data, period):
    result = [None] * len(data)
    multiplier = 2 / (period + 1)
    first_sma = sum(data[:period]) / period
    result[period - 1] = first_sma
    for i in range(period, len(data)):
        result[i] = data[i] * multiplier + result[i-1] * (1 - multiplier)
    return result

def macd(closes, fast=12, slow=26, signal=9):
    ema_fast = ema(closes, fast)
    ema_slow = ema(closes, slow)
    macd_line = [ema_fast[i] - ema_slow[i] if ema_fast[i] and ema_slow[i] else None for i in range(len(closes))]
    signal_line = ema(macd_line, signal)
    histogram = [macd_line[i] - signal_line[i] if macd_line[i] and signal_line[i] else None for i in range(len(closes))]
    return macd_line, signal_line, histogram

def calculate_palmero(closes_1m, vols_1m, closes_5m, vols_5m, closes_15m, closes_4h):
    macd_1m, sig_1m, _ = macd(closes_1m, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    macd_5m, sig_5m, _ = macd(closes_5m, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    _, sig_15m, _ = macd(closes_15m, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    _, sig_4h, _ = macd(closes_4h, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    
    idx = -1
    sig_1m_val = sig_1m[idx] if sig_1m[idx] else 0
    sig_5m_val = sig_5m[idx] if sig_5m[idx] else 0
    sig_15m_val = sig_15m[idx] if sig_15m[idx] else 0
    sig_4h_val = sig_4h[idx] if sig_4h[idx] else 0
    macd_1m_val = macd_1m[idx] if macd_1m[idx] else 0
    
    arr_5m_up = sig_5m_val > sig_5m[idx-1] if sig_5m[idx-1] else False
    arr_5m_dn = sig_5m_val < sig_5m[idx-1] if sig_5m[idx-1] else False
    
    umb_4h = sum([abs(x) for x in macd_4h if x]) / len([x for x in macd_4h if x]) if any(macd_4h) else 0.0001
    margen = umb_4h * FUERZA_4H_MIN
    
    tend_up = (sig_4h_val > sig_4h[idx-1] if sig_4h[idx-1] else False) and (sig_4h_val > -margen)
    tend_dn = (sig_4h_val < sig_4h[idx-1] if sig_4h[idx-1] else False) and (sig_4h_val < margen)
    
    vol_ma = sum(vols_5m[-20:]) / 20 if len(vols_5m) >= 20 else sum(vols_5m) / len(vols_5m)
    vol_ok = vols_5m[idx] >= vol_ma * VOL_MULT
    
    cruce_bull = (macd_1m_val > sig_1m_val) and (macd_1m[idx-1] <= sig_1m[idx-1] if idx-1 >= 0 else False)
    cruce_bear = (macd_1m_val < sig_1m_val) and (macd_1m[idx-1] >= sig_1m[idx-1] if idx-1 >= 0 else False)
    
    go_long = tend_up and cruce_bull and arr_5m_up and vol_ok
    go_short = tend_dn and cruce_bear and arr_5m_dn and vol_ok
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "close": closes_5m[idx],
        "volume": vols_5m[idx],
        "sig_4h": sig_4h_val,
        "sig_5m": sig_5m_val,
        "sig_1m": sig_1m_val,
        "tend_up": tend_up,
        "tend_dn": tend_dn,
        "vol_ok": vol_ok,
        "go_long": go_long,
        "go_short": go_short,
    }

def main():
    print("=== PALMERO 15 Python ===")
    while True:
        try:
            klines_1m = get_klines(PAIR, "1m", 500)
            klines_5m = get_klines(PAIR, "5m", 500)
            klines_15m = get_klines(PAIR, "15m", 500)
            klines_4h = get_klines(PAIR, "4h", 500)
            
            if not all([klines_1m, klines_5m, klines_15m, klines_4h]):
                print(f"[{datetime.utcnow()}] Error descargando datos")
                time.sleep(30)
                continue
            
            closes_1m = [float(k[4]) for k in klines_1m]
            vols_1m = [float(k[7]) for k in klines_1m]
            closes_5m = [float(k[4]) for k in klines_5m]
            vols_5m = [float(k[7]) for k in klines_5m]
            closes_15m = [float(k[4]) for k in klines_15m]
            closes_4h = [float(k[4]) for k in klines_4h]
            
            result = calculate_palmero(closes_1m, vols_1m, closes_5m, vols_5m, closes_15m, closes_4h)
            
            if result["go_long"]:
                print(f"\n▲ GO LONG - {result['close']:.6f} - VOL: {result['volume']:.0f}")
            elif result["go_short"]:
                print(f"\n▼ GO SHORT - {result['close']:.6f} - VOL: {result['volume']:.0f}")
            
            time.sleep(60)
            
        except Exception as e:
            print(f"Error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
