export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

export interface SessionView {
  id: string;
  deviceId: string;
  deviceType: number;
  timezone: string;
  lang: string;
  loginAt: Date;
  lastUsedAt: Date;
  current: boolean;
}
