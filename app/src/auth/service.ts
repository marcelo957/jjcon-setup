import { MockAuthService } from './mockAuthService';
import type { AuthService } from './types';

/**
 * The auth backend the app talks to. Swap this for an HTTP implementation of `AuthService`
 * when the real API exists; no screen imports the mock directly.
 */
export const mockAuth = new MockAuthService();
export const authService: AuthService = mockAuth;

/** True while running against the mock: shows demo links where a real backend would send email. */
export const IS_MOCK_AUTH = authService === mockAuth;
