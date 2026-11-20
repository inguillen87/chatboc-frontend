import contextlib
import copy
from io import BytesIO, StringIO
from pathlib import Path
import re
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import claude_approved_release as release

HEAD, BASE, MERGE, NEWER = "a" * 40, "b" * 40, "c" * 40, "d" * 40
PR = 2001
REPO = {"id": release.REPOSITORY_ID, "full_name": release.REPOSITORY, "default_branch": "main"}
NAMES = {"Synthetic acceptance"}


def approval(body=None, ident=11, at="2026-11-13T01:00:00Z"):
    return {"id": ident, "body": body or f"**aprobado** — head {HEAD}.\n\nRevisión completada.",
            "created_at": at, "updated_at": at,
            "issue_url": "https://api.github.com" + release.API_ROOT + f"/issues/{PR}",
            "user": {"id": 211186179, "login": "inguillen87", "type": "User"},
            "performed_via_github_app": {"id": 1236702, "slug": "claude"}}


def pr_value():
    return {"number": PR, "state": "open", "merged": False, "draft": False, "locked": False, "mergeable": True,
            "head": {"sha": HEAD, "ref": "claude/synthetic", "repo": copy.deepcopy(REPO)},
            "base": {"sha": BASE, "ref": "main", "repo": copy.deepcopy(REPO)}}


def workflow(filename="frontend-verification.yml", ident=301):
    workflow_id, name = release.WORKFLOWS[filename]
    return {"id": ident, "workflow_id": workflow_id, "name": name,
            "path": ".github/workflows/" + filename, "head_sha": HEAD,
            "status": "completed", "conclusion": "success", "run_attempt": 1, "event": "pull_request",
            "repository": copy.deepcopy(REPO), "head_repository": copy.deepcopy(REPO), "pull_requests": []}


def vercel_status(ident=901):
    return {"id": ident, "context": "Vercel", "state": "success", "description": "Deployment has completed",
            "target_url": "https://vercel.com/marcelos-projects-c26aa499/chatboc-frontend/SyntheticDeployment",
            "creator": {"id": 35613825, "login": "vercel[bot]", "type": "Bot"}}


class Clock:
    def __init__(self):
        self.value = 0

    def now(self):
        return self.value

    def sleep(self, seconds):
        self.value += seconds


