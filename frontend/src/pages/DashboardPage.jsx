import React, { useState, useEffect } from 'react';
import {
    Database,
    Layers,
    Table as TableIcon,
    Columns,
    PlayCircle,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Plus,
    ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage({ onNavigate, onAddConnection }) {
    const [stats, setStats] = useState(null);
    const [recentRuns, setRecentRuns] = useState([]);
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [statsData, runsData, connsData] = await Promise.all([
                api.getStats(),
                api.getIngestionRuns(5),
                api.getConnections()
            ]);
            setStats(statsData);
            setRecentRuns(runsData);
            setConnections(connsData);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    };

    const overview = stats?.overview || {
        total_connections: 0,
        total_databases: 0,
        total_tables: 0,
        total_columns: 0,
        total_ingestion_runs: 0
    };

    return (
        <div className="page-wrapper">
            {/* Welcome Banner */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '32px',
                padding: '24px 28px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.95) 0%, rgba(239, 246, 255, 0.95) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                boxShadow: 'var(--shadow-md)'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                        Data Catalog & Metadata Platform
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: '4px' }}>
                        Manage source connections, automate Airflow ingestion pipelines, and explore unified schema assets.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" onClick={onAddConnection}>
                        <Plus size={16} />
                        Add Connection
                    </button>
                    <button className="btn btn-secondary" onClick={() => onNavigate('explorer')}>
                        Explore Catalog
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="metrics-grid">
                <MetricCard
                    label="Total Connections"
                    value={overview.total_connections}
                    icon={Database}
                    color="#38bdf8"
                    hint={`${overview.total_connections} active data source`}
                />
                <MetricCard
                    label="Databases / Catalogs"
                    value={overview.total_databases}
                    icon={Layers}
                    color="#818cf8"
                    hint="Discovered catalogs"
                />
                <MetricCard
                    label="Tables / Collections"
                    value={overview.total_tables}
                    icon={TableIcon}
                    color="#34d399"
                    hint="Ingested schema entities"
                />
                <MetricCard
                    label="Attributes / Fields"
                    value={overview.total_columns}
                    icon={Columns}
                    color="#fbbf24"
                    hint="Indexed data types"
                />
            </div>

            {/* Dashboard Split Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>

                {/* Active Connections Card */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Data Source Connections</h3>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('connections')}
                        >
                            View All
                        </button>
                    </div>

                    {connections.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                            <Database size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                            <p style={{ fontWeight: 500 }}>No connections configured yet.</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Add a MongoDB connection to begin metadata discovery.</p>
                            <button className="btn btn-primary btn-sm" style={{ marginTop: '16px' }} onClick={onAddConnection}>
                                <Plus size={14} /> Add First Connection
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {connections.slice(0, 4).map(conn => (
                                <div
                                    key={conn.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-subtle)',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: 'rgba(59, 130, 246, 0.1)',
                                            color: '#60a5fa',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: '0.8rem'
                                        }}>
                                            {conn.connector_type.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{conn.name}</div>
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {conn.created_at ? new Date(conn.created_at).toLocaleString() : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <StatusBadge status={conn.status} />
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => onNavigate('explorer')}
                                        >
                                            Inspect
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Ingestion Runs Card */}
                <div className="glass-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recent Pipeline Runs</h3>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate('ingestion')}
                        >
                            Pipeline History
                        </button>
                    </div>

                    {recentRuns.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                            <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                            <p style={{ fontWeight: 500 }}>No pipeline executions recorded.</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>Runs triggered via Airflow will appear here.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {recentRuns.map(run => (
                                <div
                                    key={run.id}
                                    style={{
                                        padding: '12px 16px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid var(--border-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                            {run.connection_name || 'Data Source Ingestion'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {new Date(run.started_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {run.stats?.tables && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {run.stats.tables} tables
                                            </span>
                                        )}
                                        <StatusBadge status={run.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}