import React, { useState, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { initAuth, loginWithKeycloakSSO, logout } from './services/auth';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import ConnectionsPage from './pages/ConnectionsPage';
import MetadataExplorerPage from './pages/MetadataExplorerPage';
import IngestionHistoryPage from './pages/IngestionHistoryPage';
import SearchPage from './pages/SearchPage';
import ConnectionModal from './components/ConnectionModal';

const pagePaths = {
    dashboard: '/',
    connections: '/connections',
    explorer: '/explorer',
    ingestion: '/ingestion',
    search: '/search'
};

function ProtectedRoute({ currentUser, children }) {
    if (!currentUser) {
        return <KeycloakRedirect />;
    }
    return children;
}

function ExplorerRoute() {
    const { connectionId } = useParams();
    return <MetadataExplorerPage initialConnectionId={connectionId || null} />;
}

function KeycloakRedirect() {
    useEffect(() => {
        loginWithKeycloakSSO();
    }, []);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-main)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-sans)'
        }}>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Redirecting to Keycloak...</p>
        </div>
    );
}

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isAddConnectionModalOpen, setIsAddConnectionModalOpen] = useState(false);
    const [explorerTargetConnId, setExplorerTargetConnId] = useState(null);

    useEffect(() => {
        // Check initial authentication state
        initAuth().then(auth => {
            if (auth.authenticated && auth.user) {
                setCurrentUser(auth.user);
            }
            setAuthLoading(false);
        }).catch(err => {
            console.warn('Auth init failed:', err);
            setAuthLoading(false);
        });

    }, []);

    const handleNavigateToExplorer = (connectionId = null) => {
        setExplorerTargetConnId(connectionId);
    };

    const handleLogout = () => {
        setCurrentUser(null);
        logout();
    };

    if (authLoading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-main)',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="pulse-dot" style={{ width: '12px', height: '12px', margin: '0 auto 16px', background: 'var(--accent-primary)' }}></div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Loading MetaConnect...</p>
                </div>
            </div>
        );
    }

    // If not authenticated, display Login Page
    return (
        <BrowserRouter>
            <AppRoutes
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                handleLogout={handleLogout}
                isAddConnectionModalOpen={isAddConnectionModalOpen}
                setIsAddConnectionModalOpen={setIsAddConnectionModalOpen}
                explorerTargetConnId={explorerTargetConnId}
                handleNavigateToExplorer={handleNavigateToExplorer}
            />
        </BrowserRouter>
    );
}

function AppRoutes({
    currentUser,
    setCurrentUser,
    handleLogout,
    isAddConnectionModalOpen,
    setIsAddConnectionModalOpen,
    explorerTargetConnId,
    handleNavigateToExplorer
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const activeTab = location.pathname === '/' ? 'dashboard' : location.pathname.split('/')[1];
    const navigateToPage = (page) => navigate(pagePaths[page] || '/');

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                navigate('/search');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    if (!currentUser) {
        return <KeycloakRedirect />;
    }

    return (
        <Routes>
            <Route path="*" element={
                <ProtectedRoute currentUser={currentUser}>
                    <div className="app-container">
                        <Sidebar activeTab={activeTab} setActiveTab={navigateToPage} />
                        <div className="main-content">
                            <Navbar
                                onSearchClick={() => navigate('/search')}
                                currentUser={currentUser}
                                onLogout={handleLogout}
                            />
                            <main style={{ flex: 1 }}>
                                <Routes>
                                    <Route path="/" element={<DashboardPage onNavigate={navigateToPage} onAddConnection={() => setIsAddConnectionModalOpen(true)} />} />
                                    <Route path="/connections" element={<ConnectionsPage onExplore={(id) => navigate(`/explorer/${id}`)} />} />
                                    <Route path="/explorer" element={<MetadataExplorerPage initialConnectionId={explorerTargetConnId} />} />
                                    <Route path="/explorer/:connectionId" element={<ExplorerRoute />} />
                                    <Route path="/ingestion" element={<IngestionHistoryPage />} />
                                    <Route path="/search" element={<SearchPage onNavigateToExplorer={(id) => navigate(`/explorer/${id}`)} />} />
                                    <Route path="*" element={<Navigate to="/" replace />} />
                                </Routes>
                            </main>
                        </div>
                        <ConnectionModal
                            isOpen={isAddConnectionModalOpen}
                            onClose={() => setIsAddConnectionModalOpen(false)}
                            onSuccess={() => {
                                setIsAddConnectionModalOpen(false);
                                navigate('/connections');
                            }}
                        />
                    </div>
                </ProtectedRoute>
            } />
        </Routes>
    );
}