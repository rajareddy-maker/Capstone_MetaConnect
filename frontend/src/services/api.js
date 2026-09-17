import { getToken } from './auth';

const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (!response.ok) {
        let errorDetail = 'API request failed';
        try {
            const errJson = await response.json();
            errorDetail = errJson.detail || errJson.message || JSON.stringify(errJson);
        } catch {
            errorDetail = await response.text();
        }
        throw new Error(errorDetail);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

export const api = {
    // Statistics
    getStats: () => request('/stats/dashboard'),

    // Connections
    getConnections: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return request(`/connections${query ? `?${query}` : ''}`);
    },
    getConnection: (id) => request(`/connections/${id}`),
    createConnection: (data) => request('/connections', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    updateConnection: (id, data) => request(`/connections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    }),
    deleteConnection: (id) => request(`/connections/${id}`, {
        method: 'DELETE'
    }),
    testConnection: (data) => request('/connections/test', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    testSavedConnection: (id) => request(`/connections/${id}/test`, {
        method: 'POST'
    }),
    getConnectorTemplates: () => request('/connections/templates/connectors'),

    // Ingestion & Airflow
    triggerIngestion: (connectionId) => request(`/connections/${connectionId}/ingest`, {
        method: 'POST'
    }),
    getIngestionRuns: (limit = 20) => request(`/ingestion/runs?limit=${limit}`),
    getConnectionHistory: (connectionId) => request(`/ingestion/connection/${connectionId}/history`),

    // Metadata Catalog
    getMetadataTree: (connectionId) => request(`/metadata/tree/${connectionId}`),
    getDatabases: (connectionId) => {
        const q = connectionId ? `?connection_id=${connectionId}` : '';
        return request(`/metadata/databases${q}`);
    },
    getSchemas: (databaseId) => {
        const q = databaseId ? `?database_id=${databaseId}` : '';
        return request(`/metadata/schemas${q}`);
    },
    getTables: (schemaId) => {
        const q = schemaId ? `?schema_id=${schemaId}` : '';
        return request(`/metadata/tables${q}`);
    },
    getColumns: (tableId) => {
        const q = tableId ? `?table_id=${tableId}` : '';
        return request(`/metadata/columns${q}`);
    },

    // Search
    search: (query, type, limit = 50) => {
        const params = new URLSearchParams({ q: query });
        if (type) params.append('type', type);
        params.append('limit', String(limit));
        return request(`/search?${params.toString()}`);
    }
};