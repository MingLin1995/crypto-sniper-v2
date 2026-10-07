'use client';

import React, { useEffect, useRef } from 'react';
import { createChart, AreaSeries } from 'lightweight-charts';
import { useApp } from '@/components/AppProviders';

interface EquityChartProps {
  data: { timestamp: number; equity: number }[];
}

function processChartData(data: { timestamp: number; equity: number }[], maxPoints = 1000) {
  // 1. Calculate drawdown on full data to ensure accuracy
  let peak = -Infinity;
  const processed = data.map((d) => {
    if (d.equity > peak) {
      peak = d.equity;
    }
    const drawdown = peak > 0 ? ((d.equity - peak) / peak) * 100 : 0;
    return {
      timestamp: d.timestamp,
      equity: d.equity,
      drawdown: drawdown,
    };
  });

  // 2. Downsample using LTTB
  if (processed.length <= maxPoints) return processed;

  const sampled: typeof processed = [];
  const dataLength = processed.length;
  
  // Bucket size. Leave room for start and end data points
  const bucketSize = (dataLength - 2) / (maxPoints - 2);

  let a = 0; // Initially a is the first point
  sampled.push(processed[a]); // Always add the first point

  for (let i = 0; i < maxPoints - 2; i++) {
    // Calculate point average for next bucket (b)
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

    const avgRangeLength = avgRangeEnd - avgRangeStart;
    if (avgRangeLength > 0) {
      for (let j = avgRangeStart; j < avgRangeEnd; j++) {
        avgX += processed[j].timestamp;
        avgY += processed[j].equity;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;
    } else {
      avgX = processed[avgRangeStart - 1]?.timestamp || 0;
      avgY = processed[avgRangeStart - 1]?.equity || 0;
    }

    // Get the range for this bucket
    const rangeOffs = Math.floor(i * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

    // Point a
    const pointAX = processed[a].timestamp;
    const pointAY = processed[a].equity;

    let maxArea = -1;
    let maxAreaPointIdx = rangeOffs;

    for (let j = rangeOffs; j < rangeTo && j < dataLength; j++) {
      // Calculate triangle area over three buckets
      const area = Math.abs(
        (pointAX - avgX) * (processed[j].equity - pointAY) -
        (pointAX - processed[j].timestamp) * (avgY - pointAY)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPointIdx = j;
      }
    }

    sampled.push(processed[maxAreaPointIdx]);
    a = maxAreaPointIdx; // This becomes next a
  }

  // Always include the last point
  sampled.push(processed[dataLength - 1]);

  return sampled;
}

export function EquityChart({ data }: EquityChartProps) {
  const { theme } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const drawdownChartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mainContainer = mainChartContainerRef.current;
    const drawdownContainer = drawdownChartContainerRef.current;
    const tooltip = tooltipRef.current;
    const wrapper = containerRef.current;

    if (!mainContainer || !drawdownContainer || !tooltip || !wrapper || data.length === 0) return;

    // Process data and calculate drawdown
    const processedData = processChartData(data, 1000);

    const isLightMode = theme === 'light' || document.documentElement.classList.contains('light');

    // Common options
    const commonChartOptions = {
      layout: {
        background: { color: 'transparent' },
        textColor: isLightMode ? '#475569' : '#a1a1aa',
      },
      grid: {
        vertLines: { color: isLightMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.03)' },
        horzLines: { color: isLightMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.03)' },
      },
      rightPriceScale: {
        borderColor: isLightMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
      },
      timeScale: {
        borderColor: isLightMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    };

    // Initialize Main Chart (Equity)
    const mainChart = createChart(mainContainer, {
      ...commonChartOptions,
      width: mainContainer.clientWidth || 600,
      height: 260,
    });

    const equitySeries = mainChart.addSeries(AreaSeries, {
      lineColor: '#818cf8',
      topColor: 'rgba(129, 140, 248, 0.3)',
      bottomColor: 'rgba(129, 140, 248, 0.0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    // Initialize Drawdown Chart
    const drawdownChart = createChart(drawdownContainer, {
      ...commonChartOptions,
      width: drawdownContainer.clientWidth || 600,
      height: 120,
    });

    const drawdownSeries = drawdownChart.addSeries(AreaSeries, {
      lineColor: '#f43f5e',
      topColor: 'rgba(244, 63, 94, 0.0)',
      bottomColor: 'rgba(244, 63, 94, 0.25)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => `${price.toFixed(2)}%`,
      },
    });

    // Prepare chart data format
    const equityChartData = processedData.map((d) => ({
      time: Math.floor(d.timestamp / 1000) as any,
      value: d.equity,
    }));

    const drawdownChartData = processedData.map((d) => ({
      time: Math.floor(d.timestamp / 1000) as any,
      value: d.drawdown,
    }));

    equitySeries.setData(equityChartData);
    drawdownSeries.setData(drawdownChartData);

    mainChart.timeScale().fitContent();
    drawdownChart.timeScale().fitContent();

    // 1. Synchronize visible time ranges
    let isSyncing = false;
    const mainTimeScale = mainChart.timeScale();
    const drawdownTimeScale = drawdownChart.timeScale();

    const syncMainToDrawdown = (range: any) => {
      if (isSyncing) return;
      isSyncing = true;
      drawdownTimeScale.setVisibleLogicalRange(range);
      isSyncing = false;
    };

    const syncDrawdownToMain = (range: any) => {
      if (isSyncing) return;
      isSyncing = true;
      mainTimeScale.setVisibleLogicalRange(range);
      isSyncing = false;
    };

    mainTimeScale.subscribeVisibleLogicalRangeChange(syncMainToDrawdown);
    drawdownTimeScale.subscribeVisibleLogicalRangeChange(syncDrawdownToMain);

    // 2. Track hover state to sync crosshair position & tooltip
    let hoveredChart: 'main' | 'drawdown' | null = null;

    const handleMainEnter = () => { hoveredChart = 'main'; };
    const handleMainLeave = () => { hoveredChart = null; tooltip.style.display = 'none'; };
    const handleDrawdownEnter = () => { hoveredChart = 'drawdown'; };
    const handleDrawdownLeave = () => { hoveredChart = null; tooltip.style.display = 'none'; };

    mainContainer.addEventListener('mouseenter', handleMainEnter);
    mainContainer.addEventListener('mouseleave', handleMainLeave);
    drawdownContainer.addEventListener('mouseenter', handleDrawdownEnter);
    drawdownContainer.addEventListener('mouseleave', handleDrawdownLeave);

    const updateTooltipAndSyncCrosshair = (param: any, source: 'main' | 'drawdown') => {
      if (!param.time || !param.point) {
        tooltip.style.display = 'none';
        if (source === 'main') {
          drawdownChart.clearCrosshairPosition();
        } else {
          mainChart.clearCrosshairPosition();
        }
        return;
      }

      // Sync crosshair on the other chart
      const time = param.time;
      const targetItem = processedData.find(d => Math.floor(d.timestamp / 1000) === (time as any));
      
      if (targetItem) {
        if (source === 'main' && hoveredChart === 'main') {
          drawdownChart.setCrosshairPosition(targetItem.drawdown, time as any, drawdownSeries);
        } else if (source === 'drawdown' && hoveredChart === 'drawdown') {
          mainChart.setCrosshairPosition(targetItem.equity, time as any, equitySeries);
        }

        // Show Tooltip Card
        const wrapperRect = wrapper.getBoundingClientRect();
        const activeContainer = source === 'main' ? mainContainer : drawdownContainer;
        const activeRect = activeContainer.getBoundingClientRect();

        const absoluteX = activeRect.left - wrapperRect.left + param.point.x;
        const absoluteY = activeRect.top - wrapperRect.top + param.point.y;

        const dateStr = new Date(targetItem.timestamp).toLocaleString('zh-TW', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        // Set content
        tooltip.innerHTML = `
          <div class="text-[10px] text-zinc-500 light:text-zinc-600 font-bold mb-1 border-b border-indigo-500/10 light:border-zinc-200 pb-1">${dateStr}</div>
          <div class="flex justify-between gap-4 items-center">
            <span class="text-zinc-400 light:text-zinc-600">總權益:</span>
            <span class="font-bold text-indigo-400 light:text-indigo-600">$${targetItem.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div class="flex justify-between gap-4 items-center">
            <span class="text-zinc-400 light:text-zinc-600">回撤率:</span>
            <span class="font-bold ${targetItem.drawdown === 0 ? (isLightMode ? 'text-zinc-600' : 'text-zinc-400') : (isLightMode ? 'text-rose-600' : 'text-rose-400')}">${targetItem.drawdown.toFixed(2)}%</span>
          </div>
        `;

        // Position tooltip
        const tooltipWidth = 180;
        const tooltipHeight = 76;
        let left = absoluteX + 15;
        let top = absoluteY + 15;

        if (left + tooltipWidth > wrapperRect.width) {
          left = absoluteX - tooltipWidth - 15;
        }
        // Clamp top/bottom
        if (top + tooltipHeight > wrapperRect.height) {
          top = absoluteY - tooltipHeight - 15;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.display = 'flex';
      }
    };

    const handleMainMove = (param: any) => updateTooltipAndSyncCrosshair(param, 'main');
    const handleDrawdownMove = (param: any) => updateTooltipAndSyncCrosshair(param, 'drawdown');

    mainChart.subscribeCrosshairMove(handleMainMove);
    drawdownChart.subscribeCrosshairMove(handleDrawdownMove);

    // 3. Handle Auto-resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0) return;
      const width = mainContainer.clientWidth;
      mainChart.applyOptions({ width });
      drawdownChart.applyOptions({ width });
      mainChart.timeScale().fitContent();
      drawdownChart.timeScale().fitContent();
    });

    resizeObserver.observe(mainContainer);

    return () => {
      // Clean up event listeners & subscriptions
      mainContainer.removeEventListener('mouseenter', handleMainEnter);
      mainContainer.removeEventListener('mouseleave', handleMainLeave);
      drawdownContainer.removeEventListener('mouseenter', handleDrawdownEnter);
      drawdownContainer.removeEventListener('mouseleave', handleDrawdownLeave);

      mainTimeScale.unsubscribeVisibleLogicalRangeChange(syncMainToDrawdown);
      drawdownTimeScale.unsubscribeVisibleLogicalRangeChange(syncDrawdownToMain);

      mainChart.unsubscribeCrosshairMove(handleMainMove);
      drawdownChart.unsubscribeCrosshairMove(handleDrawdownMove);

      resizeObserver.disconnect();
      mainChart.remove();
      drawdownChart.remove();
    };
  }, [data, theme]);

  return (
    <div ref={containerRef} className="relative w-full flex flex-col gap-4">
      {/* Tooltip Overlay */}
      <div
        ref={tooltipRef}
        className="absolute z-30 hidden p-3 rounded-xl border border-indigo-500/20 light:border-zinc-300 bg-zinc-950/95 dark:bg-zinc-950/95 light:bg-white/95 text-xs text-zinc-200 light:text-zinc-800 pointer-events-none shadow-2xl font-mono flex-col gap-1 min-w-[180px] backdrop-blur-md transition-all duration-75"
      />

      {/* Equity Chart Container */}
      <div className="w-full flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-zinc-400 light:text-zinc-600">總權益 Equity (USDT)</span>
        </div>
        <div
          ref={mainChartContainerRef}
          className="w-full h-[280px] border border-indigo-500/10 light:border-zinc-200 rounded-xl p-2 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/80 backdrop-blur-md"
        />
      </div>

      {/* Drawdown Chart Container */}
      <div className="w-full flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-zinc-400 light:text-zinc-600">回撤率 Drawdown (%)</span>
        </div>
        <div
          ref={drawdownChartContainerRef}
          className="w-full h-[140px] border border-red-500/10 light:border-red-200 rounded-xl p-2 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/80 backdrop-blur-md"
        />
      </div>
    </div>
  );
}
