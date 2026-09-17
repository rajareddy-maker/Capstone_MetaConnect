import React, { useState, useEffect } from 'react';
import {
    FolderTree,
    Database,
    Layers,
    Table as TableIcon,
    Columns,
    ChevronRight,
    ChevronDown,
    Key,
    Check,
    X,
    Info,
    RefreshCw,
    Sparkles,
    ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function MetadataExplorerPage({ initialConnectionId = null }) {
    const [connections, setConnections] = useState([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState(initialConnectionId);
    const [treeData, setTreeData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Expanded nodes set: set of node IDs
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [selectedNode, setSelectedNode] = useState(null);

    useEffect(() => {
        loadConnections();
    }, []);

    useEffect(() => {
        if (initialConnectionId && initialConnectionId !== selectedConnectionId) {
            setSelectedConnectionId(initialConnectionId);
        }
    }, [initialConnectionId]);

    useEffect(() => {
        if (selectedConnectionId) {
            loadTree(selectedConnectionId);
        }
    }, [selectedConnectionId]);

    const loadConnections = async () => {
        try {
            const data = await api.getConnections();
            setConnections(data);
            if (data.length > 0 && !selectedConnectionId) {
                setSelectedConnectionId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch connections:', err);
        }
    };

    const loadTree = async (connId) => {
        try {
            setLoading(true);
            const tree = await api.getMetadataTree(connId);
            setTreeData(tree);

            // Auto-expand root connection node and first database
            const initialExpanded = new Set([tree.id]);
            if (tree.children && tree.children.length > 0) {
                initialExpanded.add(tree.children[0].id);
                if (tree.children[0].children && tree.children[0].children.length > 0) {
                    initialExpanded.add(tree.children[0].children[0].id);
                }
            }
            setExpandedNodes(initialExpanded);
            setSelectedNode(tree);
        } catch (err) {
            console.error('Failed to load metadata tree:', err);
            setTreeData(null);
        } finally {
            setLoading(false);
        }
    };

    const toggleNode = (nodeId, e) => {
        e.stopPropagation();
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const selectNode = (node, e) => {
        e.stopPropagation();
        setSelectedNode(node);
    };

    const getNodeIcon = (type) => {
        switch (type) {
            case 'connection': return <Database size={15} color="#60a5fa" />;
            case 'database': return <Layers size={15} color="#818cf8" />;
            case 'schema': return <FolderTree size={15} color="#c084fc" />;
            case 'table': return <TableIcon size={15} color="#34d399" />;
            case 'column': return <Columns size={14} color="#fbbf24" />;
            default: return <Info size={14} />;
        }
    };

    // Render tree node recursively
    const renderTreeNode = (node) => {
        const isExpanded = expandedNodes.has(node.id);
        const isSelected = selectedNode?.id === node.id;
        const hasChildren = node.children && node.children.length > 0;

        return (
            <div key={node.id} className="tree-node">
                <div
                    className={`tree-node-item ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => selectNode(node, e)}
                >
                    {hasChildren ? (
                        <span
                            onClick={(e) => toggleNode(node.id, e)}
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px' }}
                        >
                            {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                        </span>
                    ) : (
                        <span style={{ width: '14px', display: 'inline-block' }}></span>
                    )}

                    {getNodeIcon(node.type)}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {node.name}
                    </span>

                    {node.type === 'table' && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {node.children?.length || 0} fields
                        </span>
                    )}
                </div>

                {hasChildren && isExpanded && (
                    <div style={{ paddingLeft: '6px', borderLeft: '1px solid var(--border-subtle)', marginLeft: '10px' }}>
                        {node.children.map(child => renderTreeNode(child))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="page-wrapper">
            {/* Header with Connection Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Metadata Explorer</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
                        Hierarchical catalog navigator: Connection → Database → Schema → Table → Column
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Source Connection:
                    </label>
                    <select
                        className="select-field"
                        style={{ width: '240px', padding: '8px 12px' }}
                        value={selectedConnectionId || ''}
                        onChange={(e) => setSelectedConnectionId(e.target.value)}
                    >
                        {connections.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name} ({c.connector_type})
                            </option>
                        ))}
                    </select>
                    <button
                        className="btn-icon"
                        onClick={() => selectedConnectionId && loadTree(selectedConnectionId)}
                        title="Reload metadata tree"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Explorer Split View */}
            <div className="explorer-layout">

                {/* Left Tree Navigator */}
                <div className="tree-sidebar">
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', paddingLeft: '8px' }}>
                        Hierarchy Tree
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Loading catalog tree...
                        </div>
                    ) : !treeData ? (
                        <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No metadata found. Click <strong>"Ingest"</strong> on the Connections page to discover schema.
                        </div>
                    ) : (
                        <div>{renderTreeNode(treeData)}</div>
                    )}
                </div>

                {/* Right Details Inspection Panel */}
                <div className="metadata-detail-panel">
                    {!selectedNode ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                            <FolderTree size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>Select a node in the hierarchy tree to inspect details.</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                                Explore database catalogs, collections, inferred fields, and primary key constraints.
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* Breadcrumb Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {getNodeIcon(selectedNode.type)}
                                <span style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                                    {selectedNode.type}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedNode.name}</h3>
                                    {selectedNode.metadata?.description && (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                                            {selectedNode.metadata.description}
                                        </p>
                                    )}
                                </div>

                                {selectedNode.type === 'connection' && (
                                    <StatusBadge status={selectedNode.metadata?.status} />
                                )}
                            </div>

                            {/* TABLE / COLLECTION VIEW */}
                            {selectedNode.type === 'table' && (
                                <div>
                                    {/* Table Stats Overview */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Entity Type</span>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: '#60a5fa' }}>
                                                {selectedNode.metadata?.table_type || 'Collection'}
                                            </div>
                                        </div>

                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Estimated Documents</span>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: '#34d399' }}>
                                                {selectedNode.metadata?.row_count?.toLocaleString() || '0'}
                                            </div>
                                        </div>

                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Indexed Attributes</span>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: '#fbbf24' }}>
                                                {selectedNode.children?.length || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
                                        Schema Definition & Attributes
                                    </h4>

                                    <div className="table-container">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Field Name</th>
                                                    <th>Data Type</th>
                                                    <th>Primary Key</th>
                                                    <th>Nullable</th>
                                                    <th>Inferred Details</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedNode.children?.map((col, idx) => {
                                                    const meta = col.metadata || {};
                                                    return (
                                                        <tr key={col.id}>
                                                            <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '40px' }}>
                                                                {idx + 1}
                                                            </td>
                                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <Columns size={14} color="#fbbf24" />
                                                                    <span>{col.name}</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className="type-pill">{meta.data_type || 'string'}</span>
                                                            </td>
                                                            <td>
                                                                {meta.is_primary_key ? (
                                                                    <span className="pk-badge">
                                                                        <Key size={10} style={{ display: 'inline', marginRight: '3px' }} /> PK
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {meta.is_nullable ? (
                                                                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Yes</span>
                                                                ) : (
                                                                    <span style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>No</span>
                                                                )}
                                                            </td>
                                                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                                {meta.description || 'Auto-discovered'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* DATABASE / CATALOG VIEW */}
                            {selectedNode.type === 'database' && (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Schemas</span>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px', color: '#c084fc' }}>
                                                {selectedNode.children?.length || 0}
                                            </div>
                                        </div>

                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Collections/Tables</span>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '2px', color: '#34d399' }}>
                                                {selectedNode.children?.reduce((acc, s) => acc + (s.children?.length || 0), 0) || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
                                        Collections in Database
                                    </h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {selectedNode.children?.flatMap(s => s.children || []).map(tbl => (
                                            <div
                                                key={tbl.id}
                                                onClick={(e) => selectNode(tbl, e)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--border-subtle)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <TableIcon size={16} color="#34d399" />
                                                    <span style={{ fontWeight: 600 }}>{tbl.name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {tbl.children?.length || 0} columns • {tbl.metadata?.row_count || 0} docs
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* CONNECTION VIEW */}
                            {selectedNode.type === 'connection' && (
                                <div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Connector Type</span>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: '#60a5fa' }}>
                                                {selectedNode.metadata?.connector_type?.toUpperCase()}
                                            </div>
                                        </div>

                                        <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Last Ingested</span>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '2px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                                {selectedNode.metadata?.last_ingested_at? new Date(selectedNode.metadata.last_ingested_at).toLocaleString() : 'Never'}
                                            </div>
                                        </div>
                                    </div>

                                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px' }}>
                                        Discovered Databases
                                    </h4>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {selectedNode.children?.map(dbNode => (
                                            <div
                                                key={dbNode.id}
                                                onClick={(e) => selectNode(dbNode, e)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--border-subtle)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Layers size={16} color="#818cf8" />
                                                    <span style={{ fontWeight: 600 }}>{dbNode.name}</span>
                                                </div>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    {dbNode.children?.length || 0} schemas
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}