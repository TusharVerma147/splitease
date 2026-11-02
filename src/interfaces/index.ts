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

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      device?: DeviceInfo;
      requestId?: string;
    }
  }
}
