import React, { useEffect, useMemo, useState } from 'react';
import { CenteredLayout } from '@/app/components/CenteredLayout';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminAIService,
  AIAccuracyDto,
  AIInsightFeedDto,
  AIOverviewDto,
  AIPatternAnalyticsDto,
  AIRawUserDataDto,
  AIUserIntelligenceDto,
} from '@/services/adminAIService';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatDateTime = (iso: string | null) => {
  if (!iso) return 'Not available';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString();
};

export const AdminAIDashboard: React.FC = () => {
  const { setCurrentPage } = useApp();
  const { role } = useAuth();

  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string>('');

  const [overview, setOverview] = useState<AIOverviewDto | null>(null);
  const [users, setUsers] = useState<AIUserIntelligenceDto[]>([]);
  const [insights, setInsights] = useState<AIInsightFeedDto[]>([]);
  const [patterns, setPatterns] = useState<AIPatternAnalyticsDto | null>(null);
  const [accuracy, setAccuracy] = useState<AIAccuracyDto | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [rawData, setRawData] = useState<AIRawUserDataDto | null>(null);
  const [rawLoading, setRawLoading] = useState(false);

  const loadDashboard = async () => {
    setState('loading');
    setError('');

    try {
      const [overviewData, usersData, insightsData, patternsData, accuracyData] = await Promise.all([
        adminAIService.getOverview(),
        adminAIService.getUsers(40),
        adminAIService.getInsights(60),
        adminAIService.getPatterns(),
        adminAIService.getAccuracy(),
      ]);

      setOverview(overviewData);
      setUsers(usersData);
      setInsights(insightsData);
      setPatterns(patternsData);
      setAccuracy(accuracyData);
      setState('ready');
    } catch (loadError) {
      setState('error');
      setError(loadError instanceof Error ? loadError.message : 'Failed to load AI dashboard');
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadRawUserData = async (userId: string) => {
    if (!userId) return;
    setRawLoading(true);

    try {
      const payload = await adminAIService.getRawUserData(userId);
      setRawData(payload);
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : 'Failed to load raw user data');
    } finally {
      setRawLoading(false);
    }
  };

  const insightTypeCounts = useMemo(() => {
    return insights.reduce<Record<string, number>>((acc, insight) => {
      acc[insight.insightType] = (acc[insight.insightType] ?? 0) + 1;
      return acc;
    }, {});
  }, [insights]);

  if (role !== 'admin') {
    return (
      <CenteredLayout>
        <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-center">
          <h2 className="text-2xl font-bold text-red-900">Access Denied</h2>
          <p className="mt-2 text-red-700">Only admins can access AI intelligence dashboards.</p>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="mt-4 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            Go to Dashboard
          </button>
        </div>
      </CenteredLayout>
    );
  }

  return (
    <CenteredLayout maxWidth="max-w-[1600px]">
      <div className="space-y-6 rounded-3xl bg-slate-950 p-4 sm:p-6 text-slate-100 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Finora AI System</h1>
            <p className="text-sm text-slate-400">Backend Intelligence Engine - Admin Control Surface</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage('admin')}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-slate-500"
            >
              Back
            </button>
            <button
              onClick={() => { void loadDashboard(); }}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
            >
              Refresh
            </button>
            <button
              onClick={async () => {
                await adminAIService.runFeatureEngine();
                await loadDashboard();
              }}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Run Features
            </button>
            <button
              onClick={async () => {
                await adminAIService.runPredictionEngine();
                await loadDashboard();
              }}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Run Predictions
            </button>
          </div>
        </div>

        {state === 'loading' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-slate-300">
            Loading AI telemetry...
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl border border-red-400/50 bg-red-900/20 p-4 text-sm text-red-200">
            {error || 'Failed to load AI dashboard'}
          </div>
        )}

        {state === 'ready' && overview && patterns && accuracy && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800">
                <p className="text-xs uppercase text-slate-400">Users Analyzed</p>
                <p className="mt-2 text-3xl font-semibold">{overview.usersAnalyzed}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800">
                <p className="text-xs uppercase text-slate-400">Insights Generated</p>
                <p className="mt-2 text-3xl font-semibold">{overview.insightsGenerated}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800">
                <p className="text-xs uppercase text-slate-400">Risk Alerts</p>
                <p className="mt-2 text-3xl font-semibold">{overview.riskAlerts}</p>
              </div>
              <div className="rounded-2xl bg-slate-900 p-4 border border-slate-800">
                <p className="text-xs uppercase text-slate-400">Last Training</p>
                <p className="mt-2 text-sm font-medium">{formatDateTime(overview.lastTrainingTime)}</p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[2fr,1fr]">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h2 className="text-lg font-semibold">User Intelligence Table</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-slate-800">
                        <th className="py-2 pr-4">User</th>
                        <th className="py-2 pr-4">Spend Score</th>
                        <th className="py-2 pr-4">Risk Score</th>
                        <th className="py-2 pr-4">Savings Rate</th>
                        <th className="py-2 pr-4">Top Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.userId} className="border-b border-slate-900 hover:bg-slate-800/40">
                          <td className="py-2 pr-4">
                            <button
                              onClick={() => {
                                setSelectedUserId(user.userId);
                                void loadRawUserData(user.userId);
                              }}
                              className="text-left text-cyan-300 hover:text-cyan-200"
                            >
                              {user.name}
                              <div className="text-xs text-slate-500">{user.email}</div>
                            </button>
                          </td>
                          <td className="py-2 pr-4">{user.spendScore.toFixed(1)}</td>
                          <td className="py-2 pr-4">{user.riskScore.toFixed(1)}</td>
                          <td className="py-2 pr-4">{formatPercent(user.savingsRate * 100)}</td>
                          <td className="py-2 pr-4">{user.topCategory}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h2 className="text-lg font-semibold">AI Accuracy Monitor</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-400">Prediction Success</span><span>{formatPercent(accuracy.successRate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">High Confidence</span><span>{formatPercent(accuracy.highConfidenceRate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">False Positives</span><span>{formatPercent(accuracy.falsePositiveRate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Average Confidence</span><span>{accuracy.averageConfidence.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Total Predictions</span><span>{accuracy.totalPredictions}</span></div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.4fr,1fr,1fr]">
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h3 className="text-base font-semibold">Pattern Analytics - Category Distribution</h3>
                <div className="mt-3 space-y-2">
                  {patterns.categoryDistribution.map((entry) => (
                    <div key={entry.category} className="space-y-1">
                      <div className="flex justify-between text-sm"><span>{entry.category}</span><span className="text-slate-400">{entry.users}</span></div>
                      <progress
                        className="h-2 w-full rounded-full bg-slate-800 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-cyan-500"
                        max={100}
                        value={Math.min(100, entry.users * 10)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h3 className="text-base font-semibold">Insights Feed</h3>
                <div className="mt-3 max-h-64 overflow-auto space-y-2">
                  {insights.slice(0, 12).map((insight) => (
                    <div key={insight.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-cyan-300">{insight.insightType}</span>
                        <span className="text-slate-500">{new Date(insight.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-1 text-slate-300">{insight.userEmail}</div>
                      <div className="mt-1 text-slate-500">Confidence {formatPercent(insight.confidenceScore * 100)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
                <h3 className="text-base font-semibold">Insight Type Mix</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {Object.entries(insightTypeCounts).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-2">
                      <span className="text-slate-300">{key}</span>
                      <span className="text-cyan-300">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4">
              <h2 className="text-lg font-semibold">Raw AI Data Viewer</h2>
              <div className="mt-2 text-sm text-slate-400">Select a user from the intelligence table to inspect features, insights JSON, and AI event logs.</div>
              {selectedUserId && (
                <div className="mt-3 text-xs text-slate-500">Selected user: {selectedUserId}</div>
              )}
              {rawLoading && <div className="mt-3 text-sm text-slate-300">Loading raw data...</div>}
              {!rawLoading && rawData && (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl bg-slate-950/70 p-3 border border-slate-800 overflow-auto">
                    <h4 className="text-sm font-semibold mb-2">Features</h4>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(rawData.features, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl bg-slate-950/70 p-3 border border-slate-800 overflow-auto">
                    <h4 className="text-sm font-semibold mb-2">Insights</h4>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(rawData.insights, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl bg-slate-950/70 p-3 border border-slate-800 overflow-auto">
                    <h4 className="text-sm font-semibold mb-2">Event Logs</h4>
                    <pre className="text-xs text-slate-300 whitespace-pre-wrap break-words">{JSON.stringify(rawData.events, null, 2)}</pre>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </CenteredLayout>
  );
};

export default AdminAIDashboard;
