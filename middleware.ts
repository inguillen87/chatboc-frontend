import { next, rewrite } from '@vercel/functions';

import { resolveFaroTdfDestination } from './src/vercelFaroRouting.js';

export default function middleware(request: Request) {
  const destination = resolveFaroTdfDestination(request.url);
  return destination ? rewrite(destination) : next();
}

export const config = {
  matcher: '/',
};
