import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "@/utils/api";
import {
  resolveBoundChatAttachmentUploadContext,
  uploadChatAttachment,
} from "./uploadChatAttachment";

const DIRECT_CONTRACT = "chat.attachment.direct.v1";
const normalizedMime = (file: File) => file.type.split(";", 1)[0].trim().toLowerCase();

const createFileForm = (file: File) => () => {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
};

const prepareResponse = (file: File, overrides: Record<string, unknown> = {}) => ({
  ok: true,
  contract_version: DIRECT_CONTRACT,
  operation: "prepare_direct_upload",
  upload_id: "upload-123",
  intent_token: "intent-token-123",
  upload: {
    method: "PUT",
    url: "https://objects.example.test/signed-upload",
    headers: { "Content-Type": normalizedMime(file) },
    expires_in_seconds: 300,
  },
  constraints: {
    max_file_bytes: 15 * 1024 * 1024,
    exact_size_required: true,
  },
  request_id: "request-prepare",
  ...overrides,
});

describe("uploadChatAttachment direct R2 transport", () => {
  const apiFetchMock = vi.mocked(apiFetch);
  const fetchMock = vi.fn();

  beforeEach(() => {
    apiFetchMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails closed when the active tenant and signed bootstrap tenant disagree", () => {
    expect(
      resolveBoundChatAttachmentUploadContext("tenant-active", {
        tenantSlug: "tenant-stale",
        demoSessionId: "signed-stale-demo",
        chatSessionId: "sid_stale",
      }),
    ).toEqual({
      tenantSlug: "tenant-active",
      demoSessionId: null,
      chatSessionId: null,
    });
  });

  it("normalizes a missing tenant to undefined so widget upload cannot reuse stale storage", async () => {
    const file = new File(["pdf"], "nota.pdf", { type: "application/pdf" });
    apiFetchMock.mockResolvedValueOnce({ ok: true });

    await uploadChatAttachment(
      "/legacy/upload",
      createFileForm(file),
      { tenantSlug: null },
    );

    expect(apiFetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        isWidgetRequest: true,
        tenantSlug: undefined,
        persistTenantSlug: false,
      }),
    );
  });

  it("prepares, uploads raw bytes without Chatboc credentials, completes, and preserves attachmentInfo", async () => {
    const file = new File(["pdf-content"], "boleta.pdf", { type: "application/pdf" });
    const completedPayload = {
      ok: true,
      contract_version: DIRECT_CONTRACT,
      operation: "complete_direct_upload",
      idempotent: false,
      attachmentInfo: {
        url: "https://cdn.example.test/boleta.pdf",
        name: "boleta.pdf",
        mimeType: "application/pdf",
        size: file.size,
      },
    };

    apiFetchMock
      .mockResolvedValueOnce(prepareResponse(file))
      .mockResolvedValueOnce(completedPayload);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await uploadChatAttachment<typeof completedPayload>(
      "/archivos/upload/chat_attachment",
      createFileForm(file),
      {
        tenantSlug: "municipio",
        demoSessionId: "signed-demo-session",
        chatSessionId: "sid_demo_session",
      },
    );

    expect(result).toBe(completedPayload);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: {
          operation: "prepare_direct_upload",
          filename: "boleta.pdf",
          mime_type: "application/pdf",
          size_bytes: file.size,
        },
        isWidgetRequest: true,
        tenantSlug: "municipio",
        persistTenantSlug: false,
        chatSessionId: "sid_demo_session",
        headers: { "X-Demo-Session-Id": "signed-demo-session" },
      }),
    );
    expect(apiFetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: {
          operation: "complete_direct_upload",
          intent_token: "intent-token-123",
        },
        isWidgetRequest: true,
        tenantSlug: "municipio",
        persistTenantSlug: false,
        chatSessionId: "sid_demo_session",
        headers: { "X-Demo-Session-Id": "signed-demo-session" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadUrl).toBe("https://objects.example.test/signed-upload");
    expect(uploadInit).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: file,
        credentials: "omit",
        mode: "cors",
        referrerPolicy: "no-referrer",
      }),
    );
    const headers = uploadInit.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/pdf");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("Cookie")).toBe(false);
  });

  it("uses multipart compatibility only for a small file when the old endpoint asks for file", async () => {
    const file = new File(["small"], "foto.png", { type: "image/png" });
    const createFormData = vi.fn(createFileForm(file));
    const legacyPayload = {
      ok: true,
      attachmentInfo: { url: "https://cdn.example.test/foto.png", name: "foto.png" },
    };

    apiFetchMock
      .mockRejectedValueOnce(
        new ApiError("No se encontro el campo de archivo file", 400, {
          error: "No se encontro el campo de archivo file",
        }),
      )
      .mockResolvedValueOnce(legacyPayload);

    const result = await uploadChatAttachment<typeof legacyPayload>(
      "/archivos/upload/chat_attachment",
      createFormData,
    );

    expect(result).toBe(legacyPayload);
    expect(createFormData).toHaveBeenCalledTimes(2);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[1]?.[1]?.body).toBeInstanceOf(FormData);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the normalized signed MIME literally for recorder blobs with codec parameters", async () => {
    const file = new File(["audio"], "mensaje.webm", {
      type: "audio/webm;codecs=opus",
    });
    const completedPayload = {
      ok: true,
      attachmentInfo: { url: "https://cdn.example.test/mensaje.webm" },
    };
    apiFetchMock
      .mockResolvedValueOnce(prepareResponse(file))
      .mockResolvedValueOnce(completedPayload);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await uploadChatAttachment(
      "/archivos/upload/chat_attachment",
      createFileForm(file),
    );

    expect(apiFetchMock.mock.calls[0]?.[1]?.body).toEqual(
      expect.objectContaining({ mime_type: "audio/webm" }),
    );
    const uploadInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((uploadInit.headers as Headers).get("Content-Type")).toBe("audio/webm");
  });

  it("keeps the /api alias compatibility for both prepare and complete", async () => {
    const file = new File(["pdf"], "nota.pdf", { type: "application/pdf" });
    const routeMissing = new ApiError("Not found", 404, { code: "not_found" });
    const completedPayload = {
      ok: true,
      attachmentInfo: { url: "https://cdn.example.test/nota.pdf" },
    };
    apiFetchMock
      .mockRejectedValueOnce(routeMissing)
      .mockResolvedValueOnce(prepareResponse(file))
      .mockRejectedValueOnce(routeMissing)
      .mockResolvedValueOnce(completedPayload);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const result = await uploadChatAttachment(
      "/archivos/upload/chat_attachment",
      createFileForm(file),
    );

    expect(result).toBe(completedPayload);
    expect(apiFetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/archivos/upload/chat_attachment",
      "/api/archivos/upload/chat_attachment",
      "/archivos/upload/chat_attachment",
      "/api/archivos/upload/chat_attachment",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never sends a large file through the multipart compatibility path", async () => {
    const file = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "video.mp4",
      { type: "video/mp4" },
    );
    const createFormData = vi.fn(createFileForm(file));
    const compatibilityError = new ApiError("Direct upload unavailable", 501, {
      code: "not_implemented",
    });
    apiFetchMock
      .mockRejectedValueOnce(compatibilityError)
      .mockRejectedValueOnce(compatibilityError);

    await expect(
      uploadChatAttachment("/archivos/upload/chat_attachment", createFormData),
    ).rejects.toBe(compatibilityError);

    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls[1]?.[0]).toBe("/api/archivos/upload/chat_attachment");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a large file without MIME instead of crossing the Functions multipart limit", async () => {
    const file = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "archivo.bin",
      { type: "" },
    );
    const createFormData = vi.fn(createFileForm(file));

    await expect(
      uploadChatAttachment("/archivos/upload/chat_attachment", createFormData),
    ).rejects.toMatchObject({
      status: 400,
      body: { code: "direct_upload_metadata_required" },
    });

    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back to multipart after object storage rejects the signed PUT", async () => {
    const file = new File(["image"], "foto.webp", { type: "image/webp" });
    const createFormData = vi.fn(createFileForm(file));
    apiFetchMock.mockResolvedValueOnce(prepareResponse(file));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));

    await expect(
      uploadChatAttachment("/archivos/upload/chat_attachment", createFormData),
    ).rejects.toMatchObject({
      status: 404,
      body: { code: "direct_upload_failed", phase: "put_object" },
    });

    expect(createFormData).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects credential-bearing signed headers before sending the file", async () => {
    const file = new File(["image"], "foto.jpg", { type: "image/jpeg" });
    apiFetchMock.mockResolvedValueOnce(
      prepareResponse(file, {
        upload: {
          method: "PUT",
          url: "https://objects.example.test/signed-upload",
          headers: {
            "Content-Type": "image/jpeg",
            Authorization: "Bearer must-not-leave-chatboc",
          },
          expires_in_seconds: 300,
        },
      }),
    );

    await expect(
      uploadChatAttachment("/archivos/upload/chat_attachment", createFileForm(file)),
    ).rejects.toMatchObject({
      status: 502,
      body: { code: "invalid_direct_upload_contract" },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
