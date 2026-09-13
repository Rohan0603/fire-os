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

  constructor(private readonly auth: Auth) {}

  start(listener: (session: AuthSession) => void): void {
    this.stop();
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
      && this.auth.currentUser?.uid === session.user?.uid;
  }

  async signOut(): Promise<void> {
    this.generation += 1;
    await signOut(this.auth);
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }
}
