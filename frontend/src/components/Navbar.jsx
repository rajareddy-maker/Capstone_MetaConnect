import React from 'react';
import { Search, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import { logout } from '../services/auth';

export default function Navbar({ onSearchClick, currentUser, onLogout }) {
    const username = currentUser?.username || 'admin';
    const roleName = currentUser?.roles?.includes('admin')
        ? 'Administrator'
        : (currentUser?.roles?.includes('analyst') ? 'Data Analyst' : 'User');
    const isDev = currentUser?.isDev ?? false;

    return (
        <header className="header-nav">
            <div
                className="search-trigger-box"
                onClick={onSearchClick}
            >
                <Search size={16} />
                <span>Search connections, tables, columns...</span>
                <span className="kbd-shortcut">Ctrl + K</span>
            </div>

            <div className="header-actions">

                <div className="user-profile-badge">
                    <div className="user-avatar">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{username}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{roleName}</span>
                    </div>
                </div>

                <button
                    className="btn-icon"
                    onClick={onLogout || logout}
                    title="Sign Out"
                >
                    <LogOut size={16} />
                </button>
            </div>
        </header>
    );
}