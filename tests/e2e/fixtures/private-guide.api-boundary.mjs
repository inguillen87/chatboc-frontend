// The production read helper imports its sibling transport relatively. Keep
// this controlled browser fixture at the same API boundary as alias imports.
export const privateGuideApiBoundary = transportPath => ({
  name: 'private-guide-controlled-api-boundary',
  enforce: 'pre',
  resolveId(source, importer) {
    const normalizedImporter = importer?.replaceAll('\\', '/').split('?')[0];
    if (source === './api' && normalizedImporter?.endsWith('/src/utils/privateBackendRead.ts')) {
      return transportPath;
    }
  },
});
