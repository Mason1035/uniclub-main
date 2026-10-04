export const IOS_INSTALL_MOBILE_QUERY = '(max-width: 767px)';
export const IOS_INSTALL_STANDALONE_QUERY = '(display-mode: standalone)';

export interface IOSInstallEnvironment {
  userAgent: string;
  maxTouchPoints: number;
  mobile: boolean;
  standalone: boolean;
}

/** A conservative Safari check: embedded and third-party browsers get no guide. */
export function canOfferIOSInstall(environment: IOSInstallEnvironment): boolean {
  const { userAgent, maxTouchPoints, mobile, standalone } = environment;
  return mobile && !standalone && maxTouchPoints > 0
    && /iPhone/i.test(userAgent)
    && /AppleWebKit\//i.test(userAgent)
    && /Version\/[\d.]+.*Mobile\/\S+.*Safari\//i.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|MicroMessenger|WeChat|FBAN|FBAV|Instagram|Line\/|DuckDuckGo|Ddg\/|YaBrowser|Brave|Electron/i.test(userAgent);
}
