import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  REDACTED_API_LOG_VALUE,
  redactApiDiagnosticData,
} from "@/utils/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

describe("api diagnostics redaction", () => {
  let realApiFetch: typeof import("@/utils/api").apiFetch;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    const actualApi = await vi.importActual<typeof import("@/utils/api")>(
      "@/utils/api",
    );
    realApiFetch = actualApi.apiFetch;
  });

  beforeEach(() => {
    safeLocalStorage.clear();
    window.localStorage.setItem("CHATBOC_DEBUG_API", "true");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.removeItem("CHATBOC_DEBUG_API");
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("deeply redacts sensitive diagnostic keys without mutating the source", () => {
    const source = {
      headers: {
        AUTHORIZATION: "Bearer diagnostic-auth",
        "X-Eligibility-CREDENTIAL": "diagnostic-credential",
        "x-client-SECRET": "diagnostic-secret",
        "X-API_Key": "diagnostic-api-key",
        "X-Custom-ToKeN": "diagnostic-token",
        "X-Tracking-PiN": "diagnostic-pin",
        Cookie: "diagnostic-cookie",
        "X-Session-ID": "diagnostic-session",
        "X-Trace-Id": "trace-visible",
      },
      nested: [
        {
          clientSecret: "nested-secret",
          apiKey: "nested-api-key",
          safe: "safe-visible",
        },
      ],
    };

    const redacted = redactApiDiagnosticData(source) as {
      headers: Record<string, unknown>;
      nested: Array<Record<string, unknown>>;
    };

    expect(redacted.headers).toEqual({
      AUTHORIZATION: REDACTED_API_LOG_VALUE,
      "X-Eligibility-CREDENTIAL": REDACTED_API_LOG_VALUE,
      "x-client-SECRET": REDACTED_API_LOG_VALUE,
      "X-API_Key": REDACTED_API_LOG_VALUE,
      "X-Custom-ToKeN": REDACTED_API_LOG_VALUE,
      "X-Tracking-PiN": REDACTED_API_LOG_VALUE,
      Cookie: REDACTED_API_LOG_VALUE,
      "X-Session-ID": REDACTED_API_LOG_VALUE,
      "X-Trace-Id": "trace-visible",
    });
    expect(redacted.nested[0]).toEqual({
      clientSecret: REDACTED_API_LOG_VALUE,
      apiKey: REDACTED_API_LOG_VALUE,
      safe: "safe-visible",
    });
    expect(source.headers.AUTHORIZATION).toBe("Bearer diagnostic-auth");
    expect(source.nested[0].clientSecret).toBe("nested-secret");
  });

  it("redacts request and nested response logs while preserving transport and return values", async () => {
    const responsePayload = {
      ok: true,
      diagnostics: {
        authorization: "Bearer response-auth",
        nested: [
          {
            sessionCredential: "response-credential",
            safe: "response-visible",
          },
        ],
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const requestHeaders = {
      Authorization: "Bearer transport-auth",
      "x-SURVEY-eligibility-CREDENTIAL": "transport-credential",
      "X-Client-Secret": "transport-secret",
      "X-API-Key": "transport-api-key",
      "X-Custom-Token": "transport-token",
      "X-Tracking-Pin": "transport-pin",
      Cookie: "transport-cookie",
      "X-Session": "transport-session",
      "X-Trace-Id": "trace-visible",
    };

    const result = await realApiFetch<typeof responsePayload>(
      "https://api.example.test/redaction",
      {
        method: "GET",
        headers: requestHeaders,
        skipAuth: true,
        omitChatSessionId: true,
        omitCredentials: true,
        omitEntityToken: true,
        omitTenant: true,
      },
    );

    const fetchCall = fetchMock.mock.calls[0];
    const transportHeaders = fetchCall[1]?.headers as Record<string, string>;
    expect(transportHeaders).toMatchObject(requestHeaders);
    expect(requestHeaders.Authorization).toBe("Bearer transport-auth");

    const requestLog = consoleLog.mock.calls.find(
      ([label]) => label === "[apiFetch] Request",
    );
    const requestDiagnostics = requestLog?.[1] as {
      headers: Record<string, unknown>;
    };
    expect(requestDiagnostics.headers).toMatchObject({
      Authorization: REDACTED_API_LOG_VALUE,
      "x-SURVEY-eligibility-CREDENTIAL": REDACTED_API_LOG_VALUE,
      "X-Client-Secret": REDACTED_API_LOG_VALUE,
      "X-API-Key": REDACTED_API_LOG_VALUE,
      "X-Custom-Token": REDACTED_API_LOG_VALUE,
      "X-Tracking-Pin": REDACTED_API_LOG_VALUE,
      Cookie: REDACTED_API_LOG_VALUE,
      "X-Session": REDACTED_API_LOG_VALUE,
      "X-Trace-Id": "trace-visible",
    });

    const responseLog = consoleLog.mock.calls.find(
      ([label]) => label === "[apiFetch] Response",
    );
    const responseDiagnostics = responseLog?.[1] as {
      data: {
        diagnostics: {
          authorization: string;
          nested: Array<{ sessionCredential: string; safe: string }>;
        };
      };
    };
    expect(responseDiagnostics.data.diagnostics.authorization).toBe(
      REDACTED_API_LOG_VALUE,
    );
    expect(responseDiagnostics.data.diagnostics.nested[0]).toEqual({
      sessionCredential: REDACTED_API_LOG_VALUE,
      safe: "response-visible",
    });
    expect(result.diagnostics.authorization).toBe("Bearer response-auth");
    expect(result.diagnostics.nested[0].sessionCredential).toBe(
      "response-credential",
    );
  });
});
