import nodemailer, {
  Transporter,
  SendMailOptions as NodemailerSendOptions,
} from 'nodemailer';
import { ConfigService } from '../config/config.service';
import fs from 'fs';
import path from 'path';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface SendMailOptions {
  to?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: NodemailerSendOptions['attachments'];
}

let transporter: Transporter | null = null;
let currentMailConfig: string | null = null;

/**
 * 检查邮件服务是否已配置
 * @param customConfig 可选的自定义邮件配置，若不提供则从 ConfigService 获取
 */
export function isMailConfigured(
  customConfig?: MailConfig,
): customConfig is MailConfig {
  const mailConfig: MailConfig | undefined =
    customConfig || ConfigService.get('mail');
  return !!(mailConfig && mailConfig.host && mailConfig.user);
}

export const hasMailConfig = isMailConfigured;

/**
 * 获取或创建 nodemailer Transporter 实例
 * @param customConfig 可选的自定义邮件配置，若不提供则从 ConfigService 获取
 */
export function getTransporter(customConfig?: MailConfig): Transporter {
  const mailConfig: MailConfig | undefined =
    customConfig || ConfigService.get('mail');
  if (!isMailConfigured(mailConfig)) {
    throw new Error('邮件服务未配置，请联系管理员配置 SMTP 服务');
  }

  const configKey = JSON.stringify(mailConfig);
  if (transporter && currentMailConfig === configKey && !customConfig) {
    return transporter;
  }

  const newTransporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.secure,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.pass,
    },
  });

  if (!customConfig) {
    transporter = newTransporter;
    currentMailConfig = configKey;
  }

  return newTransporter;
}

/**
 * 发送邮件
 * @param options 发送选项（包含 to, subject, html 等）
 * @param customConfig 可选的自定义配置
 */
export async function sendMail(
  options: SendMailOptions,
  customConfig?: MailConfig,
) {
  if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
    throw new Error('收件人邮箱不能为空');
  }
  const mailConfig: MailConfig | undefined =
    customConfig || ConfigService.get('mail');
  const t = getTransporter(customConfig);

  const mailOptions: NodemailerSendOptions = {
    from: options.from || mailConfig?.from || mailConfig?.user,
    to: Array.isArray(options.to) ? options.to.join(',') : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  };

  return t.sendMail(mailOptions);
}

/**
 * 验证邮件服务配置连接是否正常
 */
export async function verifyTransporter(
  customConfig?: MailConfig,
): Promise<boolean> {
  const t = getTransporter(customConfig);
  return t.verify();
}

let storyApprovedTemplate: string | null = null;
let logoSvg: string | null = null;

function getStoryApprovedTemplate(): string {
  if (!storyApprovedTemplate) {
    storyApprovedTemplate = fs.readFileSync(
      path.join(__dirname, '../../assets/story_approved_zh.html'),
      'utf-8',
    );
  }
  return storyApprovedTemplate;
}

function getLogoSvg(): string {
  if (!logoSvg) {
    logoSvg = fs
      .readFileSync(path.join(__dirname, '../../assets/logo.svg'), 'utf-8')
      .replaceAll('1em', '40px');
  }
  return logoSvg;
}

export interface StoryApprovedMailOptions {
  to?: string;
  nickname: string;
  title: string;
  domain: string;
  playUrl: string;
}

/**
 * 发送故事通过审核的通知邮件
 */
export async function sendStoryApprovedMail(
  options: StoryApprovedMailOptions,
  customConfig?: MailConfig,
) {
  if (!options.to) {
    return null;
  }
  const template = getStoryApprovedTemplate();
  const logo = getLogoSvg();
  const siteName = '织言·Tellory';

  const html = template
    .replaceAll('{{domain}}', options.domain)
    .replaceAll('{{logo}}', logo)
    .replaceAll('{{nickname}}', options.nickname)
    .replaceAll('{{title}}', options.title)
    .replaceAll('{{playUrl}}', options.playUrl)
    .replaceAll('{{name}}', siteName);

  return sendMail(
    {
      to: options.to,
      subject: `[${siteName}] 您的故事《${options.title}》已通过审核！`,
      html,
    },
    customConfig,
  );
}
