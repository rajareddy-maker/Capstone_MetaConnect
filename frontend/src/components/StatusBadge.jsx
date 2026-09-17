import React from 'react';

export default function StatusBadge({ status }) {
    const normalized = (status || 'UNTESTED').toUpperCase();

    if (normalized === 'CONNECTED' || normalized === 'SUCCESS') {
        return (
            <span className="badge badge-connected">
               
                {normalized === 'SUCCESS' ? 'Success' : 'Connected'}
            </span>
        );
    }

    if (normalized === 'FAILED') {
        return (
            <span className="badge badge-failed">
               
                Failed
            </span>
        );
    }

    if (normalized === 'RUNNING' || normalized === 'PENDING') {
        return (
            <span className="badge badge-running">
                
                {normalized === 'RUNNING' ? 'Running' : 'Pending'}
            </span>
        );
    }

    return (
        <span className="badge badge-untested">
            Untested
        </span>
    );
}