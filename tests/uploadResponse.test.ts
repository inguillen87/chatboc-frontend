import { describe, it, expect } from 'vitest';

import { normalizeUploadResponse } from '../src/utils/uploadResponse';

describe('normalizeUploadResponse', () => {
  it('extracts usable URL when backend falls back to local storage', () => {
    const payload = {
      success: true,
      archivoAdjunto: {
        id: 268,
        original_filename: 'audio-grabado-123.webm',
        mime_type: 'audio/webm',
        size: 45892,
        local_path: '/opt/render/project/src/static/uploads/municipio_1/audio-grabado-123.webm',
        local_relative_path: 'static/uploads/municipio_1/audio-grabado-123.webm',
        storage_path: 'static/uploads/municipio_1/audio-grabado-123.webm',
      },
      analisisArchivo: {
        transcription: null,
      },
    };

    const normalized = normalizeUploadResponse(payload);

    expect(normalized.url).toBe('/static/uploads/municipio_1/audio-grabado-123.webm');
    expect(normalized.name).toBe('audio-grabado-123.webm');
    expect(normalized.mimeType).toBe('audio/webm');
    expect(normalized.size).toBe(45892);
  });

  it('normalizes plain string responses into accessible URLs', () => {
    const normalized = normalizeUploadResponse('/opt/render/project/src/static/uploads/demo/file.mp3');

    expect(normalized.url).toBe('/static/uploads/demo/file.mp3');
    expect(normalized.name).toBe('file.mp3');
  });

  it('converts Windows style fallback paths to web paths', () => {
    const payload = {
      result: {
        fallbackUrl: 'C:\\render\\project\\static\\uploads\\municipio_1\\voice-note.ogg',
        mime_type: 'audio/ogg',
      },
    };

    const normalized = normalizeUploadResponse(payload);
    expect(normalized.url).toBe('/static/uploads/municipio_1/voice-note.ogg');
    expect(normalized.mimeType).toBe('audio/ogg');
    expect(normalized.name).toBe('voice-note.ogg');
  });

  it('reconstructs URLs from entity folder hints when no direct path is provided', () => {
    const payload = {
      entity_folder: 'municipio_1',
      archivoAdjunto: {
        original_filename: 'denuncia.jpg',
      },
    };

    const normalized = normalizeUploadResponse(payload);

    expect(normalized.url).toBe('/static/uploads/municipio_1/denuncia.jpg');
    expect(normalized.name).toBe('denuncia.jpg');
  });

  it('uses explicit path prefixes to assemble accessible URLs', () => {
    const payload = {
      path_prefix: 'static/custom',
      file: {
        original_filename: 'doc.pdf',
      },
    };

    const normalized = normalizeUploadResponse(payload);

    expect(normalized.url).toBe('/static/custom/doc.pdf');
    expect(normalized.name).toBe('doc.pdf');
  });

  it('handles responses with a filePath key', () => {
    const payload = {
      data: {
        filePath: '/static/uploads/municipio_1/new-format.jpg',
        fileName: 'new-format.jpg',
        fileSize: 54321,
        mime_type: 'image/jpeg',
      },
    };

    const normalized = normalizeUploadResponse(payload);
    expect(normalized.url).toBe('/static/uploads/municipio_1/new-format.jpg');
    expect(normalized.name).toBe('new-format.jpg');
    expect(normalized.size).toBe(54321);
    expect(normalized.mimeType).toBe('image/jpeg');
  });
});
