def ema(data, period):
    result = [None] * len(data)
    start = None
    for i, v in enumerate(data):
        if v is not None:
            start = i
            break
    if start is None or (len(data) - start) < period:
        return result
    multiplier = 2 / (period + 1)
    first_sma = sum(data[start:start+period]) / period
    result[start + period - 1] = first_sma
    for i in range(start + period, len(data)):
        result[i] = data[i] * multiplier + result[i-1] * (1 - multiplier)
    return result