class FakeAPI:
    """Stateful provider simulator: PUT can commit before losing its ACK."""
    def __init__(self):
        self.pr = pr_value()
        self.comments = [approval()]
        self.files = [{"filename": "src/synthetic.ts"}]
        self.runs = {name: [workflow(name, ident)] for name, ident in
                     [("frontend-verification.yml", 301), ("evaluation-access.yml", 302)]}
        self.jobs = {}
        for name, runs in self.runs.items():
            names = {"verify_once", *NAMES} if name == "frontend-verification.yml" else {"evaluation"}
            self.jobs[runs[0]["id"]] = [{"name": n, "run_id": runs[0]["id"], "head_sha": HEAD,
                                        "status": "completed", "conclusion": "success"} for n in names]
        self.checks = [{"id": 400, "name": "GitGuardian Security Checks", "head_sha": HEAD,
                        "status": "completed", "conclusion": "success", "app": {"id": 46505, "slug": "gitguardian"}}]
        self.head_statuses = [dict(vercel_status(), description="Canceled by Ignored Build Step")]
        self.production_statuses = [vercel_status()]
        self.base = BASE
        self.parents = [BASE, HEAD]
        self.comparison = {"status": "ahead", "ahead_by": 1, "behind_by": 0,
                           "base_commit": {"sha": MERGE}, "merge_base_commit": {"sha": MERGE}}
        self.calls = []
        self.counts = {}
        self.on_call = lambda *args: None
        self.lose_merge_ack = False
        self.merge_reject = None
        self.report_error = False

    def hit(self, kind, path):
        self.calls.append((kind, path))
        key = kind, path
        self.counts[key] = self.counts.get(key, 0) + 1
        self.on_call(kind, path, self.counts[key])

    def get(self, path):
        self.hit("GET", path)
        if path == f"/pulls/{PR}":
            return copy.deepcopy(self.pr)
        if path == "/git/ref/heads/main":
            return {"object": {"sha": self.base}}
        if path.startswith("/issues/comments/"):
            return copy.deepcopy(next(c for c in self.comments if c["id"] == int(path.rsplit("/", 1)[1])))
        if path.startswith("/actions/runs/"):
            return copy.deepcopy(next(r[0] for r in self.runs.values() if r[0]["id"] == int(path.rsplit("/", 1)[1])))
        if path.startswith("/check-runs/"):
            return copy.deepcopy(next(c for c in self.checks if c["id"] == int(path.rsplit("/", 1)[1])))
        if path == "/commits/" + MERGE:
            return {"sha": MERGE, "parents": [{"sha": sha} for sha in self.parents]}
        if path.startswith("/compare/"):
            return copy.deepcopy(self.comparison)
        raise AssertionError("Unexpected read: " + path)

    def pages(self, path, key=None):
        self.hit("PAGES", path)
        if path == f"/issues/{PR}/comments":
            return copy.deepcopy(self.comments)
        if path == f"/pulls/{PR}/files":
            return copy.deepcopy(self.files)
        if path.startswith("/actions/workflows/"):
            return copy.deepcopy(self.runs[path.split("/")[3]])
        if path.startswith("/actions/runs/"):
            return copy.deepcopy(self.jobs[int(path.split("/")[3])])
        if path.endswith("/check-runs?filter=latest"):
            return copy.deepcopy(self.checks)
        if path == "/commits/" + HEAD + "/statuses":
            return copy.deepcopy(self.head_statuses)
        if path.endswith("/statuses"):
            return copy.deepcopy(self.production_statuses)
        if path.endswith("/pulls"):
            return [copy.deepcopy(self.pr)]
        raise AssertionError("Unexpected collection: " + path)

    def request(self, method, path, body):
        self.hit(method, path)
        if method == "PUT":
            if path != release.API_ROOT + f"/pulls/{PR}/merge":
                raise AssertionError("Unexpected mutation target")
            if body != {"sha": HEAD, "merge_method": "merge"}:
                raise AssertionError("Expected SHA or normal merge missing")
            if self.merge_reject:
                raise release.GateError("github_http_error", self.merge_reject)
            self.pr.update(merged=True, state="closed", merge_commit_sha=MERGE)
            if self.lose_merge_ack:
                raise release.GateError("github_response_unavailable")
            return {"merged": True, "sha": MERGE}
        if self.report_error:
            raise release.GateError("github_http_error", 403)
        if method == "POST":
            if path != release.API_ROOT + f"/issues/{PR}/comments":
                raise AssertionError("Unexpected comment destination")
            self.comments.append({"id": 1000 + len(self.comments), "body": body["body"],
                                  "user": {"login": "github-actions[bot]", "type": "Bot"},
                                  "performed_via_github_app": {"id": 15368, "slug": "github-actions"}})
            return {"id": self.comments[-1]["id"]}
        if method == "PATCH":
            existing = next(c for c in self.comments if c["id"] == int(path.rsplit("/", 1)[1]))
            existing["body"] = body["body"]
            return {"id": existing["id"]}
        raise AssertionError("Unexpected write method")

    def mutations(self, method="PUT"):
        return [c for c in self.calls if c[0] in {"POST", "PUT", "PATCH"} and (method is None or c[0] == method)]


def coordinator(api, probe=None):
    clock = Clock()
    return release.Coordinator(api, NAMES, probe or (lambda: MERGE), clock.now, clock.sleep,
                               publication_timeout=2, interval=1)


