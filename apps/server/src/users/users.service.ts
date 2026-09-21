import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';
import Fishpi from 'fishpi';
import * as crypto from 'crypto';
import * as GitHub from '../lib/github';
import * as Steam from '../lib/steam';
import { ConfigService } from 'src/config/config.service';
import { isMailConfigured, sendVerifyMail } from '../lib/mail';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private configService: ConfigService,
  ) {}

  async save(user: User): Promise<User> {
    const account = await this.findBySrcId(user.sourceId);
    if (account) {
      account.username = user.username;
      account.nickname = user.nickname;
      if (user.email) {
        account.email = user.email;
      }
      if (user.isVerified) {
        account.isVerified = user.isVerified;
      }
      account.isAdmin = user.isAdmin;
      account.avatar = user.avatar;
      account.lastLogin = user.lastLogin;
      await this.usersRepository.update({ id: account.id }, account);
      return account;
    }
    if (user.password) {
      const sha256 = crypto.createHash('sha256');
      user.password = sha256
        .update(user.password + this.configService.get('salt'))
        .digest('hex');
    }
    return this.usersRepository.save(user);
  }

  async findOne(username: string, from: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username, from } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findBySrcId(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { sourceId: id } });
  }

  async getUsers(ids: string[]): Promise<User[]> {
    return this.usersRepository.find({ where: { id: In(ids) } });
  }

  async getFishpiUser(username: string) {
    const user = await new Fishpi().user(username);
    if (!user) return null;
    return new User({
      username: user.userName,
      nickname: user.userNickname,
      isAdmin: user.role === '管理员',
      avatar: user.avatar,
      lastLogin: Date.now(),
      from: 'fishpi',
      sourceId: user.oId,
      isVerified: true,
    });
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { verificationToken: token },
    });
  }

  async verifyByToken(token: string): Promise<User | null> {
    const user = await this.findByVerificationToken(token);
    if (!user) return null;
    user.isVerified = true;
    user.verificationToken = '';
    await this.usersRepository.update({ id: user.id }, user);
    return user;
  }

  /** 记录用户是否已经走过编辑器引导 */
  async setToured(id: string, isToured = true): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;
    user.isToured = isToured;
    await this.usersRepository.update({ id: user.id }, { isToured });
    return user;
  }

  async setVerificationTokenByEmail(
    email: string,
    token: string,
  ): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    user.verificationToken = token;
    user.isVerified = false;
    user.lastVerifyMailTime = Date.now();
    await this.usersRepository.update({ id: user.id }, user);
    return user;
  }

  async getGitHubUser(token: string) {
    const userInfo = await GitHub.getUserInfo(token);
    if (!userInfo) return null;
    return new User({
      username: userInfo.login,
      nickname: userInfo.name,
      email: userInfo.email,
      isAdmin: false,
      avatar: userInfo.avatar_url,
      lastLogin: Date.now(),
      from: 'github',
      sourceId: userInfo.id,
      isVerified: !!userInfo.email,
    });
  }

  async getSteamUser(steamid: string) {
    const userInfo = await Steam.getUserInfo(steamid);
    if (!userInfo) return null;
    return new User({
      username:
        userInfo.profileurl.trim().split('/').slice(0, -1).pop() ||
        userInfo.personaname,
      nickname: userInfo.personaname,
      isAdmin: false,
      avatar: userInfo.avatarfull,
      lastLogin: Date.now(),
      from: 'steam',
      sourceId: userInfo.steamid,
      isVerified: true,
    });
  }

  async updateProfile(
    userId: string,
    data: { nickname?: string; email?: string },
    domain?: string,
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('用户不存在');

    if (data.nickname !== undefined) {
      user.nickname = data.nickname.trim();
    }

    if (data.email !== undefined) {
      const newEmail = data.email.trim();
      const oldEmail = (user.email || '').trim();

      if (newEmail !== oldEmail) {
        if (newEmail && !newEmail.includes('@')) {
          throw new BadRequestException('邮箱格式不正确');
        }

        if (newEmail) {
          const existing = await this.findByEmail(newEmail);
          if (existing && existing.id !== user.id) {
            throw new BadRequestException('该邮箱已被其他账号使用');
          }

          // 频率限制：一小时内只能发送一次验证邮件
          const ONE_HOUR = 3600 * 1000;
          const lastTime = Number(user.lastVerifyMailTime) || 0;
          if (lastTime && Date.now() - lastTime < ONE_HOUR) {
            const remainingMinutes = Math.ceil(
              (ONE_HOUR - (Date.now() - lastTime)) / 60000,
            );
            throw new BadRequestException(
              `验证邮件发送过于频繁，请在 ${remainingMinutes} 分钟后再试`,
            );
          }

          user.email = newEmail;
          user.isVerified = false;
          const token = crypto.randomBytes(20).toString('hex');
          user.verificationToken = token;
          user.lastVerifyMailTime = Date.now();

          // 若配置了邮件服务，发送验证邮件
          if (isMailConfigured()) {
            const siteDomain =
              domain || process.env.DOMAIN || 'http://localhost:3000';
            const verifyUrl = `${siteDomain}/#/${user.username}/verification/?token=${token}`;
            sendVerifyMail({
              to: user.email,
              nickname: user.nickname || user.username,
              verifyUrl,
              domain: siteDomain,
            }).catch((err) => {
              console.error('发送更新邮箱验证邮件失败:', err);
            });
          }
        } else {
          // 清空邮箱时取消已验证状态
          user.email = '';
          user.isVerified = false;
          user.verificationToken = '';
        }
      }
    }

    await this.usersRepository.update({ id: user.id }, user);
    return user;
  }
}
