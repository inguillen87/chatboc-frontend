import {test} from 'vitest';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {shouldIgnoreGitPreview} from './ignoreVercelGitPreview.mjs';
test('only automatic GitHub previews are omitted',()=>{
 assert.equal(shouldIgnoreGitPreview({VERCEL_ENV:'preview',VERCEL_GIT_PROVIDER:'github'}),true);
 for(const env of [{},{VERCEL_ENV:'production',VERCEL_GIT_PROVIDER:'github'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development',VERCEL_GIT_PROVIDER:'github'}])assert.equal(shouldIgnoreGitPreview(env),false);
});
test('production exits with continue code even with Git metadata',()=>{
 const result=spawnSync(process.execPath,['scripts/ignoreVercelGitPreview.mjs'],{env:{...process.env,VERCEL_ENV:'production',VERCEL_GIT_PROVIDER:'github'},encoding:'utf8'});
 assert.equal(result.status,1);
});
test('automatic preview exits with ignore code without running the build',()=>{
 const result=spawnSync(process.execPath,['scripts/ignoreVercelGitPreview.mjs'],{env:{...process.env,VERCEL_ENV:'preview',VERCEL_GIT_PROVIDER:'github'},encoding:'utf8'});
 assert.equal(result.status,0);
});