class ApprovalTests(unittest.TestCase):
    def test_only_created_claude_owner_approval_for_full_current_sha_is_authority(self):
        chosen, reason = release.approval_for([approval()], HEAD)
        self.assertEqual((chosen.sha, reason), (HEAD, "approved"))
        for change in (
            {"performed_via_github_app": {"id": 1144995, "slug": "chatgpt-codex-connector"}},
            {"performed_via_github_app": {"id": 1236702, "slug": "not-claude"}},
            {"user": {"login": "inguillen87", "id": 99, "type": "User"}},
            {"user": {"login": "someone-else", "id": 211186179, "type": "User"}},
            {"user": {"login": "inguillen87", "id": 211186179, "type": "Bot"}},
            {"updated_at": "2026-11-13T01:01:00Z"},
        ):
            with self.subTest(change=change):
                c = approval(); c.update(change)
                self.assertIsNone(release.approval_for([c], HEAD)[0])

    def test_quotes_code_negations_conditional_or_stale_sha_cannot_approve(self):
        fence = chr(96) * 3
        for body in [f"> aprobado — head {HEAD}", f"{fence}\naprobado — head {HEAD}\n{fence}",
                     f"Dice Claude: aprobado — head {HEAD}", f"no aprobado — head {HEAD}",
                     f"aprobado — head {HEAD}\nNo lo publiques todavía.",
                     f"aprobado — head {HEAD}; $(touch /tmp/untrusted)",
                     f"aprobado — head {HEAD} si pasa CI", f"aprobado — head {BASE}"]:
            with self.subTest(body=body):
                self.assertIsNone(release.approval_for([approval(body)], HEAD)[0])

    def test_revocation_and_edited_approval_supersede_earlier_approval(self):
        c = approval(f"No aprobado — head {HEAD}", ident=12, at="2026-11-13T01:01:00Z")
        self.assertEqual(release.approval_for([approval(), c], HEAD)[1], "approval_revoked")
        c = approval(ident=12, at="2026-11-13T01:01:00Z")
        c["updated_at"] = "2026-11-13T01:02:00Z"
        self.assertEqual(release.approval_for([approval(), c], HEAD)[1], "approval_edited")

    def test_later_revocation_anywhere_in_real_claude_body_requires_new_clean_approval(self):
        for negative in ("No lo publiques todavía.", "No fusiones.", "No hagas merge.",
                         "Retiro la aprobación.", "> No lo publiques todavía."):
            with self.subTest(negative=negative):
                revoked = approval("Encontré un problema.\n" + negative, 12, "2026-11-13T01:01:00Z")
                api = FakeAPI(); api.comments.append(revoked)
                self.assertEqual(release.approval_for(api.comments, HEAD)[1], "approval_revoked")
                self.assertEqual(coordinator(api).execute(PR).reason, "approval_revoked")
                self.assertFalse(api.mutations())
                # A comment by a different app cannot revoke Claude's decision.
                impostor = copy.deepcopy(revoked)
                impostor["performed_via_github_app"]["id"] = 99
                self.assertIsNotNone(release.approval_for([approval(), impostor], HEAD)[0])
                clean = approval(ident=13, at="2026-11-13T01:02:00Z")
                self.assertEqual(release.approval_for([approval(), revoked, clean], HEAD)[0].id, 13)

    def test_unrelated_update_does_not_revoke_but_short_sha_requests_claude(self):
        update = approval("Terminé la revisión visual.", ident=12, at="2026-11-13T01:01:00Z")
        self.assertIsNotNone(release.approval_for([approval(), update], HEAD)[0])
        for body in ("aprobado — head " + HEAD[:9], "aprobado — head " + HEAD + ". Claude: PR propio revisado."):
            api = FakeAPI(); api.comments = [approval(body)]
            with contextlib.redirect_stdout(StringIO()):
                result = coordinator(api).execute(PR)
            self.assertEqual(result.state, "approval_required")
            self.assertEqual(len(api.mutations()), 0)
            self.assertIn("@claude", api.comments[-1]["body"])
            self.assertIn(HEAD, api.comments[-1]["body"])


