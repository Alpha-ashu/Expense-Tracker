import net from 'net';
import { logger } from '../config/logger';

export type VirusScanStatus = 'clean' | 'infected' | 'skipped' | 'failed';

export type VirusScanResult = {
  status: VirusScanStatus;
  details?: string;
};

const sendInstream = (buffer: Buffer, host: string, port: number) =>
  new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write('zINSTREAM\0');
      const chunkSize = 1024 * 1024;
      for (let offset = 0; offset < buffer.length; offset += chunkSize) {
        const chunk = buffer.subarray(offset, offset + chunkSize);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
      socket.end();
    });

    let response = '';
    socket.on('data', (data) => {
      response += data.toString('utf8');
    });
    socket.on('end', () => resolve(response.trim()));
    socket.on('error', (err) => reject(err));
  });

export const scanBufferForViruses = async (buffer: Buffer): Promise<VirusScanResult> => {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT || 3310);
  const required = process.env.CLAMAV_REQUIRED === 'true';

  if (!host) {
    return { status: 'skipped', details: 'CLAMAV_HOST not configured' };
  }

  try {
    const response = await sendInstream(buffer, host, port);
    if (/FOUND/i.test(response)) {
      return { status: 'infected', details: response };
    }
    if (/OK$/i.test(response)) {
      return { status: 'clean', details: response };
    }
    return { status: 'failed', details: response || 'Unexpected scanner response' };
  } catch (error: any) {
    logger.warn('Virus scan failed', { error: error?.message || error });
    if (required) {
      throw new Error('Virus scan unavailable');
    }
    return { status: 'failed', details: error?.message || 'Scan failed' };
  }
};
