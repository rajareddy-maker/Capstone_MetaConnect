import React, { useState, useEffect } from 'react';
import {
  Search,
  Database,
  Layers,
  Table as TableIcon,
  Columns,
  FolderTree,
  ArrowRight,
  Sparkles,
  Key
} from 'lucide-react';
import { api } from '../services/api';

export default function SearchPage({ onNavigateToExplorer }) {
  const [query, setQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [results, setResults] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim()) {
        performSearch(query, selectedType);
      } else {
        setResults([]);
        setCounts({});
        setTotalMatches(0);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, selectedType]);

  const performSearch = async (q, type) => {
    try {
      setLoading(true);
      const res = await api.search(q, type);
      setResults(res.results || []);
      setCounts(res.grouped_counts || {});
      setTotalMatches(res.total_matches || 0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'connection': return <Database size={16} color="#60a5fa" />;
      case 'database': return <Layers size={16} color="#818cf8" />;
      case 'schema': return <FolderTree size={16} color="#c084fc" />;
      case 'table': return <TableIcon size={16} color="#34d399" />;
      case 'column': return <Columns size={16} color="#fbbf24" />;
      default: return <Search size={16} />;
    }
  };

  const filterTypes = [
    { id: '', label: 'All Entities' },
    { id: 'connection', label: 'Connections' },
    { id: 'database', label: 'Databases' },
    { id: 'schema', label: 'Schemas' },
    { id: 'table', label: 'Tables / Collections' },
    { id: 'column', label: 'Columns / Fields' }
  ];

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Global Metadata Discovery</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '2px' }}>
          Instantly query datasets, collections, schema fields, and connection properties.
        </p>
      </div>

      {/* Main Search Input */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--accent-primary)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search customer, order, total_amount, email, ecommerce..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              paddingLeft: '48px',
              paddingTop: '14px',
              paddingBottom: '14px',
              fontSize: '1.05rem',
              borderRadius: 'var(--radius-md)'
            }}
            autoFocus
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {filterTypes.map(f => {
            const isSelected = selectedType === f.id;
            const count = f.id ? (counts[f.id] || 0) : totalMatches;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedType(f.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  background: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.04)',
                  color: isSelected ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${isSelected ? 'transparent' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{f.label}</span>
                {query && <span style={{ opacity: 0.75, fontSize: '0.75rem' }}>({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Results List */}
      <div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Searching metadata assets...
          </div>
        ) : query && results.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Search size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No matching assets found for "{query}"</p>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Try searching by field name (e.g. <code>email</code>, <code>price</code>), collection name, or database.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map(item => (
              <div
                key={`${item.entity_type}_${item.id}`}
                className="glass-card"
                style={{
                  padding: '18px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => onNavigateToExplorer(item.connection_id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getIcon(item.entity_type)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {item.name}
                      </span>
                      <span className="type-pill" style={{ textTransform: 'uppercase', fontSize: '0.68rem' }}>
                        {item.entity_type}
                      </span>
                      {item.data_type && (
                        <span className="type-pill">{item.data_type}</span>
                      )}
                      {item.is_primary_key && (
                        <span className="pk-badge">
                          <Key size={10} style={{ display: 'inline', marginRight: '3px' }} /> PK
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {item.breadcrumb}
                    </div>

                    {item.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <span>Inspect</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}