class EventAndCITests(unittest.TestCase):
    def test_last_external_check_wakes_pre_ci_approval_in_either_order(self):
        for last in ("status", "check_run"):
            api = FakeAPI()
            api.checks[0].update(status="in_progress", conclusion=None)
            api.head_statuses[0].update(state="pending")
            completed = {"repository": REPO, "action": "completed", "workflow_run": {"id": 301}}
            self.assertEqual(release.discover(api, "workflow_run", completed), [PR])
            self.assertEqual(coordinator(api).execute(PR).state, "waiting_for_ci")
            self.assertFalse(api.mutations())
            # Both Actions workflows finished, but neither provider had finished.
            if last == "check_run":
                api.head_statuses[0]["state"] = "success"
                first = {"repository": REPO, "id": 901, "sha": HEAD, "context": "Vercel", "state": "success"}
                self.assertEqual(release.discover(api, "status", first), [PR])
                self.assertEqual(coordinator(api).execute(PR).state, "waiting_for_ci")
                api.checks[0].update(status="completed", conclusion="success")
                final = {"repository": REPO, "action": "completed", "check_run": {"id": 400}}
            else:
                api.checks[0].update(status="completed", conclusion="success")
                first = {"repository": REPO, "action": "completed", "check_run": {"id": 400}}
                self.assertEqual(release.discover(api, "check_run", first), [PR])
                self.assertEqual(coordinator(api).execute(PR).state, "waiting_for_ci")
                api.head_statuses[0]["state"] = "success"
                final = {"repository": REPO, "id": 901, "sha": HEAD, "context": "Vercel", "state": "success"}
            self.assertFalse(api.mutations())
            self.assertEqual(release.discover(api, last, final), [PR])
            self.assertFalse(api.mutations(None))  # discovery never writes, including comments
            with contextlib.redirect_stdout(StringIO()):
                self.assertEqual(coordinator(api).execute(PR).state, "production_confirmed")
            self.assertEqual(len(api.mutations()), 1)

    def test_vercel_preview_comment_check_can_finish_after_all_other_checks(self):
        api = FakeAPI()
        api.checks.append({"id": 401, "name": "Vercel Preview Comments", "head_sha": HEAD,
                           "app": {"id": 8329, "slug": "vercel"}, "status": "in_progress", "conclusion": None})
        self.assertEqual(coordinator(api).execute(PR).state, "waiting_for_ci")
        api.checks[-1].update(status="completed", conclusion="success")
        event = {"repository": REPO, "action": "completed", "check_run": {"id": 401}}
        self.assertEqual(release.discover(api, "check_run", event), [PR])
        self.assertFalse(api.mutations(None))
        with contextlib.redirect_stdout(StringIO()):
            self.assertEqual(coordinator(api).execute(PR).state, "production_confirmed")
        self.assertEqual(len(api.mutations()), 1)
        api.checks[-1]["name"] = "Untrusted Vercel check"
        self.assertEqual(release.discover(api, "check_run", event), [])

    def test_external_wakeup_requires_retrieved_provider_identity_and_matching_sha(self):
        api = FakeAPI()
        status_event = {"repository": REPO, "id": 901, "sha": HEAD, "context": "Vercel", "state": "success"}
        api.head_statuses[0]["creator"]["id"] = 99
        self.assertEqual(release.discover(api, "status", status_event), [])
        api = FakeAPI()
        api.head_statuses[0]["context"] = "Untrusted context"
        self.assertEqual(release.discover(api, "status", status_event), [])
        api = FakeAPI()
        api.checks[0]["app"] = {"id": 15368, "slug": "github-actions"}
        self.assertEqual(release.discover(api, "check_run",
            {"repository": REPO, "action": "completed", "check_run": {"id": 400}}), [])
        self.assertFalse(api.mutations())

    def test_vercel_merge_status_can_resume_publication_after_previous_timeout(self):
        api = FakeAPI()
        api.pr.update(merged=True, state="closed", merge_commit_sha=MERGE)
        event = {"repository": REPO, "id": 901, "sha": MERGE, "context": "Vercel", "state": "success"}
        self.assertEqual(release.discover(api, "status", event), [PR])
        with contextlib.redirect_stdout(StringIO()):
            self.assertEqual(coordinator(api).execute(PR).state, "production_confirmed")
        self.assertFalse(api.mutations())

    def test_ci_completion_resolves_empty_pull_requests_by_sha_and_reuses_approval(self):
        api = FakeAPI()
        event = {"repository": REPO, "action": "completed", "workflow_run": {"id": 301}}
        self.assertEqual(release.discover(api, "workflow_run", event), [PR])
        self.assertEqual(len(api.mutations()), 0)
        with contextlib.redirect_stdout(StringIO()):
            self.assertEqual(coordinator(api).execute(PR).state, "production_confirmed")

    def test_event_payload_cannot_forge_author_or_comment_destination(self):
        for mutation in [lambda c: c.update(performed_via_github_app={"id": 9, "slug": "claude"}),
                         lambda c: c.update(issue_url="https://api.github.com/repos/other/repo/issues/1")]:
            api = FakeAPI(); mutation(api.comments[0])
            event = {"repository": REPO, "action": "created",
                     "issue": {"number": PR, "pull_request": {"url": "observed-pr"}}, "comment": approval()}
            self.assertEqual(release.discover(api, "issue_comment", event), [])
        api = FakeAPI(); api.runs["frontend-verification.yml"][0]["path"] = ".github/workflows/untrusted.yml"
        self.assertEqual(release.discover(api, "workflow_run",
            {"repository": REPO, "action": "completed", "workflow_run": {"id": 301}}), [])

    def test_fork_wrong_base_draft_and_other_repository_are_ignored(self):
        for change in [lambda p: p["head"].update(repo={"id": 2, "full_name": "attacker/fork"}),
                       lambda p: p["base"].update(ref="release/unapproved"),
                       lambda p: p.update(draft=True), lambda p: p.update(locked=True)]:
            api = FakeAPI(); change(api.pr)
            self.assertEqual(coordinator(api).execute(PR).state, "ignored")
            self.assertFalse(api.mutations())

    def test_pending_failed_skipped_missing_or_wrong_attempt_ci_never_merges(self):
        scenarios = [
            lambda a: a.runs["frontend-verification.yml"][0].update(status="in_progress", conclusion=None),
            lambda a: a.runs["frontend-verification.yml"][0].update(conclusion="failure"),
            lambda a: a.runs["frontend-verification.yml"][0].update(head_sha=BASE),
            lambda a: a.runs["frontend-verification.yml"][0].update(run_attempt=0),
            lambda a: a.runs.update({"frontend-verification.yml": []}),
            lambda a: a.jobs[301].pop(),
            lambda a: a.jobs[301][0].update(conclusion="skipped"),
            lambda a: a.jobs[301][0].update(head_sha=BASE),
            lambda a: a.checks[0].update(conclusion="failure"),
            lambda a: a.checks[0].update(app={"id": 1, "slug": "gitguardian"}),
            lambda a: a.checks.append(dict(a.checks[0], id=401, status="in_progress", conclusion=None)),
            lambda a: a.head_statuses.append(dict(a.head_statuses[0], id=902, state="pending")),
        ]
        for mutate in scenarios:
            with self.subTest(mutate=mutate):
                api = FakeAPI(); mutate(api)
                self.assertEqual(coordinator(api).execute(PR).state, "waiting_for_ci")
                self.assertFalse(api.mutations())

    def test_evaluation_is_required_when_changed_files_trigger_it(self):
        for file in ({"filename": "vite.config.ts"},
                     {"filename": "src/ordinary.ts", "previous_filename": "src/features/evaluation/old.ts"}):
            api = FakeAPI(); api.files = [file]
            api.runs["evaluation-access.yml"] = []
            self.assertEqual(coordinator(api).execute(PR).reason, "ci_workflow_missing")
            self.assertFalse(api.mutations())


