import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function ConnectionModal({ isOpen, onClose, onSuccess, initialData = null }) {
    const [templates, setTemplates] = useState([]);
    const [selectedType, setSelectedType] = useState('mongodb');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        host: '',
        port: '',
        database_name: '',
        username: '',
        password: '',
        connection_uri: ''
    });

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadTemplates();
            if (initialData) {
                setSelectedType(initialData.connector_type || 'mongodb');
                setFormData({
                    name: initialData.name || '',
                    description: initialData.description || '',
                    host: initialData.host || '',
                    port: initialData.port || '',
                    database_name: initialData.database_name || '',
                    username: initialData.username || '',
                    password: '',
                    connection_uri: initialData.extra_params?.connection_uri || ''
                });
            } else {
                setFormData({
                    name: '',
                    description: '',
                    host: '',
                    port: '',
                    database_name: '',
                    username: '',
                    password: '',
                    connection_uri: ''
                });
            }
            setTestResult(null);
            setError(null);
        }
    }, [isOpen, initialData]);

    const loadTemplates = async () => {
        try {
            const data = await api.getConnectorTemplates();
            setTemplates(data);
        } catch (err) {
            console.warn('Could not load connector templates:', err);
        }
    };

    if (!isOpen) return null;

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setTestResult(null); // Reset test state on edit
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setError(null);
        setTestResult(null);

        try {
            const payload = {
                connector_type: selectedType,
                host: formData.host || null,
                port: Number(formData.port) || null,
                database_name: formData.database_name || null,
                username: formData.username || null,
                password: formData.password || null,
                extra_params: formData.connection_uri ? { connection_uri: formData.connection_uri } : {}
            };

            const result = await api.testConnection(payload);
            setTestResult(result);
        } catch (err) {
            setTestResult({
                success: false,
                message: err.message || 'Connection test failed. Verify host and port.'
            });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name) {
            setError('Connection name is required.');
            return;
        }
        if (!initialData?.id && !testResult?.success) {
            setError('Test the connection successfully before creating it.');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            const payload = {
                name: formData.name,
                description: formData.description || null,
                connector_type: selectedType,
                host: formData.host || null,
                port: Number(formData.port) || null,
                database_name: formData.database_name || null,
                username: formData.username || null,
                password: formData.password || null,
                extra_params: formData.connection_uri ? { connection_uri: formData.connection_uri } : {}
            };

            if (initialData?.id) {
                await api.updateConnection(initialData.id, payload);
            } else {
                await api.createConnection(payload);
            }

            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to save connection.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                            {initialData ? 'Edit Connection' : 'Add New Data Connection'}
                        </h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Configure data source connector, credentials, and network settings.
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && (
                            <div style={{ padding: '12px 16px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: '#fca5a5', marginBottom: '20px', fontSize: '0.88rem' }}>
                                {error}
                            </div>
                        )}

                        {/* Connector Type Selector */}
                        <div className="form-group">
                            <label className="form-label">Select Connector Type</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                                {templates.map(t => {
                                    const isSelected = selectedType === t.type;
                                    return (
                                        <div
                                            key={t.type}
                                            onClick={() => {
                                                if (t.is_active) {
                                                    setSelectedType(t.type);
                                                    setFormData(prev => ({ ...prev, port: t.default_port }));
                                                }
                                            }}
                                            style={{
                                                padding: '12px',
                                                borderRadius: 'var(--radius-md)',
                                                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                                                cursor: t.is_active ? 'pointer' : 'not-allowed',
                                                opacity: t.is_active ? 1 : 0.45,
                                                transition: 'all 0.2s ease',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: isSelected ? '#60a5fa' : 'var(--text-primary)' }}>
                                                {t.display_name}
                                            </div>
                                            <span style={{ fontSize: '0.7rem', color: t.is_active ? 'var(--color-success)' : 'var(--text-muted)' }}>
                                                {t.is_active ? 'Active' : 'Pluggable'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* General Connection Settings */}
                        <div className="form-group">
                            <label className="form-label">Connection Name *</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Production MongoDB Cluster"
                                value={formData.name}
                                onChange={e => handleInputChange('name', e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Primary e-commerce product and customer catalog"
                                value={formData.description}
                                onChange={e => handleInputChange('description', e.target.value)}
                            />
                        </div>

                        {/* Host and Port Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Host / Server</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="localhost, mongodb-source, or cluster.mongodb.net"
                                    value={formData.host}
                                    onChange={e => handleInputChange('host', e.target.value)}
                                />
                                <span className="form-hint">For Docker Compose: use <code>mongodb-source</code></span>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Port</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="27017"
                                    value={formData.port}
                                    onChange={e => handleInputChange('port', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Database & Authentication */}
                        <div className="form-group">
                            <label className="form-label">Database / Auth Source</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. ecommerce or admin"
                                value={formData.database_name}
                                onChange={e => handleInputChange('database_name', e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Username</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Optional username"
                                    value={formData.username}
                                    onChange={e => handleInputChange('username', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder={initialData?.has_password ? '•••••••• (unchanged)' : 'Optional password'}
                                    value={formData.password}
                                    onChange={e => handleInputChange('password', e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Optional URI override */}
                        <div className="form-group">
                            <label className="form-label">Connection URI (Optional Override)</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="mongodb://username:password@host:27017/admin"
                                value={formData.connection_uri}
                                onChange={e => handleInputChange('connection_uri', e.target.value)}
                            />
                            <span className="form-hint">Overrides host/port and credentials if specified.</span>
                        </div>

                        {!initialData?.id && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px',
                                padding: '14px',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-card-hover)',
                                marginTop: '8px'
                            }}>
                                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                    Test your connection before creating the service
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleTestConnection}
                                    disabled={testing}
                                >
                                    {testing ? 'Testing...' : 'Test Connection'}
                                </button>
                            </div>
                        )}

                        {/* Test Result Toast/Banner */}
                        {testResult && (
                            <div style={{
                                padding: '14px',
                                borderRadius: 'var(--radius-md)',
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                background: testResult.success ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                                border: `1px solid ${testResult.success ? 'var(--color-success)' : 'var(--color-danger)'}`
                            }}>
                                {testResult.success ? (
                                    <CheckCircle2 size={20} color="var(--color-success)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                ) : (
                                    <AlertTriangle size={20} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                )}
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: testResult.success ? '#6ee7b7' : '#fca5a5' }}>
                                        {testResult.success ? 'Connection Verified' : 'Connection Failed'}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', marginTop: '2px', color: 'var(--text-secondary)' }}>
                                        {testResult.message}
                                    </div>
                                    {testResult.latency_ms && (
                                        <div style={{ fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                                            Round-trip Latency: {testResult.latency_ms} ms
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving || (!initialData?.id && !testResult?.success)}
                        >
                            {saving ? 'Saving...' : (initialData ? 'Update Connection' : 'Save Connection')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}