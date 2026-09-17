import React, { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  Search,
  Play,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit3,
  RotateCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConnectionModal from '../components/ConnectionModal';

export default function ConnectionsPage({ onExplore }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    loadConnections();
  }, [filterName, filterType, filterStatus]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterName) params.name = filterName;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;

      const data = await api.getConnections(params);
      setConnections(data);
    } catch (err) {
      showNotice('error', 'Failed to load connections: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showNotice = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleTestConnection = async (connId) => {
    setActionLoading(prev => ({ ...prev, [`test_${connId}`]: true }));
    try {
      const res = await api.testSavedConnection(connId);
      if (res.success) {
        showNotice('success', `Connection successful! Ping: ${res.latency_ms}ms`);
      } else {
        showNotice('error', `Connection test failed: ${res.message}`);
      }
      loadConnections();
    } catch (err) {
      showNotice('error', 'Test error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`test_${connId}`]: false }));
    }
  };

  const handleTriggerIngestion = async (connId, connName) => {
    setActionLoading(prev => ({ ...prev, [`ingest_${connId}`]: true }));
    try {
      const res = await api.triggerIngestion(connId);
      showNotice('success', `Ingestion pipeline triggered for "${connName}". Processing metadata...`);
      setTimeout(loadConnections, 2000);
    } catch (err) {
      showNotice('error', 'Failed to trigger ingestion: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`ingest_${connId}`]: false }));
    }
  };

  const handleDelete = async (connId, connName) => {
    if (!window.confirm(`Are you sure you want to delete connection "${connName}"? All associated metadata will also be removed.`)) {
      return;
    }

    try {
      await api.deleteConnection(connId);
      showNotice('success', `Connection "${connName}" deleted.`);
      loadConnections();
    } catch (err) {
      showNotice('error', 'Failed to delete: ' + err.message);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Toast Notification */}
      {notification && (
        <div className="toast-box">
          <div className={`toast ${notification.type}`}>
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} color="var(--color-success)" />
            ) : (
              <AlertCircle size={18} color="var(--color-danger)" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Data Connections</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
            Register database endpoints, test connectivity, and initiate metadata discovery pipelines.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingConnection(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={16} /> Add Connection
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              className="input-field"
              placeholder="Filter by connection name..."
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
          </div>

          <div style={{ width: '160px' }}>
            <select
              className="select-field"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ padding: '8px 12px' }}
            >
              <option value="">All Types</option>
              <option value="mongodb">MongoDB</option>
            </select>
          </div>

          <div style={{ width: '160px' }}>
            <select
              className="select-field"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px' }}
            >
              <option value="">All Statuses</option>
              <option value="CONNECTED">Connected</option>
              <option value="FAILED">Failed</option>
              <option value="UNTESTED">Untested</option>
            </select>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={loadConnections}
            title="Refresh list"
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Connections Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Connection</th>
                <th>Type</th>
                <th>Added By</th>
                <th>Database</th>
                <th>Status</th>
                <th>Last Ingestion</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No matching connections found. Click <strong>"Add Connection"</strong> to register a new data source.
                  </td>
                </tr>
              ) : (
                connections.map(conn => {
                  const isTesting = actionLoading[`test_${conn.id}`];
                  const isIngesting = actionLoading[`ingest_${conn.id}`];

                  return (
                    <tr key={conn.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.75rem'
                          }}>
                            {conn.connector_type.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div>{conn.name}</div>
                            {conn.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                {conn.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="type-pill">{conn.connector_type}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>
                          {conn.created_by || 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <span>{conn.database_name || 'All Accessible'}</span>
                      </td>
                      <td>
                        <StatusBadge status={conn.status} />
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {conn.last_ingested_at ? new Date(conn.last_ingested_at).toLocaleString() : 'Never'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleTestConnection(conn.id)}
                            disabled={isTesting}
                            title="Test connectivity"
                          >
                            {isTesting ? 'Testing...' : 'Test'}
                          </button>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleTriggerIngestion(conn.id, conn.name)}
                            disabled={isIngesting}
                            title="Trigger Airflow pipeline ingestion"
                          >
                            <Play size={12} fill="currentColor" />
                            {isIngesting ? 'Ingesting...' : 'Ingest'}
                          </button>

                          {conn.last_ingested_at && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onExplore(conn.id)}
                              title="Explore Ingested Hierarchy"
                            >
                              Explore
                            </button>
                          )}

                          <button
                            className="btn-icon"
                            onClick={() => {
                              setEditingConnection(conn);
                              setIsModalOpen(true);
                            }}
                            title="Edit Connection"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            className="btn-icon"
                            onClick={() => handleDelete(conn.id, conn.name)}
                            title="Delete Connection"
                          >
                            <Trash2 size={14} color="#f87171" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Connection Modal */}
      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          showNotice('success', 'Connection saved successfully!');
          loadConnections();
        }}
        initialData={editingConnection}
      />
    </div>
  );
}