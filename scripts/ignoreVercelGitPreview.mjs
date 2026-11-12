// Vercel ignoreCommand: 0 skips the build, 1 continues. Production is never skipped.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export const shouldIgnoreGitPreview = (env) => env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_PROVIDER === 'github';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ignored = shouldIgnoreGitPreview(process.env);
  console.log(ignored
    ? 'Automatic Git Preview omitted. Production deployment requires its normal verification gates.'
    : 'Build permitted. Existing backend-routing guards remain active.');
  process.exit(ignored ? 0 : 1);
}
