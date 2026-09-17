import React from 'react';

export default function MetricCard({ label, value, icon: Icon, color = 'var(--accent-primary)', hint }) {
    return (
        <div className="metric-card">
            <div className="metric-info">
                <span className="metric-label">{label}</span>
                <span className="metric-value">{value}</span>
                {hint && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</span>}
            </div>
            <div className="metric-icon-box" style={{ color }}>
                <Icon size={24} />
            </div>
        </div>
    );
}