class RaceAndReleaseTests(unittest.TestCase):
    def execute(self, api, probe=None):
        with contextlib.redirect_stdout(StringIO()):
            return coordinator(api, probe).execute(PR)

    def test_stale_head_and_late_revocation_block_before_put(self):
        for mode in ("head", "approval"):
            api = FakeAPI()
            def hook(kind, path, count):
                if mode == "head" and kind == "GET" and path == f"/pulls/{PR}" and count == 3:
                    api.pr["head"]["sha"] = NEWER
                if mode == "approval" and kind == "PAGES" and path == f"/issues/{PR}/comments" and count == 3:
                    api.comments.append(approval("Encontré un problema.\nNo lo publiques todavía.", 12, "2026-11-13T01:01:00Z"))
            api.on_call = hook
            self.assertEqual(self.execute(api).state, "preflight_changed")
            self.assertFalse(api.mutations())

    def test_ci_rerun_started_after_first_success_is_not_ignored(self):
        api = FakeAPI()
        def hook(kind, path, count):
            if kind == "PAGES" and path.startswith("/actions/workflows/frontend-verification.yml/") and count == 2:
                api.runs["frontend-verification.yml"][0].update(status="queued", conclusion=None, run_attempt=2)
        api.on_call = hook
        self.assertEqual(self.execute(api).state, "waiting_for_ci")
        self.assertFalse(api.mutations())

    def test_base_change_before_put_and_after_put_are_distinct(self):
        api = FakeAPI()
        def hook(kind, path, count):
            if kind == "GET" and path == "/git/ref/heads/main" and count == 2:
                api.base = NEWER
        api.on_call = hook
        self.assertEqual(self.execute(api).reason, "base_changed")
        self.assertFalse(api.mutations())
        api = FakeAPI(); api.parents = [NEWER, HEAD]
        outcome = self.execute(api)
        self.assertEqual((outcome.state, outcome.merge, outcome.reason),
                         ("merged_publication_unconfirmed", MERGE, "merge_parents_changed"))
        self.assertEqual(len(api.mutations()), 1)

    def test_lost_merge_ack_reconciles_without_second_put(self):
        api = FakeAPI(); api.lose_merge_ack = True
        outcome = self.execute(api)
        self.assertEqual((outcome.state, outcome.merge), ("production_confirmed", MERGE))
        self.assertEqual(len(api.mutations()), 1)

    def test_known_merge_survives_readback_or_report_failure(self):
        api = FakeAPI()
        def hook(kind, path, count):
            if kind == "GET" and path == f"/pulls/{PR}" and count == 4:
                raise release.GateError("github_response_unavailable")
        api.on_call = hook
        outcome = self.execute(api)
        self.assertEqual((outcome.state, outcome.merge), ("merged_publication_unconfirmed", MERGE))
        api = FakeAPI(); api.report_error = True
        self.assertEqual(self.execute(api).state, "production_confirmed")
        self.assertEqual(len(api.mutations()), 1)
        self.assertEqual(len(api.mutations("POST")), 1)

    def test_server_merge_gate_is_never_bypassed(self):
        for status in (403, 405, 409, 422):
            api = FakeAPI(); api.merge_reject = status
            self.assertEqual(self.execute(api).state, "merge_rejected")
            self.assertEqual(len(api.mutations()), 1)
            self.assertFalse(api.pr["merged"])

    def test_publication_timeout_is_a_merged_unconfirmed_outcome(self):
        for probe in (lambda: None, lambda: BASE):
            api = FakeAPI(); api.comparison.update(status="behind", ahead_by=0, behind_by=1)
            outcome = self.execute(api, probe)
            self.assertEqual((outcome.state, outcome.merge), ("merged_publication_unconfirmed", MERGE))
            self.assertIn("publicación NO confirmada", api.comments[-1]["body"])
            self.assertEqual(len(api.mutations()), 1)

    def test_success_cancelled_preview_or_forged_vercel_identity_is_not_production(self):
        for mutate in [lambda s: s.update(description="Canceled by Ignored Build Step"),
                       lambda s: s["creator"].update(id=1),
                       lambda s: s["creator"].update(login="attacker"),
                       lambda s: s.update(target_url="https://vercel.com/other/project/deployment"),
                       lambda s: s.update(target_url="https://vercel.com.evil.test/marcelos-projects-c26aa499/chatboc-frontend/x")]:
            api = FakeAPI(); mutate(api.production_statuses[0])
            self.assertEqual(self.execute(api).state, "merged_publication_unconfirmed")

    def test_later_release_requires_verified_ancestry_and_signal_for_served_sha(self):
        api = FakeAPI()
        outcome = self.execute(api, lambda: NEWER)
        self.assertEqual((outcome.state, outcome.merge, outcome.served_sha), ("production_confirmed", MERGE, NEWER))
        self.assertIn(("PAGES", "/commits/" + NEWER + "/statuses"), api.calls)
        for mutate in [lambda c: c.update(status="diverged"), lambda c: c.update(behind_by=1),
                       lambda c: c["merge_base_commit"].update(sha=BASE), lambda c: c["base_commit"].update(sha=BASE)]:
            api = FakeAPI(); mutate(api.comparison)
            self.assertEqual(self.execute(api, lambda: NEWER).state, "merged_publication_unconfirmed")

    def test_duplicate_events_do_not_merge_or_comment_twice(self):
        api = FakeAPI()
        first = self.execute(api)
        second = self.execute(api)
        self.assertEqual(first, second)
        self.assertEqual(len(api.mutations()), 1)
        self.assertEqual(len(api.mutations("POST")), 1)
        self.assertEqual(len(api.mutations("PATCH")), 0)

    def test_forged_bot_confirmation_never_substitutes_for_live_evidence(self):
        api = FakeAPI()
        fake = release.Outcome("production_confirmed", PR, HEAD, MERGE, approval_id=11, vercel_status_id=901, served_sha=MERGE)
        api.comments.append({"id": 90, "body": release.report_body(fake), "user": {"login": "github-actions[bot]"},
                             "performed_via_github_app": {"id": 15368, "slug": "github-actions"}})
        outcome = self.execute(api, lambda: None)
        self.assertEqual(outcome.state, "merged_publication_unconfirmed")


