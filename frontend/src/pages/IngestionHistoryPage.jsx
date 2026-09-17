import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle2, AlertCircle, Clock, RotateCw, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function IngestionHistoryPage() {
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadRuns();
    }, []);

    const loadRuns = async () => {
        try {
            setLoading(true);
            const data = await api.getIngestionRuns(30);
            setRuns(data);
        } catch (err) {
            console.error('Failed to load ingestion runs:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateDuration = (start, end) => {
        if (!end) return 'Running...';
        const diff = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
        if (diff < 60) return `${diff}s`;
        return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    };

    return (
        <div className="page-wrapper">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Metadata Ingestion Pipelines</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                        Historical audit logs of Apache Airflow metadata extraction and sync DAGs.
                    </p>
                </div>
                <button className="btn btn-secondary" onClick={loadRuns} disabled={loading}>
                    <RotateCw size={14} /> Refresh Runs
                </button>
            </div>

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Execution ID</th>
                                <th>Target Connection</th>
                                <th>Airflow DAG Run</th>
                                <th>Status</th>
                                <th>Started At</th>
                                <th>Duration</th>
                                <th>Ingested Assets</th>
                                <th>Details / Diagnostics</th>
                            </tr>
                        </thead>
                        <tbody>
                            {runs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        No pipeline runs recorded yet. Initiate an ingestion run from the Connections page.
                                    </td>
                                </tr>
                            ) : (
                                runs.map(run => (
                                    <tr key={run.id}>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {run.id.slice(0, 8)}...
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {run.connection_name || 'Connection'}
                                        </td>
                                        <td>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                                                {run.dag_run_id || 'manual-trigger'}
                                            </span>
                                        </td>
                                        <td>
                                            <StatusBadge status={run.status} />
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                {new Date(run.started_at).toLocaleString()}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                                {calculateDuration(run.started_at, run.completed_at)}
                                            </span>
                                        </td>
                                        <td>
                                            {run.stats && Object.keys(run.stats).length > 0 ? (
                                                <div style={{ display: 'flex', gap: '6px', fontSize: '0.75rem' }}>
                                                    {run.stats.databases !== undefined && (
                                                        <span className="type-pill">{run.stats.databases} DBs</span>
                                                    )}
                                                    {run.stats.tables !== undefined && (
                                                        <span className="type-pill">{run.stats.tables} Collections</span>
                                                    )}
                                                    {run.stats.columns !== undefined && (
                                                        <span className="type-pill">{run.stats.columns} Fields</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                            )}
                                        </td>
                                        <td>
                                            {run.error_message ? (
                                                <span style={{ color: '#f87171', fontSize: '0.8rem' }}>
                                                    {run.error_message}
                                                </span>
                                            ) : run.status === 'SUCCESS' ? (
                                                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>
                                                    All metadata synced
                                                </span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                    In progress
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}