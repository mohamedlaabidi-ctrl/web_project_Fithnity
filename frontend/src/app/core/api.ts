declare global {
  interface Window {
    __THNIYTI_API_URL__?: string;
  }
}

const configuredApi = typeof window !== 'undefined' ? window.__THNIYTI_API_URL__ : undefined;
export const API = (configuredApi || 'http://localhost:3000/api').replace(/\/+$/, '');
