import dgram from "node:dgram";
import net from "node:net";
import os from "node:os";
import type { DiscoveredTv, Platform } from "../../shared/ipc";

const SSDP_ADDRESS = "239.255.255.250";
const SSDP_PORT = 1900;
const SEARCH_TARGETS = [
  "urn:dial-multiscreen-org:service:dial:1",
  "urn:samsung.com:device:RemoteControlReceiver:1",
  "urn:lge-com:service:webos-second-screen:1",
  "upnp:rootdevice",
];
const LISTEN_MS = 3000;
const REQUEST_TIMEOUT_MS = 2000;

export interface SsdpResponse {
  ip: string;
  st?: string;
  server?: string;
  location?: string;
}

export interface DeviceDescription {
  friendlyName?: string;
  manufacturer?: string;
  modelName?: string;
}

/** Headers of an SSDP search response, with lower-case keys. */
export function parseSsdpHeaders(message: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of message.split("\r\n").slice(1)) {
    const colon = line.indexOf(":");
    if (colon > 0)
      headers[line.slice(0, colon).trim().toLowerCase()] = line
        .slice(colon + 1)
        .trim();
  }
  return headers;
}

export function parseDescription(xml: string): DeviceDescription {
  const tag = (name: string) =>
    xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim() ||
    undefined;
  return {
    friendlyName: tag("friendlyName"),
    manufacturer: tag("manufacturer"),
    modelName: tag("modelName"),
  };
}

/** Which platform a responding device runs, or undefined for anything that isn't a supported TV. */
export function classify(
  responses: SsdpResponse[],
  description: DeviceDescription
): Platform | undefined {
  const text = [
    ...responses.flatMap((r) => [r.st, r.server]),
    description.manufacturer,
    description.modelName,
  ].join(" ");
  if (/webos|lge-com/i.test(text)) return "webos";
  if (/android/i.test(text)) return "android";
  if (/samsung/i.test(text)) return "tizen";
  return undefined;
}

/** Lists TVs on the local network that answer SSDP searches, for the given platform. */
export async function discoverTvs(platform: Platform): Promise<DiscoveredTv[]> {
  const byIp = new Map<string, SsdpResponse[]>();
  await search((response) => {
    byIp.set(response.ip, [...(byIp.get(response.ip) ?? []), response]);
  });

  const tvs = await Promise.all(
    [...byIp].map(async ([ip, responses]) => {
      const location = responses.find((r) => r.location)?.location;
      const description = location
        ? parseDescription(await fetchText(location).catch(() => ""))
        : {};
      if (classify(responses, description) !== platform) return undefined;
      return describe(platform, ip, description);
    })
  );
  return tvs
    .filter((tv): tv is DiscoveredTv => !!tv)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function describe(
  platform: Platform,
  ip: string,
  description: DeviceDescription
): Promise<DiscoveredTv | undefined> {
  const tv: DiscoveredTv = {
    name: description.friendlyName || ip,
    ip,
    model: description.modelName,
  };
  if (platform === "tizen") {
    // Samsung TVs (2016+) describe themselves here, including their Developer Mode setup.
    const info = await fetchText(`http://${ip}:8001/api/v2/`)
      .then((text) => JSON.parse(text).device)
      .catch(() => undefined);
    if (info && !/tv/i.test(info.type ?? "")) return undefined;
    if (info?.developerMode === "0") tv.warning = "Developer Mode is off";
    else if (info?.developerIP && !localAddresses().includes(info.developerIP))
      tv.warning = `Developer Mode is set to another computer (${info.developerIP})`;
  } else if (platform === "webos" && !(await isPortOpen(ip, 9922))) {
    tv.warning = "Developer Mode app isn't running";
  } else if (platform === "android" && !(await isPortOpen(ip, 5555))) {
    tv.warning = "Network debugging is off";
  }
  return tv;
}

/** Sends M-SEARCH from every network interface, since TVs only answer on their own subnet. */
function search(onResponse: (response: SsdpResponse) => void): Promise<void> {
  const sockets = localAddresses().map((address) => {
    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    socket.on("error", () => socket.close());
    socket.on("message", (message, remote) => {
      const headers = parseSsdpHeaders(message.toString());
      onResponse({
        ip: remote.address,
        st: headers.st,
        server: headers.server,
        location: headers.location,
      });
    });
    socket.bind(0, address, () => {
      for (const st of SEARCH_TARGETS) {
        const message = [
          "M-SEARCH * HTTP/1.1",
          `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`,
          'MAN: "ssdp:discover"',
          "MX: 2",
          `ST: ${st}`,
          "",
          "",
        ].join("\r\n");
        socket.send(message, SSDP_PORT, SSDP_ADDRESS);
      }
    });
    return socket;
  });
  return new Promise((resolve) =>
    setTimeout(() => {
      sockets.forEach((socket) => {
        try {
          socket.close();
        } catch {
          // Already closed after an error.
        }
      });
      resolve();
    }, LISTEN_MS)
  );
}

function localAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: REQUEST_TIMEOUT_MS });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}
