import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { IUserLite } from 'fishpi';
import * as GitHub from '../lib/github';
import { IRegisterBody } from './auth.controller';
import { User } from 'src/users/user.entity';
import { ConfigService } from 'src/config/config.service';
import path from 'path';
import fs from 'fs';
import { omit } from 'src/utils';
import nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  verifyTemplate = fs.readFileSync(
    path.join(__dirname, '../../assets/verify_zh.html'),
    'utf-8',
  );
  logoSvg = fs
    .readFileSync(path.join(__dirname, '../../assets/logo.svg'), 'utf-8')
    .replaceAll('1em', '40px');
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(body: IRegisterBody) {
    const user = await this.usersService.findOne(body.username, '');
    if (user) throw new Error('用户已存在');

    const emailUser = await this.usersService.findByEmail(body.email);
    if (emailUser) throw new Error('邮箱已被注册');

    const token = crypto.randomBytes(20).toString('hex');
    const newUser = new User({
      username: body.username,
      password: body.password,
      email: body.email,
      nickname: body.nickname,
      from: '',
    });
    newUser.verificationToken = token;
    newUser.isVerified = false;

    const account = await this.usersService.save(newUser);
    const mailConfig = this.configService.get('mail');

    const domain = process.env.DOMAIN || 'http://localhost:3000';
    const mailHtml = this.makeVerifyMail({ user: account, token, domain });

    try {
      const transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: {
          user: mailConfig.user,
          pass: mailConfig.pass,
        },
      });

      await transporter.sendMail({
        from: mailConfig.from,
        to: account.email,
        subject: `[织言·Tellory] 请验证您的电子邮件地址`,
        html: mailHtml,
      });
    } catch (err) {
      console.error('发送验证邮件失败', err);
    }

    return account;
  }

  async verifyEmail(token: string) {
    if (!token) throw new Error('token 不能为空');
    const user = await this.usersService.verifyByToken(token);
    if (!user) throw new Error('验证 Token 无效或已过期');
    return { success: true };
  }

  async resendVerification(email: string, domain: string) {
    if (!email) throw new Error('邮箱不能为空');
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new Error('用户不存在');
    if (user.isVerified) throw new Error('用户已激活');

    const token = crypto.randomBytes(20).toString('hex');
    const updated = await this.usersService.setVerificationTokenByEmail(
      email,
      token,
    );
    if (!updated) throw new Error('设置验证 Token 失败');

    const mailConfig = this.configService.get('mail');
    const mailHtml = this.makeVerifyMail({ user: updated, token, domain });

    try {
      const transporter = nodemailer.createTransport({
        host: mailConfig.host,
        port: mailConfig.port,
        secure: mailConfig.secure,
        auth: {
          user: mailConfig.user,
          pass: mailConfig.pass,
        },
      });

      const res = await transporter.sendMail({
        from: mailConfig.from,
        to: updated.email,
        subject: `[织言·Tellory] 请验证您的电子邮件地址`,
        html: mailHtml,
      });
      console.log('发送验证邮件结果', res);
      return { success: true };
    } catch (err) {
      console.error('发送验证邮件失败', err);
      throw new Error('发送验证邮件失败');
    }
  }

  async login(body: { username: string; password: string }) {
    const user = await this.usersService.findOne(body.username, '');
    if (!user) throw new Error('用户名或密码错误');
    const sha256 = crypto.createHash('sha256');
    const password = sha256
      .update(body.password + this.configService.get('salt'))
      .digest('hex');
    if (user.password !== password) throw new Error('用户名或密码错误');
    const isAdmin = user?.isAdmin;
    const payload = { username: user.username, sub: user.id, isAdmin };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        from: user.from,
        isAdmin,
      },
    };
  }

  async loginFishpi(user: IUserLite) {
    const userDetail = await this.usersService.getFishpiUser(user.userName);
    if (!userDetail) throw new Error('用户不存在');
    const account = await this.usersService.save(userDetail);
    const isAdmin = userDetail?.isAdmin;
    const payload = { username: account.username, sub: account.id, isAdmin };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        ...omit(account, User.unsafeKey),
        isAdmin,
      },
    };
  }

  async loginGithub(query: any, domain: string) {
    const accessToken = await GitHub.verify(query, domain);
    if (accessToken) {
      const userInfo = await this.usersService.getGitHubUser(accessToken);
      if (!userInfo) throw new Error('获取 GitHub 用户信息失败');
      const account = await this.usersService.save(userInfo);
      const isAdmin = account?.isAdmin;
      const payload = {
        username: account.username,
        from: account.from,
        sub: account.id,
        isAdmin,
      };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: account.id,
          username: account.username,
          from: account.from,
          email: account.email,
          isAdmin,
        },
      };
    } else {
      throw new Error('GitHub OAuth 验证失败');
    }
  }

  async loginSteam(steamid: string) {
    const userInfo = await this.usersService.getSteamUser(steamid);
    if (!userInfo) throw new Error('获取 Steam 用户信息失败');
    const account = await this.usersService.save(userInfo);
    const isAdmin = userInfo?.isAdmin;
    const payload = {
      username: account.username,
      sub: account.id,
      from: account.from,
      isAdmin,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: account.id,
        username: account.username,
        from: account.from,
        isAdmin,
      },
    };
  }

  makeVerifyMail({
    user,
    token,
    domain,
  }: {
    user: User;
    token: string;
    domain: string;
  }) {
    if (!user.email) throw new Error('用户邮箱不存在');
    const verifyUrl = `${domain}/#/${user.username}/verification/?token=${token}`;
    const mail = this.verifyTemplate
      .replaceAll('{{domain}}', domain)
      .replaceAll('{{logo}}', this.logoSvg)
      .replaceAll('{{nickname}}', user.username)
      .replaceAll('{{email}}', user.email)
      .replaceAll('{{verifyUrl}}', verifyUrl)
      .replaceAll('{{name}}', '织言·Tellory');
    return mail;
  }
}
