import os from 'os';
import mongoose from 'mongoose';
import { ENV } from '../config/env.js';


export const analyzeSystemHealth = async () => {
    const env = ENV();
    
    const uptime = process.uptime();
    const timestamp = Date.now();
    
    const memoryUsage = process.memoryUsage();
    const cpuLoad = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = ((usedMem / totalMem) * 100).toFixed(2);

    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };

    const start = Date.now();
    let dbLatency = -1;
    try {
        if (dbStatus === 1) {
            // Check if db object exists before calling admin()
            if (mongoose.connection.db) {
                await mongoose.connection.db.admin().ping();
                dbLatency = Date.now() - start;
            } else {
                await mongoose.connection.getClient().db().admin().ping();
                dbLatency = Date.now() - start;
            }
        }
    } catch (err) {
        dbLatency = -1;
    }

    let status = 'healthy';
    if (dbStatus !== 1 || parseFloat(memPercentage) > 95) {
        status = 'degraded';
    }
    if (dbStatus === 0) {
        status = 'critical';
    }

    return {
        status,
        timestamp,
        uptime: {
            seconds: Math.floor(uptime),
            human: formatUptime(uptime)
        },
        system: {
            platform: os.platform(),
            architecture: os.arch(),
            nodeVersion: process.version,
            cpuLoad: {
                '1m': cpuLoad[0].toFixed(2),
                '5m': cpuLoad[1].toFixed(2),
                '15m': cpuLoad[2].toFixed(2)
            },
            memory: {
                total: formatBytes(totalMem),
                free: formatBytes(freeMem),
                used: formatBytes(usedMem),
                percentage: `${memPercentage}%`,
                process: {
                    rss: formatBytes(memoryUsage.rss),
                    heapTotal: formatBytes(memoryUsage.heapTotal),
                    heapUsed: formatBytes(memoryUsage.heapUsed),
                    external: formatBytes(memoryUsage.external)
                }
            }
        },
        database: {
            status: dbStatusMap[dbStatus] || 'unknown',
            latency: dbLatency !== -1 ? `${dbLatency}ms` : 'N/A'
        },
        network: {
            serverUrl: env.server_url,
            environment: env.NODE_ENV
        }
    };
};

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const dDisplay = d > 0 ? d + (d === 1 ? " day, " : " days, ") : "";
    const hDisplay = h > 0 ? h + (h === 1 ? " hour, " : " hours, ") : "";
    const mDisplay = m > 0 ? m + (m === 1 ? " minute, " : " minutes, ") : "";
    const sDisplay = s > 0 ? s + (s === 1 ? " second" : " seconds") : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
