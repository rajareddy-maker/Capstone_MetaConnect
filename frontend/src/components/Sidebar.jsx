import React from 'react';
import {
    LayoutDashboard,
    Database,
    FolderTree,
    PlayCircle,
    Search,
    Layers,
    Sparkles
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'connections', label: 'Connections', icon: Database },
        { id: 'explorer', label: 'Metadata Explorer', icon: FolderTree },
        { id: 'ingestion', label: 'Pipelines & Runs', icon: PlayCircle },
        { id: 'search', label: 'Global Search', icon: Search }
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="brand-logo-badge">
                    <Layers size={20} />
                </div>
                <div>
                    <h1 className="brand-title">MetaConnect</h1>
                    <p className="brand-subtitle">Metadata Framework</p>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <div
                            key={item.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <Icon size={18} />
                            <span>{item.label}</span>
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Sparkles size={16} color="var(--accent-primary)" />
                    <span>v1.0.0</span>
                </div>
            </div>
        </aside>
    );
}