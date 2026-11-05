export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
}

export interface DeviceInfo {
  deviceId: string;
  deviceType: number;
  timezone: string;
  lang: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  jti: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      device?: DeviceInfo;
      requestId?: string;
      refreshPayload?: RefreshTokenPayload;
    }
  }
}
