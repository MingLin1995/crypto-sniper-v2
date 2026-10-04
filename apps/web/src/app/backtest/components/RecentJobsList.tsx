'use client';

import * as React from 'react';
import { History, ChevronRight, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface RecentJobsListProps {
  locale: string;
  jobHistory: any[];
  onSelectJob: (jobId: string) => void;
  onDeleteJob: (e: React.MouseEvent, jobId: string) => void;
}

export function RecentJobsList({
  locale,
  jobHistory,
  onSelectJob,
  onDeleteJob,
}: RecentJobsListProps) {
  return (
    <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-white/90 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-md flex items-center gap-2 text-zinc-100 light:text-zinc-900">
          <History className="h-5 w-5 text-indigo-400 light:text-indigo-600" />
          {locale === 'zh-TW' ? '我的歷史回測' : 'Recent Backtest Runs'}
        </CardTitle>
        <CardDescription className="text-zinc-400 light:text-zinc-600">
          {locale === 'zh-TW' ? '最近的歷史任務狀態與結果。' : 'Status of your recent backtest runs.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {jobHistory.length === 0 ? (
          <div className="text-zinc-500 light:text-zinc-500 text-sm py-4 text-center">
            {locale === 'zh-TW' ? '尚無歷史回測紀錄' : 'No history found'}
          </div>
        ) : (
          jobHistory.map((job) => (
            <div
              key={job.id}
              onClick={() => {
                if (job.status === 'COMPLETED') {
                  onSelectJob(job.id);
                }
              }}
              className={`p-3 rounded-lg border border-zinc-800 light:border-zinc-200 bg-zinc-950/30 dark:bg-zinc-950/30 light:bg-zinc-50/80 flex items-center justify-between transition-all duration-300 ${job.status === 'COMPLETED' ? 'cursor-pointer hover:border-indigo-500/30 light:hover:border-indigo-400 light:hover:bg-zinc-100' : ''}`}
            >
              <div className="space-y-1 bg-transparent">
                <div className="text-xs font-semibold text-zinc-300 light:text-zinc-800">
                  {job.config?.symbols?.join(', ')} ({job.config?.interval})
                </div>
                <div className="text-[10px] text-zinc-500 light:text-zinc-500">
                  {new Date(job.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    job.status === 'COMPLETED'
                      ? 'bg-green-500/10 text-green-400 light:text-green-600 border border-green-500/20 light:border-green-300'
                      : job.status === 'FAILED'
                      ? 'bg-red-500/10 text-red-400 light:text-red-600 border border-red-500/20 light:border-red-300'
                      : 'bg-yellow-500/10 text-yellow-400 light:text-yellow-600 border border-yellow-500/20 light:border-yellow-300'
                  }`}
                >
                  {job.status}
                </span>
                {job.status === 'COMPLETED' && <ChevronRight className="h-4 w-4 text-zinc-500 light:text-zinc-400" />}
                {(job.status === 'COMPLETED' || job.status === 'FAILED') && (
                  <button
                    onClick={(e) => onDeleteJob(e, job.id)}
                    className="p-1 rounded text-zinc-500 light:text-zinc-400 hover:text-red-400 light:hover:text-red-600 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title={locale === 'zh-TW' ? '刪除紀錄' : 'Delete Record'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
