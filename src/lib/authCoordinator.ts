import {
  Auth,
  onAuthStateChanged,
  signOut,
  Unsubscribe,
  User,
} from 'firebase/auth';

export interface AuthSession {
  generation: number;
  user: User | null;
}

export class AuthCoordinator {
  private unsubscribe: Unsubscribe | null = null;
  private generation = 0;

  constructor(private readonly auth: Auth | null) {}

  start(listener: (session: AuthSession) => void): void {
    this.stop();
    // No Firebase configured is a supported guest-only mode: report a signed-out
    // session immediately instead of subscribing.
    if (!this.auth) {
      this.generation += 1;
      listener({ generation: this.generation, user: null });
      return;
    }
    this.unsubscribe = onAuthStateChanged(this.auth, (user) => {
      this.generation += 1;
      listener({ generation: this.generation, user });
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  isCurrent(session: AuthSession): boolean {
    return session.generation === this.generation
      && (this.auth?.currentUser?.uid ?? null) === (session.user?.uid ?? null);
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    if (!this.auth) return;
    await signOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.auth?.currentUser ?? null;
  }
}
