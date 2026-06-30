"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, HistogramSeries, ColorType, LineStyle } from "lightweight-charts";
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

interface CandleRow {
  time: UTCTimestamp;
  open: number; high: number; low: number; close: number; vol: number;
}

export default function PriceChart({ address, supply, height: heightProp = 380 }: { address: string; supply?: number; height?: number }) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const wrapperRef    = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const seriesRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef  = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef    = useRef<CandleRow[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("1H");
  const [loading, setLoading]     = useState(true);
  const [hovered, setHovered]     = useState<HoveredCandle | null>(null);
  const [lastCandle, setLastCandle] = useState<HoveredCandle | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [priceMode, setPriceMode]   = useState<"price" | "mcap">("price");

  // Fullscreen
  const toggleFullscreen = () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Screenshot
  const takeScreenshot = () => {
    const canvas = chartRef.current?.takeScreenshot();
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `chart-${address.slice(0, 6)}.png`;
    a.click();
  };

  // Zoom
  const zoomIn  = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const cur = (ts as unknown as { options: () => { barSpacing: number } }).options().barSpacing ?? 12;
    ts.applyOptions({ barSpacing: Math.min(cur + 3, 50) });
  };
  const zoomOut = () => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const cur = (ts as unknown as { options: () => { barSpacing: number } }).options().barSpacing ?? 12;
    ts.applyOptions({ barSpacing: Math.max(cur - 3, 3) });
  };

  // Scroll
  const scrollLeft  = () => chartRef.current?.timeScale().scrollToPosition(-10, true);
  const scrollRight = () => chartRef.current?.timeScale().scrollToPosition(10, true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#070709" },
        textColor: "rgba(255,255,255,0.3)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.04)", visible: true },
      },
      width:  el.clientWidth || el.offsetWidth || 300,
      height: 380,
      timeScale: {
        timeVisible:    true,
        secondsVisible: false,
        barSpacing:     12,
        minBarSpacing:  5,
        borderVisible:  false,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.22 },
        textColor: "rgba(255,255,255,0.3)",
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(255,255,255,0.2)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a2e" },
      },
    });

    const candleOpts: DeepPartial<CandlestickSeriesOptions> = {
      upColor:          "#089981",
      downColor:        "#f23645",
      wickUpColor:      "#089981",
      wickDownColor:    "#f23645",
      borderVisible:    false,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth:   1,
      priceLineStyle:   LineStyle.Dashed,
      priceLineColor:   "#089981",
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

    const ro = new ResizeObserver(() => {
      const width  = el.clientWidth  || el.offsetWidth;
      const height = el.clientHeight || el.offsetHeight;
      if (width > 0) {
        chart.applyOptions({ width, ...(height > 0 ? { height } : {}) });
        // Re-apply stored candles in case setData was called before chart had width
        if (candlesRef.current.length > 0 && seriesRef.current) {
          seriesRef.current.setData(candlesRef.current);
          volSeriesRef.current?.setData(
            candlesRef.current.map((d) => ({
              time:  d.time,
              value: d.vol,
              color: d.close >= d.open ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)",
            }))
          );
          chart.timeScale().fitContent();
        }
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current    = null;
      seriesRef.current   = null;
      volSeriesRef.current = null;
    };
  }, []);

  const applyModeToChart = useCallback((candles: CandleRow[]) => {
    if (!seriesRef.current || candles.length === 0) return;
    const mult = priceMode === "mcap" && supply && supply > 0 ? supply : 1;
    const scaled = mult === 1 ? candles : candles.map((c) => ({
      ...c,
      open:  c.open  * mult,
      high:  c.high  * mult,
      low:   c.low   * mult,
      close: c.close * mult,
    }));
    seriesRef.current.setData(scaled);
    const last = scaled[scaled.length - 1];
    setLastCandle({ open: last.open, high: last.high, low: last.low, close: last.close });
  }, [priceMode, supply]);

  // Re-apply stored candles when mode or supply changes (no refetch needed)
  useEffect(() => {
    if (candlesRef.current.length > 0) applyModeToChart(candlesRef.current);
  }, [applyModeToChart]);

  const fetchData = useCallback(() => {
    if (!seriesRef.current) return;
    candlesRef.current = [];
    setLoading(true);
    fetch(`/api/tokens/${address}/ohlcv?type=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        const items: OHLCVItem[] = data.items ?? [];

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

        candlesRef.current = candles;

        if (seriesRef.current) {
          applyModeToChart(candles);

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
          } else {
            setLastCandle(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, timeframe, applyModeToChart]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const display   = hovered ?? lastCandle;
  const change    = display ? display.close - display.open : 0;
  const changePct = display?.open ? (change / display.open) * 100 : 0;
  const isUp      = change >= 0;

  return (
    <div ref={wrapperRef} className={`relative bg-[#070709] ${isFullscreen ? "h-screen flex flex-col" : ""}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 flex-wrap border-b border-white/4">
        {/* Timeframes */}
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

        {/* Price / MCap toggle — only when supply is known */}
        {supply && supply > 0 ? (
          <div className="flex gap-0.5 ml-2">
            {(["price", "mcap"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPriceMode(m)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                  priceMode === m
                    ? "bg-white/10 text-white/80"
                    : "text-white/25 hover:text-white/50"
                }`}
              >
                {m === "price" ? "Price" : "MCap"}
              </button>
            ))}
          </div>
        ) : null}

        {/* OHLC legend */}
        {display && (
          <div className="ml-3 flex items-center gap-3 text-[11px] font-mono">
            <span className="text-white/35">O <span className="text-[#c8ceff]">{fmtPrice(display.open)}</span></span>
            <span className="text-white/35">H <span className="text-[#089981]">{fmtPrice(display.high)}</span></span>
            <span className="text-white/35">L <span className="text-[#f23645]">{fmtPrice(display.low)}</span></span>
            <span className="text-white/35">C <span className="text-[#c8ceff]">{fmtPrice(display.close)}</span></span>
            <span className={`font-semibold ${isUp ? "text-[#089981]" : "text-[#f23645]"}`}>
              {isUp ? "▲" : "▼"} {fmtPrice(Math.abs(change))} ({isUp ? "+" : ""}{changePct.toFixed(2)}%)
            </span>
          </div>
        )}

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={takeScreenshot} title="Screenshot"
            className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button onClick={toggleFullscreen} title="Fullscreen"
            className="p-1.5 rounded text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors cursor-pointer">
            {isFullscreen ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M15 15v4.5M15 15h4.5M9 15H4.5M9 15v4.5" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div ref={containerRef} className={`w-full ${isFullscreen ? "flex-1 min-h-0" : ""}`} style={{ height: isFullscreen ? undefined : heightProp }} />

      {/* Chart nav controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/[0.06]">
        {[
          { label: "−", action: zoomOut,    title: "Zoom out" },
          { label: "+", action: zoomIn,     title: "Zoom in"  },
          { label: "‹", action: scrollLeft, title: "Scroll left"  },
          { label: "›", action: scrollRight,title: "Scroll right" },
        ].map(({ label, action, title }) => (
          <button key={label} onClick={action} title={title}
            className="w-7 h-7 flex items-center justify-center rounded text-sm text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer font-mono">
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="absolute inset-0 top-10 flex items-center justify-center pointer-events-none">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-6 rounded-full bg-white/10 animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
