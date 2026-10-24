import { opsStore } from '../ops/data/store';
import { initialHash, supabase } from '../lib/supabase';
import { MockAuthService, type PeopleDirectory } from './mockAuthService';
import { SupabaseAuthService } from './supabaseAuthService';
import type { AuthService } from './types';

/** The console's People list is the one place names, emails and active status live. */
export const opsDirectory: PeopleDirectory = {
  list: () => opsStore().get().people.map((p) => ({
    id: p.id, name: p.name, email: p.email, active: p.active, deactivatedAt: p.deactivatedAt, deactivatedBy: p.deactivatedBy
  })),
  rename: (id, name) => opsStore().updatePerson(id, { name })
};

/**
 * The auth backend the app talks to. Swap this for an HTTP implementation of `AuthService`
 * when the real API exists; no screen imports the mock directly.
 */
export const mockAuth = new MockAuthService({ directory: opsDirectory });
/** Supabase Auth when the project URL and key are set (the published site); the demo otherwise. */
export const authService: AuthService = supabase ? new SupabaseAuthService(supabase, initialHash, opsDirectory) : mockAuth;

/** True while running against the mock: shows demo links where a real backend would send email. */
export const IS_MOCK_AUTH = authService === mockAuth;
