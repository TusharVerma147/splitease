import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserRepository } from '../../../repositories/user.repository';
import { SessionRepository } from '../../../repositories/session.repository';
import { redisService } from '../../../providers/redis/redis.service';
import { config } from '../../../config/configuration';
import { Errors } from '../../../common/errors';
import { TOKEN_EXPIRY } from '../../../common/constant';
import { ISession } from '../../../schemas/session.schema';
import { IUser } from '../../../schemas/user.schema';
import { DeviceInfo } from '../../../interfaces';
import { AuthResult, SessionView, TokenPair } from './interface/auth.interface';
import { RegisterDto } from './dto/auth.dto';

const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();

const BCRYPT_ROUNDS = 12;
/** Compared against when the email is unknown, so timing does not reveal which emails exist. */
const DUMMY_HASH = bcrypt.hashSync('splitease-dummy-password', BCRYPT_ROUNDS);

function signTokens(userId: string, sessionId: string): TokenPair & { jti: string } {
  const jti = randomUUID();
  const accessToken = jwt.sign({ sub: userId, sid: sessionId }, config.JWT_ACCESS_SECRET, {
    expiresIn: TOKEN_EXPIRY.ACCESS_SECONDS,
  });
  const refreshToken = jwt.sign({ sub: userId, sid: sessionId, jti }, config.JWT_REFRESH_SECRET, {
    expiresIn: TOKEN_EXPIRY.REFRESH_SECONDS,
  });
  return { accessToken, refreshToken, jti };
}

function toAuthUser(user: IUser): AuthResult['user'] {
  return { id: String(user._id), name: user.name, email: user.email };
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/** Ends a session everywhere: Redis (session + refresh jti) and Mongo. */
async function endSession(sessionId: string): Promise<void> {
  await redisService.deleteSession(sessionId);
  await sessionRepo.revokeSession(sessionId);
}

/**
 * Creates the session for a (user, device). One device has one session: any older
 * session of the same device is revoked first. The Mongo session `_id` is the `sid`
 * used in both tokens and in Redis.
 */
async function openSession(user: IUser, device: DeviceInfo): Promise<AuthResult> {
  const userId = String(user._id);

  const previous = await sessionRepo.findActiveByUserAndDevice(userId, device.deviceId);
  for (const old of previous) await endSession(String(old._id));

  const session = await sessionRepo.create({
    userId: user._id,
    deviceId: device.deviceId,
    deviceType: device.deviceType,
    timezone: device.timezone,
    lang: device.lang,
    expiresAt: new Date(Date.now() + TOKEN_EXPIRY.SESSION_SECONDS * 1000),
  });
  const sessionId = String(session._id);

  const { jti, ...tokens } = signTokens(userId, sessionId);
  await redisService.setSession(sessionId, userId);
  await redisService.setRefreshJti(sessionId, jti);

  return { user: toAuthUser(user), tokens };
}

export class AuthService {
  async register(data: RegisterDto, device: DeviceInfo): Promise<AuthResult> {
    if (await userRepo.existsByEmail(data.email)) throw Errors.emailTaken();

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    let user: IUser;
    try {
      user = await userRepo.create({ name: data.name, email: data.email, passwordHash });
    } catch (err) {
      if (isDuplicateKey(err)) throw Errors.emailTaken();
      throw err;
    }
    return openSession(user, device);
  }

  async login(email: string, password: string, device: DeviceInfo): Promise<AuthResult> {
    const user = await userRepo.findByEmail(email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || !user.isActive) throw Errors.unauthorized('Invalid email or password');

    return openSession(user, device);
  }

  /**
   * Rotation: every refresh issues a new pair and invalidates the presented refresh token.
   * Reuse: presenting an already-rotated token ends the whole session.
   */
  async refresh(userId: string, sessionId: string, jti: string, device: DeviceInfo): Promise<TokenPair> {
    const sessionUser = await redisService.getSession(sessionId);
    if (!sessionUser || sessionUser !== userId) throw Errors.unauthorized('Session has ended');

    const session = await sessionRepo.findById(sessionId);
    if (!session || session.revokedAt || session.deviceId !== device.deviceId) {
      throw Errors.unauthorized('Session does not belong to this device');
    }

    const user = await userRepo.findById(userId);
    if (!user || !user.isActive) {
      await endSession(sessionId);
      throw Errors.unauthorized();
    }

    const { jti: newJti, ...tokens } = signTokens(userId, sessionId);
    const rotated = await redisService.rotateRefreshJti(sessionId, jti, newJti);
    if (!rotated) {
      await endSession(sessionId);
      throw Errors.refreshTokenReused();
    }

    await redisService.setSession(sessionId, userId);
    await sessionRepo.updateLastUsed(sessionId);
    return tokens;
  }

  async logout(sessionId: string): Promise<void> {
    await endSession(sessionId);
  }

  async logoutAll(userId: string): Promise<void> {
    const sessions = await sessionRepo.findAllActiveByUser(userId);
    await Promise.all(sessions.map((s) => redisService.deleteSession(String(s._id))));
    await sessionRepo.revokeAllByUser(userId);
  }

  async getSessions(userId: string, currentSessionId: string): Promise<SessionView[]> {
    const sessions: ISession[] = await sessionRepo.findAllActiveByUser(userId);
    return sessions.map((s) => ({
      id: String(s._id),
      deviceId: s.deviceId,
      deviceType: s.deviceType,
      timezone: s.timezone,
      lang: s.lang,
      loginAt: s.loginAt,
      lastUsedAt: s.lastUsedAt,
      current: String(s._id) === currentSessionId,
    }));
  }
}

export const authService = new AuthService();
