import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '月面三岔口｜时间穿梭',
  description: '从月面的时间之花出发，驶向四颗时间星球。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