class HTTPAndWorkflowBoundaryTests(unittest.TestCase):
    def test_policy_source_remains_main_for_all_wakeups_without_using_event_ref_as_code(self):
        context = {"GITHUB_ACTIONS": "true", "GITHUB_REPOSITORY": release.REPOSITORY,
                   "GITHUB_WORKFLOW_REF": release.REPOSITORY + "/" + release.WORKFLOW_FILE + "@refs/heads/main"}
        for event in ("issue_comment", "workflow_run", "status", "check_run"):
            for event_ref in ("", "refs/heads/main"):
                self.assertTrue(release.trusted_runtime(dict(context, GITHUB_EVENT_NAME=event, GITHUB_REF=event_ref)))
        for source in ("@refs/heads/feature", "@refs/pull/2001/merge"):
            self.assertFalse(release.trusted_runtime(dict(context, GITHUB_EVENT_NAME="status",
                GITHUB_WORKFLOW_REF=release.REPOSITORY + "/" + release.WORKFLOW_FILE + source)))
        self.assertFalse(release.trusted_runtime(dict(context, GITHUB_EVENT_NAME="pull_request")))

    def test_public_revision_rejects_redirects_non_html_duplicates_wrong_or_missing_sha(self):
        valid = f'<html><meta name="chatboc-build-revision" content="{MERGE}"></html>'.encode()
        self.assertEqual(release.revision_value(200, release.PUBLIC_URL, "text/html; charset=utf-8", valid), MERGE)
        for status, url, content_type, body in [
            (302, release.PUBLIC_URL, "text/html", valid),
            (200, "https://preview.vercel.app/", "text/html", valid),
            (200, "http://www.chatboc.ar/", "text/html", valid),
            (200, release.PUBLIC_URL, "application/json", valid),
            (200, release.PUBLIC_URL, "text/html", valid + valid),
            (200, release.PUBLIC_URL, "text/html", b'<meta name="chatboc-build-revision" content="short">'),
            (200, release.PUBLIC_URL, "text/html", f'<meta name="chatboc-build-revision" content="{MERGE}" content="{BASE}">'.encode()),
        ]:
            with self.subTest(url=url, body=body):
                self.assertIsNone(release.revision_value(status, url, content_type, body))

    def test_redirect_is_not_followed_and_public_http_never_receives_github_token(self):
        class Opener:
            def open(self, request, timeout):
                self.request = request
                raise HTTPError(request.full_url, 302, "redirect", {"Location": "https://outside.example/"}, BytesIO(b""))
        opener = Opener()
        with patch.object(release, "build_opener", return_value=opener):
            self.assertIsNone(release.public_revision())
        self.assertEqual(opener.request.full_url, release.PUBLIC_URL)
        self.assertIsNone(opener.request.get_header("Authorization"))
        self.assertIsNone(release.NoRedirect().redirect_request(None, None, 302, "", {}, "https://outside.example/"))

    def test_api_errors_do_not_expose_tokens_or_bodies(self):
        api = release.GitHub("synthetic-token")
        with patch.object(api._opener, "open", side_effect=HTTPError("https://api.github.com/", 403,
                          "synthetic-private-error", {}, BytesIO(b"synthetic-private-body"))):
            with self.assertRaises(release.GateError) as raised:
                api.get(f"/pulls/{PR}")
        self.assertEqual(str(raised.exception), "github_http_error")
        self.assertEqual(raised.exception.status, 403)
        with self.assertRaises(release.GateError):
            api.request("PUT", "/repos/another/repository/pulls/1/merge", {})

    def test_new_workflow_executes_only_trusted_main_and_has_no_pr_artifact_path(self):
        root = Path(__file__).resolve().parents[2]
        text = (root / release.WORKFLOW_FILE).read_text()
        self.assertEqual(text.count("ref: main\n"), 2)
        self.assertEqual(text.count("persist-credentials: false"), 2)
        self.assertIn("group: claude-approved-frontend-pr-" + "$" + "{{ matrix.pr }}", text)
        self.assertIn("cancel-in-progress: false", text)
        self.assertIn("types: [created]", text)
        self.assertIn("workflows: [Frontend verification, Isolated evaluation access]", text)
        commands = re.findall(r"(?m)^\s*run: (.+)$", text)
        self.assertEqual(commands, ["python3 scripts/ci/claude_approved_release.py discover",
                                   'python3 scripts/ci/claude_approved_release.py run --pr-number "$PR_NUMBER"'])
        for unsafe in ("pull_request_target", "download-artifact", "npm ", "head.ref", "head.sha", "secrets.", "workflow_dispatch"):
            self.assertNotIn(unsafe, text)
        discover_job, release_job = text.split("  release:\n", 1)
        self.assertNotIn(": write", discover_job)
        self.assertIn("contents: write", release_job)
        self.assertIn("pull-requests: write", release_job)


if __name__ == "__main__":
    unittest.main()
