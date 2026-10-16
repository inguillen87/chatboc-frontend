"""Package one PR verification and verify its immutable artifact before use."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import zipfile

SCHEMA = 'chatboc.ci.verified-build.v1'
REPORTS = ('vitest.json', 'vitest.log', 'catalog.json', 'guards.json')
FOCUSED = {
    'catalog.json': ('src/utils/catalogImportError.test.ts', 'src/components/catalog/ImportWizard.error.test.tsx'),
    'guards.json': ('scripts/ignoreVercelGitPreview.test.mjs', 'scripts/guardVercelPreviewRewrites.test.mjs', 'scripts/verifyVercelProductionBuild.test.mjs'),
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def regular_files(folder):
    require(folder.is_dir() and not folder.is_symlink(), 'missing_payload_directory')
    result = {}
    for path in sorted(folder.rglob('*')):
        require(not path.is_symlink(), 'payload_symlink')
        if path.is_file():
            result[path.relative_to(folder).as_posix()] = path.read_bytes()
    return result


def validate_identity(value):
    fields = ('repository', 'head_repository', 'event', 'ref', 'run_id', 'run_attempt',
              'merge_sha', 'head_sha', 'base_sha', 'tree_sha', 'lock_sha256')
    require(set(value) == set(fields) and all(isinstance(value[k], str) and value[k] for k in fields),
            'identity_fields_invalid')
    require(value.get('event') == 'pull_request', 'event_mismatch')
    for key in ('repository', 'head_repository'):
        require(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', value.get(key, '')), key + '_invalid')
    for key in ('merge_sha', 'head_sha', 'base_sha', 'tree_sha'):
        require(re.fullmatch(r'[a-f0-9]{40}', value.get(key, '')), key + '_invalid')
    require(re.fullmatch(r'[a-f0-9]{64}', value.get('lock_sha256', '')), 'lock_invalid')
    require(re.fullmatch(r'refs/pull/[1-9][0-9]*/merge', value.get('ref', '')), 'merge_ref_invalid')
    for key in ('run_id', 'run_attempt'):
        require(re.fullmatch(r'[1-9][0-9]*', value.get(key, '')), key + '_invalid')


def current_identity(repo, env):
    git = lambda ref: subprocess.check_output(['git', '-C', str(repo), 'rev-parse', ref], text=True).strip()
    checkout = git('HEAD')
    require(checkout == env.get('GITHUB_SHA'), 'checkout_merge_mismatch')
    value = dict(repository=env.get('GITHUB_REPOSITORY'), head_repository=env.get('CI_HEAD_REPOSITORY'),
                 event=env.get('GITHUB_EVENT_NAME'), ref=env.get('GITHUB_REF'),
                 run_id=env.get('GITHUB_RUN_ID'), run_attempt=env.get('GITHUB_RUN_ATTEMPT'),
                 merge_sha=checkout, head_sha=env.get('CI_HEAD_SHA'), base_sha=env.get('CI_BASE_SHA'),
                 tree_sha=git('HEAD^{tree}'), lock_sha256=digest((repo / 'package-lock.json').read_bytes()))
    validate_identity(value)
    return value


def validate_reports(files):
    for name in ('vitest.json', 'catalog.json', 'guards.json'):
        report = json.loads(files['evidence/' + name])
        require(report.get('success') is True and report.get('numFailedTests') == 0
                and report.get('numFailedTestSuites') == 0 and report.get('numPassedTests', 0) > 0
                and bool(report.get('testResults')), 'regression_report_failed_' + name)
        if name in FOCUSED:
            paths = [str(row['name']).replace('\\', '/') for row in report['testResults']]
            require(len(paths) == len(FOCUSED[name]) and all(
                sum(path.endswith('/' + wanted) or path == wanted for path in paths) == 1
                for wanted in FOCUSED[name]), 'focused_report_scope_' + name)


def make_payload(repo, evidence, destination, identity):
    validate_identity(identity)
    require(not destination.exists(), 'payload_destination_exists')
    files = {'dist/' + name: raw for name, raw in regular_files(repo / 'dist').items()}
    require('dist/index.html' in files and 'dist/.vite/manifest.json' in files, 'incomplete_dist')
    for name in REPORTS:
        files['evidence/' + name] = (evidence / name).read_bytes()
    validate_reports(files)
    manifest = dict(schema=SCHEMA, identity=identity,
                    files={name: digest(raw) for name, raw in sorted(files.items())})
    raw_manifest = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    for name, raw in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    (destination / 'manifest.json').write_bytes(raw_manifest)
    return digest(raw_manifest)


def verify_archive(archive, *, identity, artifact_id, downloaded_artifact_id, artifact_digest,
                   manifest_digest, common_result):
    # Reject a blocked common job before opening any downloaded artifact.
    require(common_result == 'success', 'shared_verification_not_successful')
    require(re.fullmatch(r'[1-9][0-9]*', artifact_id or '')
            and downloaded_artifact_id == artifact_id, 'artifact_id_mismatch')
    for pin in (artifact_digest, manifest_digest):
        require(re.fullmatch(r'[a-f0-9]{64}', pin or ''), 'digest_invalid')
    require(digest(archive.read_bytes()) == artifact_digest, 'artifact_digest_mismatch')
    validate_identity(identity)
    with zipfile.ZipFile(archive) as bundle:
        infos = bundle.infolist()
        names = [info.filename for info in infos if not info.is_dir()]
        require(len(names) == len(set(names)), 'duplicate_archive_path')
        for info in infos:
            path = PurePosixPath(info.filename)
            require(not path.is_absolute() and '..' not in path.parts and '\\' not in info.filename
                    and ':' not in info.filename and str(path) == info.filename.rstrip('/'), 'unsafe_archive_path')
            require(not stat.S_ISLNK(info.external_attr >> 16), 'archive_symlink')
        require('manifest.json' in names, 'manifest_missing')
        raw_manifest = bundle.read('manifest.json')
        require(digest(raw_manifest) == manifest_digest, 'manifest_digest_mismatch')
        manifest = json.loads(raw_manifest)
        require(manifest.get('schema') == SCHEMA, 'manifest_schema')
        require(manifest.get('identity') == identity, 'artifact_identity_mismatch')
        expected = manifest.get('files')
        require(isinstance(expected, dict) and set(names) == {'manifest.json', *expected}, 'archive_inventory_mismatch')
        require('dist/index.html' in expected and 'dist/.vite/manifest.json' in expected
                and all('evidence/' + name in expected for name in REPORTS), 'incomplete_artifact')
        require(all(name.startswith('dist/') or name in {'evidence/' + x for x in REPORTS}
                    for name in expected), 'unexpected_artifact_file')
        files = {}
        for name, pin in expected.items():
            require(re.fullmatch(r'[a-f0-9]{64}', pin), 'file_digest_invalid')
            raw = bundle.read(name)
            require(digest(raw) == pin, 'payload_file_digest_mismatch')
            files[name] = raw
    validate_reports(files)
    return files


def install_verified(files, destination):
    require(not destination.exists(), 'verified_destination_exists')
    # All ZIP, identity, report and file checks finished before the first write.
    for name, raw in files.items():
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=('package', 'verify'))
    parser.add_argument('--repo', type=Path, default=Path.cwd())
    parser.add_argument('--evidence', type=Path, default=Path('.ci/common-evidence'))
    parser.add_argument('--payload', type=Path, default=Path('.ci/shared-payload'))
    parser.add_argument('--download', type=Path, default=Path('.ci/download'))
    parser.add_argument('--verified', type=Path, default=Path('.ci/verified'))
    parser.add_argument('--legacy-evidence', type=Path)
    args = parser.parse_args()
    identity = current_identity(args.repo, os.environ)
    if args.mode == 'package':
        pin = make_payload(args.repo, args.evidence, args.payload, identity)
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write('manifest_sha256=' + pin + '\n')
        print(json.dumps(dict(merge_sha=identity['merge_sha'], manifest_sha256=pin)))
        return
    require(os.environ.get('COMMON_RESULT') == 'success', 'shared_verification_not_successful')
    archives = [p for p in args.download.rglob('*') if p.is_file()]
    require(len(archives) == 1 and not archives[0].is_symlink(), 'single_downloaded_archive_required')
    files = verify_archive(archives[0], identity=identity,
                           artifact_id=os.environ.get('SHARED_ARTIFACT_ID'),
                           downloaded_artifact_id=os.environ.get('DOWNLOADED_ARTIFACT_ID'),
                           artifact_digest=os.environ.get('SHARED_ARTIFACT_DIGEST'),
                           manifest_digest=os.environ.get('SHARED_MANIFEST_SHA256'),
                           common_result=os.environ.get('COMMON_RESULT'))
    require(not (args.repo / 'dist').exists(), 'consumer_dist_already_exists')
    install_verified(files, args.verified)
    shutil.copytree(args.verified / 'dist', args.repo / 'dist')
    if args.legacy_evidence:
        args.legacy_evidence.mkdir(parents=True, exist_ok=True)
        for name in ('vitest.json', 'vitest.log'):
            shutil.copyfile(args.verified / 'evidence' / name, args.legacy_evidence / name)
        (args.legacy_evidence / 'shared-verification.json').write_text(json.dumps(dict(
            schema=SCHEMA, identity=identity, artifact_id=os.environ['SHARED_ARTIFACT_ID'],
            artifact_digest=os.environ['SHARED_ARTIFACT_DIGEST'], execution_count=1), indent=2) + '\n')
    print(json.dumps(dict(verified=True, artifact_id=os.environ['SHARED_ARTIFACT_ID'],
                         merge_sha=identity['merge_sha'], execution_count=1)))


if __name__ == '__main__':
    main()
