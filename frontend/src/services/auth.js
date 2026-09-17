import Keycloak from 'keycloak-js';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'metaconnect';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'metaconnect-frontend';

let keycloakInstance = null;

// Helper to decode JWT payload safely without external dependencies
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export const initAuth = async () => {
  // 1. Check if token already exists in localStorage
  const savedToken = localStorage.getItem('metaconnect_token');
  if (savedToken) {
    const claims = parseJwt(savedToken);
    if (claims && claims.exp && claims.exp * 1000 > Date.now()) {
      return {
        authenticated: true,
        user: {
          username: claims.preferred_username || claims.sub,
          name: claims.name || claims.preferred_username || 'Authorized User',
          email: claims.email,
          roles: claims.realm_access?.roles || ['user'],
          isDev: false
        }
      };
    } else {
      localStorage.removeItem('metaconnect_token');
      localStorage.removeItem('metaconnect_refresh_token');
    }
  }

  // 2. Initialize Keycloak OIDC adapter (handles return from Hosted SSO)
  try {
    keycloakInstance = new Keycloak({
      url: KEYCLOAK_URL,
      realm: KEYCLOAK_REALM,
      clientId: KEYCLOAK_CLIENT_ID
    });

    const authenticated = await keycloakInstance.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      enableLogging: false
    });

    if (authenticated && keycloakInstance.token) {
      localStorage.setItem('metaconnect_token', keycloakInstance.token);
      if (keycloakInstance.refreshToken) {
        localStorage.setItem('metaconnect_refresh_token', keycloakInstance.refreshToken);
      }
      return {
        authenticated: true,
        user: {
          username: keycloakInstance.tokenParsed?.preferred_username || 'user',
          name: keycloakInstance.tokenParsed?.name || 'Authorized User',
          email: keycloakInstance.tokenParsed?.email,
          roles: keycloakInstance.tokenParsed?.realm_access?.roles || ['user'],
          isDev: false
        }
      };
    }
  } catch (error) {
    console.warn('Keycloak client init notice:', error);
  }

  return {
    authenticated: false,
    user: null
  };
};

export const loginWithKeycloakSSO = () => {
  if (keycloakInstance) {
    keycloakInstance.login({ redirectUri: window.location.origin });
  } else {
    window.location.href = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth?client_id=${KEYCLOAK_CLIENT_ID}&redirect_uri=${encodeURIComponent(window.location.origin)}&response_type=code&scope=openid`;
  }
};

export const getToken = () => {
  if (keycloakInstance && keycloakInstance.token) {
    return keycloakInstance.token;
  }
  return localStorage.getItem('metaconnect_token') || 'dev-token';
};

export const logout = () => {
  localStorage.removeItem('metaconnect_token');
  localStorage.removeItem('metaconnect_refresh_token');

  if (keycloakInstance && keycloakInstance.authenticated) {
    keycloakInstance.logout({ redirectUri: window.location.origin });
  } else {
    window.location.reload();
  }
};