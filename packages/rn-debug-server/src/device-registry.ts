import type { DeviceEntry, DeviceInfo, DeviceRegistry } from './types';

export function createDeviceRegistry(): DeviceRegistry {
  const devices = new Map<string, DeviceEntry>();

  function toInfo(entry: DeviceEntry): DeviceInfo {
    return {
      deviceId: entry.deviceId,
      ...entry.info,
      connectedAt: entry.connectedAt,
      lastSeen: entry.lastSeen,
    };
  }

  return {
    add(device) {
      devices.set(device.deviceId, device);
    },
    remove(deviceId) {
      return devices.delete(deviceId);
    },
    get(deviceId) {
      return devices.get(deviceId);
    },
    list() {
      return Array.from(devices.values()).map(toInfo);
    },
    touch(deviceId) {
      const entry = devices.get(deviceId);
      if (entry) entry.lastSeen = Date.now();
    },
  };
}
