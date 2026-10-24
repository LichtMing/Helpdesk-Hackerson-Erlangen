import { useState, useEffect, useCallback, useRef } from "react";
import type { DeviceRequest, RegisteredDevice } from "../types";

const POLL_INTERVAL_ONLINE_MS = 3_000;
const POLL_INTERVAL_OFFLINE_MIN = 5_000;
const POLL_INTERVAL_OFFLINE_MAX = 30_000;

export function useDeviceData() {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  // 这里写假设备数据，用来UI预览
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([
    { id: "robot-001", name: "Patient Robot 1", isOnline: true },
    { id: "robot-002", name: "Patient Robot 2", isOnline: false },
  ]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // ===== 注释掉原来请求后端的轮询，不再访问服务器 =====
  /*
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const fetchData = async () => {
      // 原来的fetch请求代码
    };
    fetchData();
    timer = setInterval(fetchData, POLL_INTERVAL_ONLINE_MS);
    return () => clearInterval(timer);
  }, []);
  */

  return {
    requests,
    registeredDevices,
    lastRefreshed,
    loadingId,
  };
}
