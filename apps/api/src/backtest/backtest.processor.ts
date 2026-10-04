import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { HistoricalKlineService, getIntervalMs } from '../market/historical-kline.service';
import { BacktestEngine } from './engine/backtest-engine';
import { BacktestConfig } from './engine/types';
import { OHLCVKline } from '../market/types';

@Processor('backtest')
@Injectable()
export class BacktestProcessor extends WorkerHost {
  private readonly logger = new Logger(BacktestProcessor.name);

  constructor(
    private readonly prisma: ExtendedPrismaService,
    private readonly historicalKlineService: HistoricalKlineService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<void> {
    const { jobId } = job.data;
    this.logger.log(`Starting backtest job ${jobId}`);

    // 1. 更新任務狀態為 RUNNING
    await this.prisma.client.backtestJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      // 2. 獲取任務配置
      const dbJob = await this.prisma.client.backtestJob.findUniqueOrThrow({
        where: { id: jobId },
      });

      const config = dbJob.config as unknown as BacktestConfig;

      const symbolKlines: Record<string, OHLCVKline[]> = {};
      const higherKlines: Record<string, Record<string, OHLCVKline[]>> = {};

      const higherBlocks = config.timeframes.filter((tf) => tf.interval !== config.interval);

      for (const symbol of config.symbols) {
        // a. 同步主時框歷史 K 線
        await this.historicalKlineService.ensureKlines(
          symbol,
          config.interval,
          config.startTime,
          config.endTime,
        );

        symbolKlines[symbol] = await this.historicalKlineService.getKlinesFromDb(
          symbol,
          config.interval,
          config.startTime,
          config.endTime,
        );

        // b. 如有確認時框，額外同步所有確認時框之歷史 K 線（需附帶 500 根的 lookback warm-up 歷史防止指標計算缺失）
        for (const hBlock of higherBlocks) {
          const higherIntervalMs = getIntervalMs(hBlock.interval);
          const warmUpMargin = 500 * higherIntervalMs;
          const warmUpStart = Math.max(0, config.startTime - warmUpMargin);

          await this.historicalKlineService.ensureKlines(
            symbol,
            hBlock.interval,
            warmUpStart,
            config.endTime,
          );

          const hKlines = await this.historicalKlineService.getKlinesFromDb(
            symbol,
            hBlock.interval,
            warmUpStart,
            config.endTime,
          );

          if (!higherKlines[symbol]) {
            higherKlines[symbol] = {};
          }
          higherKlines[symbol][hBlock.interval] = hKlines;
        }
      }

      // 3. 呼叫回測引擎核心運行回測
      const engineResult = BacktestEngine.run({
        config,
        symbolKlines,
        higherKlines,
      });

      // 3b. 額外計算同期間 BTC 基準指標 (BTC Buy & Hold 與 Monthly DCA)
      try {
        await this.historicalKlineService.ensureKlines('BTCUSDT', '1d', config.startTime, config.endTime);
        const btcKlines = await this.historicalKlineService.getKlinesFromDb('BTCUSDT', '1d', config.startTime, config.endTime);
        if (btcKlines && btcKlines.length > 0) {
          const btcStart = btcKlines[0].open;
          const btcEnd = btcKlines[btcKlines.length - 1].close;
          if (btcStart > 0) {
            engineResult.state.stats.btcBuyHoldRoi = Number((((btcEnd / btcStart) - 1) * 100).toFixed(2));

            const monthlyMs = 30 * 24 * 3600 * 1000;
            let totalInvested = 0;
            let totalCoins = 0;
            for (let t = config.startTime; t <= config.endTime; t += monthlyMs) {
              const k = btcKlines.find((c) => c.openTime >= t);
              if (k && k.open > 0) {
                const amt = 500;
                totalInvested += amt;
                totalCoins += amt / k.open;
              }
            }
            if (totalInvested > 0) {
              engineResult.state.stats.btcMonthlyDcaRoi = Number((((totalCoins * btcEnd / totalInvested) - 1) * 100).toFixed(2));
            }
          }
        }
      } catch (btcErr: any) {
        this.logger.warn(`Failed to calculate BTC benchmarks: ${btcErr.message}`);
      }

      // 4. 回寫回測結果，將狀態更新為 COMPLETED
      await this.prisma.client.backtestJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result: {
            stats: engineResult.state.stats,
            trades: engineResult.state.trades,
            equityCurve: engineResult.state.equityCurve,
            warnings: engineResult.warnings,
          } as any,
        },
      });

      this.logger.log(`Completed backtest job ${jobId} successfully`);
    } catch (err: any) {
      this.logger.error(`Failed to process backtest job ${jobId}: ${err.message}`, err.stack);
      
      // 異常處理：標記任務狀態為 FAILED 並記錄錯誤訊息
      await this.prisma.client.backtestJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: err.message || 'Unknown error',
        },
      });
    }
  }
}
