import copy
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest
import zipfile

from verified_build import FOCUSED, make_payload, verify_archive, install_verified


class VerifiedBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='chatboc-ci-contract-')
        self.root = Path(self.temp.name).resolve()
        self.assertTrue(self.root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
        self.addCleanup(self.temp.cleanup)
        self.repo = self.root / 'repo'
        (self.repo / 'dist/.vite').mkdir(parents=True)
        (self.repo / 'dist/index.html').write_text('<html>synthetic build</html>')
        (self.repo / 'dist/.vite/manifest.json').write_text('{}')
        self.evidence = self.root / 'evidence'
        self.evidence.mkdir()
        for name, paths in [('vitest.json', ['src/real.test.ts']), *FOCUSED.items()]:
            report = dict(success=True, numFailedTests=0, numFailedTestSuites=0,
                          numPassedTests=3, testResults=[dict(name='/checkout/' + p, status='passed') for p in paths])
            (self.evidence / name).write_text(json.dumps(report))
        (self.evidence / 'vitest.log').write_text('Native test footer, synthetic fixture only')
        self.identity = dict(repository='owner/frontend', head_repository='contributor/fork',
                             event='pull_request', ref='refs/pull/123/merge', run_id='100', run_attempt='2',
                             merge_sha='a' * 40, head_sha='b' * 40, base_sha='c' * 40,
                             tree_sha='d' * 40, lock_sha256='e' * 64)
        self.payload = self.root / 'payload'
        self.manifest_pin = make_payload(self.repo, self.evidence, self.payload, self.identity)
        self.archive = self.root / 'artifact.zip'
        self.write_archive()
        self.options = dict(identity=self.identity, artifact_id='456', downloaded_artifact_id='456',
                            artifact_digest=self.pin(self.archive), manifest_digest=self.manifest_pin,
                            common_result='success')

    @staticmethod
    def pin(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def write_archive(self, extra=None, override=None):
        with zipfile.ZipFile(self.archive, 'w') as bundle:
            for path in sorted(self.payload.rglob('*')):
                if path.is_file():
                    name = path.relative_to(self.payload).as_posix()
                    bundle.writestr(name, override[name] if override and name in override else path.read_bytes())
            if extra:
                bundle.writestr(*extra)

    def test_same_run_attempt_fork_and_merge_installs_only_after_verification(self):
        files = verify_archive(self.archive, **self.options)
        target = self.root / 'verified'
        install_verified(files, target)
        self.assertEqual((target / 'dist/index.html').read_bytes(), (self.repo / 'dist/index.html').read_bytes())
        self.assertEqual(len(files), 6)

    def test_other_source_run_attempt_lock_and_fork_are_rejected(self):
        changes = dict(repository='other/frontend', head_repository='other/fork', run_id='101',
                       run_attempt='1', merge_sha='f' * 40, head_sha='f' * 40,
                       base_sha='f' * 40, tree_sha='f' * 40, lock_sha256='f' * 64)
        for field, value in changes.items():
            with self.subTest(field=field):
                options = copy.deepcopy(self.options)
                options['identity'][field] = value
                with self.assertRaisesRegex(ValueError, 'artifact_identity_mismatch'):
                    verify_archive(self.archive, **options)
        self.assertFalse((self.root / 'verified').exists())

    def test_common_failure_cancel_or_skip_rejects_before_opening_artifact(self):
        for state in ('failure', 'cancelled', 'skipped', ''):
            with self.subTest(state=state):
                options = dict(self.options, common_result=state)
                with self.assertRaisesRegex(ValueError, 'shared_verification_not_successful'):
                    verify_archive(self.root / 'does-not-exist.zip', **options)

    def test_different_or_missing_artifact_id_is_rejected(self):
        for actual in ('457', '', '456,457'):
            with self.subTest(actual=actual), self.assertRaisesRegex(ValueError, 'artifact_id_mismatch'):
                verify_archive(self.archive, **dict(self.options, downloaded_artifact_id=actual))

    def test_zip_digest_mismatch_is_fatal(self):
        with self.assertRaisesRegex(ValueError, 'artifact_digest_mismatch'):
            verify_archive(self.archive, **dict(self.options, artifact_digest='0' * 64))

    def test_manifest_digest_mismatch_is_fatal(self):
        with self.assertRaisesRegex(ValueError, 'manifest_digest_mismatch'):
            verify_archive(self.archive, **dict(self.options, manifest_digest='0' * 64))

    def test_payload_digest_mismatch_is_fatal_even_when_zip_digest_is_updated(self):
        self.write_archive(override={'dist/index.html': b'tampered compiled config'})
        with self.assertRaisesRegex(ValueError, 'payload_file_digest_mismatch'):
            verify_archive(self.archive, **dict(self.options, artifact_digest=self.pin(self.archive)))

    def test_extra_file_cannot_be_consumed(self):
        self.write_archive(extra=('secret.env', 'synthetic fixture'))
        with self.assertRaisesRegex(ValueError, 'archive_inventory_mismatch'):
            verify_archive(self.archive, **dict(self.options, artifact_digest=self.pin(self.archive)))

    def test_path_traversal_is_rejected_before_extraction(self):
        self.write_archive(extra=('../outside.txt', 'synthetic fixture'))
        with self.assertRaisesRegex(ValueError, 'unsafe_archive_path'):
            verify_archive(self.archive, **dict(self.options, artifact_digest=self.pin(self.archive)))
        self.assertFalse((self.root / 'outside.txt').exists())

    def test_failed_or_empty_regression_report_cannot_be_packaged(self):
        (self.evidence / 'vitest.json').write_text(json.dumps(dict(success=True, numFailedTests=0,
            numFailedTestSuites=0, numPassedTests=0, testResults=[])))
        target = self.root / 'rejected-payload'
        with self.assertRaisesRegex(ValueError, 'regression_report_failed'):
            make_payload(self.repo, self.evidence, target, self.identity)
        self.assertFalse(target.exists())

    def test_focused_scope_cannot_be_replaced_by_other_tests(self):
        report = json.loads((self.evidence / 'catalog.json').read_text())
        report['testResults'][0]['name'] = '/checkout/src/unrelated.test.ts'
        (self.evidence / 'catalog.json').write_text(json.dumps(report))
        with self.assertRaisesRegex(ValueError, 'focused_report_scope_catalog'):
            make_payload(self.repo, self.evidence, self.root / 'rejected-payload', self.identity)


class WorkflowContractTests(unittest.TestCase):
    def test_blocked_common_result_cannot_pass_the_actual_first_shell_gate(self):
        repo = Path(__file__).resolve().parents[2]
        workflow = (repo / '.github/workflows/frontend-verification.yml').read_text()
        match = re.search(r'    - name: Require successful common verification\n      shell: bash\n      run: \|-\n(.*?)(?=    - )', workflow, re.S)
        self.assertIsNotNone(match)
        gate = '\n'.join(line[8:] for line in match[1].splitlines())
        bash = str(Path('C:/Program Files/Git/bin/bash.exe')) if os.name == 'nt' else shutil.which('bash')
        self.assertTrue(bash)
        for state in ('failure', 'cancelled', 'skipped', '', 'success'):
            with self.subTest(state=state):
                env = dict(os.environ, COMMON_RESULT=state, SHARED_ARTIFACT_ID='456',
                           SHARED_ARTIFACT_DIGEST='a' * 64, SHARED_MANIFEST_SHA256='b' * 64)
                result = subprocess.run([bash, '-e', '-o', 'pipefail', '-c', gate], env=env, capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, state == 'success')
                if state != 'success':
                    self.assertIn('acceptance did not execute', result.stdout)

    def test_one_common_execution_and_thirteen_complete_acceptances(self):
        repo = Path(__file__).resolve().parents[2]
        workflow = (repo / '.github/workflows/frontend-verification.yml').read_text()
        contract = json.loads((repo / 'scripts/ci/acceptance-contract.json').read_text())
        self.assertEqual(len(list((repo / '.github/workflows').glob('*.yml'))), 1)
        self.assertEqual(workflow.count('npm test --'), 1)
        self.assertEqual(workflow.count('run: npm run typecheck'), 1)
        self.assertEqual(workflow.count('run: npm run build'), 1)
        self.assertEqual(workflow.count('run: npm ci --ignore-scripts --no-audit --no-fund'), 13)
        self.assertEqual(len(contract), 13)
        expected_names = {'Catalog import UX and safe errors', 'CRM persistent follow-up',
            'Geographic analytics workspace', 'Omnichannel inbox workspace', 'Operations workspace and scoped reads',
            'Order lifecycle and scoped operations', 'Organization brand and URLs', 'Production profile layout',
            'Section recovery and preserved workspace', 'Application startup performance',
            'SuperAdmin commercial follow-up', 'Survey cards production verification', 'Unified organization login'}
        self.assertEqual({row['name'] for row in contract}, expected_names)
        blocks = re.split(r'(?m)^  ([a-z_]+):\s*$', workflow.split('jobs:\n', 1)[1])
        jobs = dict(zip(blocks[1::2], blocks[2::2]))
        self.assertEqual(set(jobs), {'verify_once', *(row['job'] for row in contract)})
        commands = []
        for row in contract:
            job = jobs[row['job']]
            self.assertIn('    name: ' + row['name'] + '\n', job)
            self.assertIn('    needs: verify_once\n    if: always()', job)
            self.assertLess(job.index('Require successful common verification'), job.index('actions/checkout@'))
            self.assertIn('exit 1', job[:job.index('actions/checkout@')])
            self.assertIn('artifact-ids: ${{ needs.verify_once.outputs.artifact_id }}', job)
            self.assertIn('skip-decompress: true', job)
            self.assertIn('digest-mismatch: error', job)
            self.assertIn('ref: ${{ github.sha }}', job)
            self.assertNotIn('github-token:', job)
            self.assertNotIn('run-id:', job)
            self.assertNotIn('repository:', job)
            commands += row['browser_commands']
            for command in row['browser_commands']:
                self.assertIn('run: ' + command, job)
                self.assertLess(job.index('verified_build.py verify'), job.index('run: ' + command))
        self.assertEqual(len(commands), 21)  # Twenty existing commands plus the new alert contrast fixture.
        self.assertEqual(len(set(commands)), 21)
        original_browser_commands = {
            'node tests/followup-workspace.browser.mjs', 'node tests/crm-history.browser.mjs',
            'node tests/crm-directory.browser.mjs', 'node tests/geo-workspace.browser.mjs',
            'node tests/inbox-workspace.browser.mjs', 'node tests/operations-workspace.browser.mjs',
            'node tests/order-lifecycle.browser.mjs', 'node tests/checkout-session.browser.mjs',
            'node tests/cart-session.browser.mjs', 'node tests/organization-presence.browser.mjs',
            'node tests/production-profile.browser.mjs', 'node tests/section-recovery.browser.mjs',
            'node tests/startup-performance.browser.mjs',
            'npx playwright test --config=playwright.pwa.config.ts --reporter=list,json',
            'node tests/commercial-insights.browser.mjs', 'node tests/survey-card-production.browser.mjs',
            'node tests/private-navigation.browser.mjs', 'node tests/private-guide.browser.mjs',
            'node tests/guide-control.browser.mjs', 'node tests/institutional-assistant.browser.mjs',
        }
        self.assertEqual(set(commands), original_browser_commands | {'node tests/alert-contrast.browser.mjs'})
        self.assertEqual(workflow.count('run: node scripts/startupGraph.mjs'), 1)
        previous_evidence_names = {'crm-followup-evidence', 'geographic-workspace-evidence',
            'inbox-workspace-evidence', 'operations-live-evidence', 'order-lifecycle-evidence',
            'organization-presence-evidence', 'section-recovery-evidence', 'startup-performance-evidence',
            'commercial-insights-evidence', 'survey-card-production-evidence', 'unified-login-evidence'}
        self.assertTrue(previous_evidence_names <= set(re.findall(r'^        name: ([^\n]+)$', workflow, re.M)))
        section = jobs['section_recovery']
        self.assertLess(section.index('run: node tests/section-recovery.browser.mjs'),
                        section.index('run: node tests/alert-contrast.browser.mjs'))
        self.assertIn('.vercel/alert-contrast-evidence/', section)
        for forbidden in ('workflow_run:', 'workflow_call:', 'pull_request_target:', 'workflow_dispatch:', 'secrets:', ': write'):
            self.assertNotIn(forbidden, workflow)
        for action in re.findall(r'uses: ([^\n]+)', workflow):
            self.assertRegex(action, r'^[A-Za-z0-9-]+/[A-Za-z0-9-]+@[a-f0-9]{40}$')


if __name__ == '__main__':
    unittest.main()
