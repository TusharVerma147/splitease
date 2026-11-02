import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRepository } from '../../../repositories/user.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { redisService } from '../../../providers/redis/redis.service';
import { config } from '../../../config/configuration';
import { Errors } from '../../../common/errors';
import { TOKEN_EXPIRY } from '../../../common/constant';
import { ISession } from '../../../schemas/session.schema';
import { DeviceInfo } from '../../../interfaces';

const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: { id: string; name: string; email: string };
  tokens: TokenPair;
}

function generateTokens(userId: string, sessionId: string): TokenPair {
  const jti = uuidv4();

  const accessToken = jwt.sign(
    { sub: userId, sid: sessionId },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN as unknown as number },
  );

  const refreshToken = jwt.sign(
    { sub: userId, sid: sessionId, jti },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN as unknown as number },
  );

  return { accessToken, refreshToken };
}

async function storeSession(sessionId: string, userId: string, jti: string): Promise<void> {
  await redisService.setSession(sessionId, userId);
  await redisService.storeRefreshJti(jti);
}

function extractJti(token: string): string {
  const payload = jwt.decode(token) as { jti?: string } | null;
  return payload?.jti ?? '';
}

export class AuthService {
  async register(
    data: { name: string; email: string; password: string },
    device: DeviceInfo,
  ): Promise<AuthResult> {
    const exists = await userRepo.existsByEmail(data.email);
    if (exists) throw Errors.emailTaken();

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await userRepo.create({ name: data.name, email: data.email, passwordHash });

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.SESSION_SECONDS * 1000);

    await sessionRepo.create({
      userId: user._id,
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      timezone: device.timezone,
      lang: device.lang,
      expiresAt,
    });

    const tokens = generateTokens(String(user._id), sessionId);
    const jti = extractJti(tokens.refreshToken);
    await storeSession(sessionId, String(user._id), jti);

    return {
      user: { id: String(user._id), name: user.name, email: user.email },
      tokens,
    };
  }

  async login(
    email: string,
    password: string,
    device: DeviceInfo,
  ): Promise<AuthResult> {
    const user = await userRepo.findByEmail(email);
    if (!user) throw Errors.unauthorized();

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Errors.unauthorized();

    const existingSession = await sessionRepo.findActiveByUserAndDevice(
      String(user._id),
      device.deviceId,
    );
    if (existingSession) {
      await sessionRepo.revokeSession(String(existingSession._id));
      await redisService.deleteSession(String(existingSession._id));
    }

    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY.SESSION_SECONDS * 1000);

    await sessionRepo.create({
      userId: user._id,
      deviceId: device.deviceId,
      deviceType: device.deviceType,
      timezone: device.timezone,
      lang: device.lang,
      expiresAt,
    });

    const tokens = generateTokens(String(user._id), sessionId);
    const jti = extractJti(tokens.refreshToken);
    await storeSession(sessionId, String(user._id), jti);

    return {
      user: { id: String(user._id), name: user.name, email: user.email },
      tokens,
    };
  }

  async refresh(
    sub: string,
    sid: string,
    jti: string,
    _device: DeviceInfo,
  ): Promise<TokenPair> {
    const isValid = await redisService.isRefreshJtiValid(jti);
    if (!isValid) {
      await redisService.deleteSession(sid);
      await sessionRepo.revokeSession(sid);
      throw Errors.refreshTokenReused();
    }

    await redisService.revokeRefreshJti(jti);

    const newSessionId = uuidv4();
    const tokens = generateTokens(sub, newSessionId);
    const newJti = extractJti(tokens.refreshToken);

    await redisService.deleteSession(sid);
    await storeSession(newSessionId, sub, newJti);
    await sessionRepo.updateLastUsed(sid);

    return tokens;
  }

  async logout(sessionId: string): Promise<void> {
    await redisService.deleteSession(sessionId);
    await sessionRepo.revokeSession(sessionId);
  }

  async logoutAll(userId: string): Promise<void> {
    const sessions = await sessionRepo.findAllActiveByUser(userId);
    await Promise.all(sessions.map((s) => redisService.deleteSession(String(s._id))));
    await sessionRepo.revokeAllByUser(userId);
  }

  async getSessions(userId: string): Promise<ISession[]> {
    return sessionRepo.findAllActiveByUser(userId);
  }
}

export const authService = new AuthService();
