import Keycloak from 'keycloak-js';

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = import.meta.env.VITE_KEYCLOAK_REALM || 'metaconnect';
const KEYCLOAK_CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'metaconnect-frontend';

let keycloakInstance = null;

export const initAuth = async () => {
  // Keycloak keeps tokens in memory and restores authentication through its SSO session.
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
  return keycloakInstance?.token || '';
};

export const logout = () => {
  if (keycloakInstance && keycloakInstance.authenticated) {
    keycloakInstance.logout({ redirectUri: window.location.origin });
  } else {
    window.location.reload();
  }
};