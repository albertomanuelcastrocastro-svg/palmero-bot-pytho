# SISTEMA PALMERO — Arquitectura completa (13 junio 2026)

## Componentes activos

### 1. TradingView — Indicador PALMERO 15 v8
- Archivo: `PALMERO_15_v8.pine`
- Regla de hierro: 4H manda dirección (solo LONG si 4H sube, solo SHORT si 4H baja)
- v8 añade `barstate.isconfirmed` en las alertas (evita envíos a mitad de vela)
- Alertas activas: XRPUSDT (1m, 3m, 5m, 15m), SOLUSDT (1m, otra)
- Condición alerta: "Cualquier llamada a la función alert()"
- Webhook URL: https://superb-growth-production-ad6d.up.railway.app/webhook

### 2. Railway proyecto "ravishing-quietude"

**Servicio "superb-growth"** (Telegram bot + panel + persistencia)
- Archivo: `superb-growth_index.tsx`
- Recibe webhook de TradingView, manda a Telegram (@PalmeroAgent_bot)
- Guarda cada señal en GitHub: `signals_log.json` (este repo)
- Panel web: https://superb-growth-production-ad6d.up.railway.app/panel
- Marca decisión (Entré/No entré) vía /marcar?id=X&d=entre|no
- Variables: TELEGRAM_TOKEN, TELEGRAM_CHAT_ID (5448802464), GITHUB_TOKEN

**Servicio "sincere-gentleness"** (validador Python)
- Archivo: `palmero_bot.py` (en este repo)
- Cada 60s descarga klines de Binance (data-api.binance.vision, NO api.binance.com — bloqueado por geo-US)
- Calcula PALMERO 15 de forma independiente, imprime en consola
- Solo para comparar/validar, no manda nada

## Plantilla de operación (rellenar y pasar a Claude por chat)
```
SEÑAL ID: [id del panel o par+TF+hora]
Precio real entrada: [ ]
Hora real entrada: [ ] (hora canaria, la de Telegram)
Hito técnico: [OB / FVG / soporte / resistencia / ninguno]
Confirmación TF: [ej: 15m]
Estado al entrar: [tranquilo / dudoso / forzado]
Notas: [opcional]
```

Claude calcula: stop (-0.5%), TP1 (+0.5%, 40%), TP2 (+0.8%, 30%), TP3 (30% trailing breakeven).
Alberto ajusta niveles a estructura real si quiere.
Al cerrar, Alberto dice qué tramos tocó → Claude calcula resultado_pct y lo guarda.

## Cabecera para pestaña "Diario" en Google Sheet
Sheet: https://docs.google.com/spreadsheets/d/1PaofGeNW9SQtRShnMFpwkbEm06DRxSsmlniZsiPpG6k/edit
```
Fecha	Hora entrada	Par	Dirección	TF	Entrada	Stop	TP1	TP2	Hito	Confirmación	Estado emocional	TP1✓	TP2✓	Cierre final	Resultado %	Estado operación	Notas
```
Claude pasa una fila lista para pegar cuando la operación se liquida.

## Notas importantes
- Hora de referencia para todo: hora canaria (la que muestra Telegram)
- Repintado: las alertas pueden no dibujar triángulo al instante en TF muy cortos (1m),
  pero suelen aparecer tras recalcular. Telegram = fuente de verdad del momento de la señal.
- Confluencia cruzada: si XRP y SOL (correlacionados) disparan señal casi a la vez,
  es indicio de movimiento de fondo del mercado → refuerza la señal.
- GITHUB_TOKEN (palmero-bot) tiene scope "repo" sobre este repositorio.


## Operaciones simultáneas
El sistema soporta múltiples operaciones abiertas a la vez (cada una con su propio id en signals_log.json),
incluyendo tramos TP3 "caballo ganador" de días anteriores corriendo en paralelo con operaciones nuevas.
Campo `estado_operacion`: "abierta" (TP3 corriendo) | "cerrada" (liquidada del todo).

## REGLA PARA CLAUDE
Las plantillas (entrada de operación, corrección, cabecera Excel) deben estar SIEMPRE
disponibles en este README. Si se modifican, actualizar este archivo inmediatamente
sin que Alberto tenga que pedirlo. No preguntar dónde guardar esto: aquí, siempre.
