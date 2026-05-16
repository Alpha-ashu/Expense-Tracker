import os from 'os';
import { prisma } from '../db/prisma';

export const getSystemMetrics = async () => {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMem = totalMem - freeMem;
  const cpuLoad = os.loadavg()[0]; // 1 minute average
  
  // Total storage used by bills and documents
  const storageResult = await prisma.expenseBill.aggregate({
    _sum: { size: true }
  });

  return {
    cpu: {
      load: cpuLoad,
      cores: os.cpus().length,
      model: os.cpus()[0].model
    },
    memory: {
      total: totalMem,
      used: usedMem,
      percent: (usedMem / totalMem) * 100
    },
    storage: {
      usedBytes: Number(storageResult._sum.size || 0),
      totalBytes: 50 * 1024 * 1024 * 1024 // Mock 50GB limit for now
    },
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: process.platform,
    hostname: os.hostname()
  };
};
