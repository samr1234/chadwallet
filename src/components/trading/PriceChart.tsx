"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, HistogramSeries, ColorType } from "lightweight-charts";
import type { UTCTimestamp, IChartApi, ISeriesApi, CandlestickSeriesOptions, DeepPartial } from "lightweight-charts";

interface OHLCVItem {
  unixTime: number;
  open?: number;  o?: number;
  high?: number;  h?: number;
  low?: number;   l?: number;
  close?: number; c?: number;
  volume?: number; v?: number;
}

interface HoveredCandle {
  open: number;
  high: number;
  low: number;
  close: number;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

function fmtPrice(n: number): string {
  if (!n) return "0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1)         return `$${n.toFixed(2)}`;
  if (n >= 0.01)      return `$${n.toFixed(4)}`;
  return `$${n.toFixed(8)}`;
}

export default function PriceChart({ address }: { address: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [loading, setLoading]     = useState(true);
  const [hovered, setHovered]     = useState<HoveredCandle | null>(null);
  const [lastCandle, setLastCandle] = useState<HoveredCandle | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#080617" },
        textColor: "#6b7280",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      autoSize: true,
      height: 380,
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        barSpacing:     10,
        minBarSpacing:  4,
        borderColor:    "rgba(255,255,255,0.06)",
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.06)",
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(96,106,247,0.6)", width: 1, style: 2, labelBackgroundColor: "#606AF7" },
        horzLine: { color: "rgba(96,106,247,0.6)", width: 1, style: 2, labelBackgroundColor: "#606AF7" },
      },
    });

    const candleOpts: DeepPartial<CandlestickSeriesOptions> = {
      upColor:       "#22c55e",
      downColor:     "#ef4444",
      borderUpColor:   "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor:   "#22c55e",
      wickDownColor: "#ef4444",
      borderVisible: true,
    };

    const candleSeries = chart.addSeries(CandlestickSeries, candleOpts);
    seriesRef.current = candleSeries;

    // Volume histogram — pinned to bottom 20 % of the pane
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeriesRef.current = volSeries;

    chartRef.current = chart;

    // OHLC legend on crosshair move
    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.seriesData.size) { setHovered(null); return; }
      const bar = param.seriesData.get(candleSeries) as HoveredCandle | undefined;
      if (bar) setHovered(bar);
    });

    return () => {
      chart.remove();
      chartRef.current    = null;
      seriesRef.current   = null;
      volSeriesRef.current = null;
    };
  }, []);

  const fetchData = useCallback(() => {
    if (!seriesRef.current) return;
    setLoading(true);
    fetch(`/api/tokens/${address}/ohlcv?type=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        const items: OHLCVItem[] = data.items ?? [];

        // Update active button to whichever timeframe the server resolved to
        if (data.resolvedType && data.resolvedType !== timeframe) {
          setTimeframe(data.resolvedType as Timeframe);
        }

        const candles = items
          .map((d) => ({
            time:  d.unixTime as UTCTimestamp,
            open:  d.open  ?? d.o ?? 0,
            high:  d.high  ?? d.h ?? 0,
            low:   d.low   ?? d.l ?? 0,
            close: d.close ?? d.c ?? 0,
            vol:   d.volume ?? d.v ?? 0,
          }))
          .filter((d) => d.open && d.high && d.low && d.close)
          .sort((a, b) => (a.time as number) - (b.time as number));

        if (seriesRef.current) {
          seriesRef.current.setData(candles);

          if (volSeriesRef.current) {
            volSeriesRef.current.setData(
              candles.map((d) => ({
                time:  d.time,
                value: d.vol,
                color: d.close >= d.open
                  ? "rgba(34,197,94,0.35)"
                  : "rgba(239,68,68,0.35)",
              }))
            );
          }

          if (candles.length > 0) {
            chartRef.current?.timeScale().fitContent();
            const last = candles[candles.length - 1];
            setLastCandle({ open: last.open, high: last.high, low: last.low, close: last.close });
          } else {
            setLastCandle(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const display   = hovered ?? lastCandle;
  const change    = display ? display.close - display.open : 0;
  const changePct = display?.open ? (change / display.open) * 100 : 0;
  const isUp      = change >= 0;

  return (
    <div className="relative bg-[#080617]">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 flex-wrap border-b border-white/[0.04]">
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                timeframe === tf
                  ? "bg-[#606AF7]/25 text-[#606AF7]"
                  : "text-white/25 hover:text-white/60 hover:bg-white/4"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* OHLC legend */}
        {display && (
          <div className="ml-4 flex items-center gap-3 text-[11px] font-mono">
            <span className="text-white/35">O <span className="text-[#c8ceff]">{fmtPrice(display.open)}</span></span>
            <span className="text-white/35">H <span className="text-green-400">{fmtPrice(display.high)}</span></span>
            <span className="text-white/35">L <span className="text-red-400">{fmtPrice(display.low)}</span></span>
            <span className="text-white/35">C <span className="text-[#c8ceff]">{fmtPrice(display.close)}</span></span>
            <span className={`font-semibold ${isUp ? "text-green-400" : "text-red-400"}`}>
              {isUp ? "▲" : "▼"} {fmtPrice(Math.abs(change))} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div ref={containerRef} className="w-full" style={{ height: 380 }} />

      {loading && (
        <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-6 rounded-full bg-white/10 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
