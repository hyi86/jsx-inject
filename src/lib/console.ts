const RESET = '\x1b[0m';

const rgb = (value: string) => (text: string) => {
  const [red, green, blue] = value.split(' ').map(Number);
  if (!red || !green || !blue) {
    return text;
  }

  const clampedRed = clamp(red, 0, 255);
  const clampedGreen = clamp(green, 0, 255);
  const clampedBlue = clamp(blue, 0, 255);

  return `\x1b[38;2;${clampedRed};${clampedGreen};${clampedBlue}m${text}${RESET}`; // bg: \x1b[48;2;...
};

export const green = rgb('34 197 94');
export const dim = rgb('156 163 175');
export const dim2 = rgb('107 114 128');
export const cyan = rgb('59 130 246');
export const white = rgb('217 217 217');
export const yellow = rgb('250 204 21');
export const red = rgb('239 68 68');
export const blue = rgb('59 130 246');
export const purple = rgb('168 85 247');
export const pink = rgb('236 72 153');
export const orange = rgb('234 88 12');
export const gray = rgb('107 114 128');
export const gray2 = rgb('156 163 175');
export const gray3 = rgb('209 213 219');
export const gray4 = rgb('229 231 235');
export const emerald = rgb('16 185 129');
export const teal = rgb('2 132 199');
export const sky = rgb('2 132 199');
export const violet = rgb('139 92 246');
export const fuchsia = rgb('219 39 119');
export const rose = rgb('225 29 72');

type LogType = 'process' | 'success' | 'info' | 'warn' | 'error' | 'none';

/**
 * `Edge runtime` 과 `Node.js`, `web` 에서 동일한 콘솔 로그 스타일을 유지하기 위한 유틸리티 Logger
 * @see {@link https://ui.shadcn.com/colors Tailwind CSS Colors}
 */
export function prettyLog(type: LogType, ...args: any[]) {
  const log = console.log;

  const now = `[${new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}]`;

  switch (type) {
    case 'process':
      log(dim(` ⠋ ${now}`), ...args);
      return;
    case 'success':
      log(green(` ✓ ${now}`), ...args);
      return;
    case 'info':
      log(cyan(` ○ ${now}`), ...args);
      return;
    case 'warn':
      log(yellow(` ⚠ ${now}`), ...args);
      return;
    case 'error':
      log(red(` ✗ ${now}`), ...args);
      return;
    default:
      log(whiteSpace, ...args);
      return;
  }
}

export const whiteSpace = ' '.repeat(13);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
