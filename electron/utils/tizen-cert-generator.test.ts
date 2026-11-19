import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  certificateDir,
  generateCertificates,
  getRegisteredRedirectUri,
  isValidCertificate,
  StaleConfigError,
  type CertificateRequest,
} from "./tizen-cert-generator";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";
const config = {
  serviceId: "svc",
  loginUrl:
    "https://account.example.com/login?redirect_uri=http://localhost:4794/signin",
  authorUrl: "https://cert.example.com/author",
  distributorUrl: "https://cert.example.com/distributor",
  timestamp: "1",
};

describe("certificateDir", () => {
  it("uses the profile name, made safe for a folder", () => {
    expect(
      certificateDir("/home/me", {
        email: "a@b.c",
        profileName: " my profile/1 ",
      })
    ).toBe(path.join("/home/me", "SamsungCertificate", "my_profile_1"));
  });

  it("falls back to the email's local part, then to default", () => {
    expect(certificateDir("/h", { email: "dev.one@example.com" })).toBe(
      path.join("/h", "SamsungCertificate", "dev.one")
    );
    expect(certificateDir("/h", { email: "@example.com" })).toBe(
      path.join("/h", "SamsungCertificate", "default")
    );
  });
});

describe("Samsung login URLs", () => {
  it("builds the OAuth URL", () => {
    const url = new URL(buildAuthUrl(config, "http://localhost:4794/x", "st"));
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      serviceID: "svc",
      actionID: "StartOAuth2",
      accessToken: "Y",
      redirect_uri: "http://localhost:4794/x",
      state: "st",
    });
  });

  it("reads the registered redirect URI from the login URL", () => {
    expect(getRegisteredRedirectUri(config.loginUrl)).toBe(
      "http://localhost:4794/signin"
    );
    expect(getRegisteredRedirectUri("https://example.com/")).toBeUndefined();
    expect(getRegisteredRedirectUri("not a url")).toBeUndefined();
  });
});

describe("isValidCertificate", () => {
  it("accepts PEM and DER, and rejects anything else", () => {
    expect(isValidCertificate(Buffer.from(PEM))).toBe(true);
    expect(isValidCertificate(Buffer.from([0x30, 0x82, 0x01, 0x0a]))).toBe(
      true
    );
    expect(isValidCertificate(Buffer.from("<html>Error</html>"))).toBe(false);
    expect(isValidCertificate(Buffer.from("0"))).toBe(false);
  });
});

describe("generateCertificates", () => {
  let dir: string;
  let calls: { args: string[]; stdin?: string }[];
  let forms: { url: string; form: FormData }[];
  let chains: Record<string, string>;

  // Writes each -out file like OpenSSL would, and keeps the chain each .p12 was made from.
  const fakeOpenssl = async (args: string[], stdin?: string) => {
    calls.push({ args, stdin });
    const out = args[args.indexOf("-out") + 1];
    if (args[0] === "pkcs12") {
      const chain = args[args.indexOf("-in") + 1];
      chains[out] = await fs.readFile(path.join(dir, chain), "utf-8");
    }
    await fs.writeFile(path.join(dir, out), args[0]);
  };

  const request = (
    overrides: Partial<CertificateRequest> = {}
  ): CertificateRequest => ({
    dir,
    email: "dev@example.com",
    deviceIds: [" DUID-1 ", "", "DUID-2"],
    password: "secret",
    privilegeLevel: "Public",
    developerType: "Individual",
    credentials: {
      accessToken: "token",
      userId: "user",
      email: "dev@example.com",
    },
    config,
    caCerts: {
      author: path.join(dir, "..", "author-ca.crt"),
      distributor: path.join(dir, "..", "distributor-ca.crt"),
    },
    openssl: fakeOpenssl,
    log: () => {},
    ...overrides,
  });

  const respondWith = (body: string, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body: FormData }) => {
        forms.push({ url, form: init.body });
        return new Response(body, { status });
      })
    );

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tizen-cert-"));
    dir = path.join(root, "profile");
    await fs.writeFile(path.join(root, "author-ca.crt"), "AUTHOR CA");
    await fs.writeFile(path.join(root, "distributor-ca.crt"), "DIST CA");
    calls = [];
    forms = [];
    chains = {};
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(path.dirname(dir), { recursive: true, force: true });
  });

  it("signs both certificates and leaves only the .p12 files", async () => {
    respondWith(PEM);
    await generateCertificates(request());

    expect((await fs.readdir(dir)).sort()).toEqual([
      "author.p12",
      "distributor.p12",
    ]);
    expect(chains["author.p12"]).toBe(`${PEM}\nAUTHOR CA`);
    expect(chains["distributor.p12"]).toBe(`${PEM}\nDIST CA`);

    const distributorCsr = calls.find((c) =>
      c.args.includes("distributor.csr")
    );
    expect(distributorCsr?.args).toContain(
      "subjectAltName=URI:URN:tizen:deviceid=DUID-1,URI:URN:tizen:deviceid=DUID-2"
    );
    const exports = calls.filter((c) => c.args[0] === "pkcs12");
    expect(exports.map((c) => c.args.at(-1))).toEqual(["-legacy", "-legacy"]);
    expect(exports[0].stdin).toBe("secret\n");

    expect(forms.map((f) => f.url)).toEqual([
      config.authorUrl,
      config.distributorUrl,
    ]);
    expect(forms[1].form.get("privilege_level")).toBe("Public");
    expect(forms[1].form.get("user_id")).toBe("user");
  });

  it("retries the export without -legacy on older OpenSSL", async () => {
    respondWith(PEM);
    const openssl = async (args: string[], stdin?: string) => {
      if (args.includes("-legacy"))
        throw new Error("openssl exited 1: pkcs12: Unknown option '-legacy'");
      await fakeOpenssl(args, stdin);
    };
    await generateCertificates(request({ openssl }));
    expect(chains["author.p12"]).toBeDefined();
  });

  it("flags a moved endpoint or a non-certificate reply as stale config", async () => {
    respondWith("", 404);
    await expect(generateCertificates(request())).rejects.toBeInstanceOf(
      StaleConfigError
    );

    respondWith("<html>Maintenance</html>");
    await expect(generateCertificates(request())).rejects.toThrow(
      /non-certificate response: <html>Maintenance<\/html>/
    );
  });

  it("reports other API errors with the response body", async () => {
    respondWith("quota exceeded", 500);
    const error = await generateCertificates(request()).catch((e) => e);
    expect(error).not.toBeInstanceOf(StaleConfigError);
    expect(error.message).toBe(
      "Samsung API 500 for author.csr: quota exceeded"
    );
  });
});
