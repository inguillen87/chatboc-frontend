"""Narrow, event-driven frontend release coordinator, executed from trusted main.

Only GitHub metadata is read from a PR. No PR checkout, package installation,
artifact, comment text as code, Vercel credential, force merge or settings API.
CI completion re-reads previously created approvals, including approvals made
while CI was running. A full, current SHA is required in a fresh Claude comment:
the first line must be exactly `aprobado — head <full SHA>` (bold/backticks and
a final period are allowed); explanations start on the next line. An explicit
negative anywhere in a later real Claude comment revokes the approval, even in
a quote. A new clean approval is required to unblock this conservative policy.

GITHUB_TOKEN does not cause push/closed-PR CI to run. All required PR evidence is
checked BEFORE the merge; production is verified separately through Vercel's
authenticated GitHub status author AND the public www build revision. A merge
and a confirmed publication are deliberately different outcomes.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
from datetime import datetime
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

REPOSITORY = "inguillen87/chatboc-frontend"
REPOSITORY_ID = 1012483221
API_ROOT = "/repos/" + REPOSITORY
MAIN = "main"
PUBLIC_URL = "https://www.chatboc.ar/"
WORKFLOW_FILE = ".github/workflows/claude-approved-production.yml"
CLAUDE_APP = (1236702, "claude")
CLAUDE_OWNER = (211186179, "inguillen87")
ACTIONS_APP = (15368, "github-actions")
VERCEL_BOT = (35613825, "vercel[bot]")
VERCEL_URL_PREFIX = "/marcelos-projects-c26aa499/chatboc-frontend/"
EXTERNAL_CHECKS = {"GitGuardian Security Checks": (46505, "gitguardian"),
                   "Vercel Preview Comments": (8329, "vercel")}
WORKFLOWS = {
    "frontend-verification.yml": (385904297, "Frontend verification"),
    "evaluation-access.yml": (361809072, "Isolated evaluation access"),
}
EVALUATION_PREFIXES = ("server/evaluation/", "src/features/evaluation/", "demo/evaluation/", "tests/evaluation/")
EVALUATION_FILES = {"scripts/packageEvaluation.mjs", "vite.config.ts", ".github/workflows/evaluation-access.yml"}
SHA = re.compile(r"[0-9a-f]{40}\Z")
APPROVED = re.compile(r"(?:\*\*aprobado\*\*|aprobado)\s*[—-]\s*head\s+`?([0-9a-f]{40})`?\.?\s*\Z", re.I)
POSITIVE_START = re.compile(r"^(?:\*\*aprobado\*\*|aprobado)(?:\s|[.—:-]|$)", re.I)
NEGATIVE = re.compile(
    r"\b(?:no|nunca|sin)\s+(?:(?:lo|la|se|est[aá]|queda|debe|deben|puede|pueden|hagas|hagan|hacer)\s+){0,3}"
    r"(?:aprob\w*|aprueb\w*|fusion\w*|publi\w*|merge\w*)\b"
    r"|\b(?:revoco|retiro)\s+(?:(?:mi|la)\s+)?aprobaci[oó]n\b", re.I)
MAX_PAGES = 20
MAX_BODY = 1_048_576


class GateError(Exception):
    """Only fixed reason codes may cross the logging boundary."""
    def __init__(self, code: str, status: int | None = None):
        super().__init__(code)
        self.code, self.status = code, status


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHub:
    def __init__(self, token: str):
        if not token:
            raise GateError("github_token_missing")
        self._token = token
        self._opener = build_opener(NoRedirect())

    def request(self, method: str, path: str, body=None):
        if not path.startswith(API_ROOT + "/") or method not in {"GET", "POST", "PUT", "PATCH"}:
            raise GateError("github_request_scope_invalid")
        headers = {"Authorization": "Bearer " + self._token, "Accept": "application/vnd.github+json",
                   "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "chatboc-approved-release"}
        data = None if body is None else json.dumps(body).encode("utf-8")
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = Request("https://api.github.com" + path, data=data, headers=headers, method=method)
        try:
            with self._opener.open(request, timeout=15) as response:
                raw = response.read(MAX_BODY + 1)
                if len(raw) > MAX_BODY or response.geturl() != request.full_url:
                    raise GateError("github_response_invalid")
                return json.loads(raw)
        except HTTPError as exc:
            raise GateError("github_http_error", exc.code) from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise GateError("github_response_unavailable") from None

    def get(self, suffix: str):
        return self.request("GET", API_ROOT + suffix)

    def pages(self, suffix: str, key: str | None = None):
        rows = []
        for page in range(1, MAX_PAGES + 1):
            separator = "&" if "?" in suffix else "?"
            result = self.get(suffix + separator + urlencode({"per_page": 100, "page": page}))
            items = result.get(key) if key else result
            if not isinstance(items, list):
                raise GateError("github_collection_invalid")
            rows.extend(items)
            if len(items) < 100:
                if key and isinstance(result.get("total_count"), int) and len(rows) != result["total_count"]:
                    raise GateError("github_collection_incomplete")
                return rows
        raise GateError("github_collection_limit")


def positive_int(value):
    return type(value) is int and value > 0


def valid_sha(value):
    return isinstance(value, str) and SHA.fullmatch(value) is not None


def repo_matches(value):
    return isinstance(value, dict) and value.get("id") == REPOSITORY_ID and value.get("full_name") == REPOSITORY


def app_matches(value, identity):
    return isinstance(value, dict) and (value.get("id"), value.get("slug")) == identity


def claude_comment(comment):
    owner = comment.get("user") or {}
    return (app_matches(comment.get("performed_via_github_app"), CLAUDE_APP)
            and (owner.get("id"), owner.get("login")) == CLAUDE_OWNER
            and owner.get("type") == "User" and positive_int(comment.get("id")))


def stamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.timestamp() if parsed.tzinfo else 0
    except (AttributeError, TypeError, ValueError):
        return 0


@dataclass(frozen=True)
class Approval:
    id: int
    sha: str
    created_at: str


def approval_for(comments, head):
    """Later Claude decisions supersede earlier ones; edits cannot grant one.

    Negatives anywhere in the body fail closed, including quoted negatives.
    Positive quotations or code fences never grant authority.
    """
    decisions = []
    for comment in comments:
        if not claude_comment(comment):
            continue
        body = comment.get("body")
        if not isinstance(body, str) or len(body) > 65_536:
            continue
        first = body.strip().splitlines()[0] if body.strip() else ""
        if not POSITIVE_START.match(first) and not NEGATIVE.search(body):
            continue  # Quotes, code fences, ordinary updates and our replies.
        decisions.append(comment)
    if not decisions:
        return None, "approval_missing"
    decision = max(decisions, key=lambda c: (max(stamp(c.get("created_at")), stamp(c.get("updated_at"))), c["id"]))
    body = decision["body"].strip()
    if NEGATIVE.search(body):
        return None, "approval_revoked"
    if not stamp(decision.get("created_at")) or decision.get("updated_at") != decision.get("created_at"):
        return None, "approval_edited"
    match = APPROVED.fullmatch(body.splitlines()[0])
    if not match:
        return None, "approval_requires_full_sha"
    approved_sha = match[1].lower()
    if approved_sha != head:
        return None, "approval_not_current"
    return Approval(decision["id"], head, decision["created_at"]), "approved"


def in_scope(pr):
    base, head = pr.get("base") or {}, pr.get("head") or {}
    return (positive_int(pr.get("number")) and repo_matches(base.get("repo")) and repo_matches(head.get("repo"))
            and base.get("ref") == MAIN and head.get("ref") not in {None, "", MAIN}
            and valid_sha(head.get("sha")) and not pr.get("draft") and not pr.get("locked"))


def workflow_identity(run, filename):
    expected_id, expected_name = WORKFLOWS[filename]
    return (run.get("workflow_id") == expected_id and run.get("name") == expected_name
            and run.get("path") == ".github/workflows/" + filename
            and run.get("event") == "pull_request" and repo_matches(run.get("repository"))
            and repo_matches(run.get("head_repository")) and valid_sha(run.get("head_sha")))


def discover(api, event_name, event):
    if not repo_matches(event.get("repository")) or event["repository"].get("default_branch") != MAIN:
        return []
    if event_name == "issue_comment" and event.get("action") == "created":
        issue, comment = event.get("issue") or {}, event.get("comment") or {}
        if not issue.get("pull_request") or not positive_int(issue.get("number")) or not positive_int(comment.get("id")):
            return []
        # An event payload is a wake-up, never the approval evidence itself.
        fresh = api.get("/issues/comments/" + str(comment["id"]))
        if not claude_comment(fresh) or fresh.get("issue_url") != "https://api.github.com" + API_ROOT + "/issues/" + str(issue["number"]):
            return []
        first = str(fresh.get("body") or "").strip().splitlines()
        if not first or not POSITIVE_START.match(first[0]):
            return []
        pr = api.get("/pulls/" + str(issue["number"]))
        return [issue["number"]] if in_scope(pr) else []
    if event_name == "workflow_run" and event.get("action") == "completed":
        run_id = (event.get("workflow_run") or {}).get("id")
        if not positive_int(run_id):
            return []
        run = api.get("/actions/runs/" + str(run_id))
        if run.get("status") != "completed" or not any(workflow_identity(run, name) for name in WORKFLOWS):
            return []
        # pull_requests is empty in real runs in this repository; resolve by SHA.
        prs = api.pages("/commits/" + run["head_sha"] + "/pulls")
        return sorted({pr["number"] for pr in prs if in_scope(pr) and pr["head"]["sha"] == run["head_sha"]})
    if event_name == "status":
        sha, status_id = event.get("sha"), event.get("id")
        if not valid_sha(sha) or not positive_int(status_id) or event.get("context") != "Vercel":
            return []
        statuses = api.pages("/commits/" + sha + "/statuses")
        evidence = next((s for s in statuses if s.get("id") == status_id), None)
        if evidence is None or not trusted_vercel_status(evidence) or evidence.get("state") != event.get("state"):
            return []
        prs = api.pages("/commits/" + sha + "/pulls")
        return sorted({p["number"] for p in prs if in_scope(p)
                       and (p["head"]["sha"] == sha or p.get("merge_commit_sha") == sha)})
    if event_name == "check_run" and event.get("action") == "completed":
        check_id = (event.get("check_run") or {}).get("id")
        if not positive_int(check_id):
            return []
        evidence = api.get("/check-runs/" + str(check_id))
        identity = EXTERNAL_CHECKS.get(evidence.get("name"))
        if (identity is None or not app_matches(evidence.get("app"), identity)
                or evidence.get("status") != "completed" or not valid_sha(evidence.get("head_sha"))):
            return []
        sha = evidence["head_sha"]
        prs = api.pages("/commits/" + sha + "/pulls")
        return sorted({p["number"] for p in prs if in_scope(p) and p["head"]["sha"] == sha})
    return []


def latest_by(rows, key):
    latest = {}
    for row in rows:
        if not positive_int(row.get("id")):
            raise GateError("ci_metadata_invalid")
        identity = key(row)
        if identity not in latest or row["id"] > latest[identity]["id"]:
            latest[identity] = row
    return list(latest.values())


def successful(row):
    return row.get("status") == "completed" and row.get("conclusion") == "success"


def ci_green(api, pr, acceptance_names):
    head = pr["head"]["sha"]
    files = api.pages("/pulls/" + str(pr["number"]) + "/files")
    names = [f.get(key, "") for f in files for key in ("filename", "previous_filename")]
    expected = ["frontend-verification.yml"]
    if any(name in EVALUATION_FILES or name.startswith(EVALUATION_PREFIXES) for name in names):
        expected.append("evaluation-access.yml")
    run_ids = []
    for filename in expected:
        runs = api.pages("/actions/workflows/" + filename + "/runs?" + urlencode({"event": "pull_request", "head_sha": head}), "workflow_runs")
        if not runs:
            raise GateError("ci_workflow_missing")
        run = max(runs, key=lambda r: r.get("id", 0))
        if not workflow_identity(run, filename) or run.get("head_sha") != head or not positive_int(run.get("run_attempt")):
            raise GateError("ci_workflow_identity_invalid")
        if not successful(run):
            raise GateError("ci_not_green")
        jobs = api.pages("/actions/runs/" + str(run["id"]) + "/attempts/" + str(run["run_attempt"]) + "/jobs", "jobs")
        required = {"verify_once", *acceptance_names} if filename == "frontend-verification.yml" else {"evaluation"}
        if not jobs or not required <= {j.get("name") for j in jobs}:
            raise GateError("ci_jobs_incomplete")
        if any(not successful(j) or j.get("head_sha") != head or j.get("run_id") != run["id"] for j in jobs):
            raise GateError("ci_not_green")
        run_ids.append(run["id"])
    checks = latest_by(api.pages("/commits/" + head + "/check-runs?filter=latest", "check_runs"),
                       lambda c: (c.get("name"), (c.get("app") or {}).get("id")))
    if any(c.get("head_sha") != head or not successful(c) for c in checks):
        raise GateError("ci_not_green")
    if not any(c.get("name") == "GitGuardian Security Checks"
               and app_matches(c.get("app"), EXTERNAL_CHECKS["GitGuardian Security Checks"]) for c in checks):
        raise GateError("ci_security_check_missing")
    statuses = latest_by(api.pages("/commits/" + head + "/statuses"), lambda s: s.get("context"))
    if not statuses or any(s.get("state") != "success" for s in statuses):
        raise GateError("ci_not_green")
    return tuple(run_ids)


def trusted_vercel_status(status):
    creator = status.get("creator") or {}
    url = urlsplit(str(status.get("target_url") or ""))
    deployment = url.path.removeprefix(VERCEL_URL_PREFIX)
    if ((creator.get("id"), creator.get("login")) != VERCEL_BOT or creator.get("type") != "Bot"
            or status.get("context") != "Vercel" or status.get("state") not in {"success", "failure", "error", "pending"}
            or url.scheme != "https" or url.netloc != "vercel.com" or url.query or url.fragment
            or not url.path.startswith(VERCEL_URL_PREFIX) or re.fullmatch(r"[A-Za-z0-9]+", deployment) is None
            or not positive_int(status.get("id"))):
        return False
    return True


def vercel_signal(statuses):
    matching = [s for s in statuses if s.get("context") == "Vercel"]
    if not matching:
        return None
    status = max(matching, key=lambda s: s.get("id", 0))
    return status if (trusted_vercel_status(status) and status.get("state") == "success"
                      and status.get("description") == "Deployment has completed") else None


class RevisionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.revisions = []

    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        values = dict(attrs)
        if values.get("name") == "chatboc-build-revision":
            if len(attrs) != len(values):
                self.revisions.append(None)
            else:
                self.revisions.append(values.get("content"))


def revision_value(status, final_url, content_type, body):
    if status != 200 or final_url != PUBLIC_URL or content_type.split(";", 1)[0].strip().lower() != "text/html" or len(body) > MAX_BODY:
        return None
    try:
        parser = RevisionParser()
        parser.feed(body.decode("utf-8", errors="strict"))
        return parser.revisions[0] if len(parser.revisions) == 1 and valid_sha(parser.revisions[0]) else None
    except (UnicodeError, ValueError):
        return None


def public_revision():
    # No Authorization header, cookies, JS execution or redirects on public HTTP.
    request = Request(PUBLIC_URL, headers={"User-Agent": "chatboc-production-verifier", "Cache-Control": "no-cache"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            return revision_value(response.status, response.geturl(), response.headers.get("Content-Type", ""),
                                  response.read(MAX_BODY + 1))
    except (HTTPError, URLError, TimeoutError, OSError):
        return None


@dataclass(frozen=True)
class Outcome:
    state: str
    pr: int
    head: str = ""
    merge: str = ""
    reason: str = ""
    approval_id: int = 0
    vercel_status_id: int = 0
    served_sha: str = ""


def owned_report(comment, pr, head):
    return (app_matches(comment.get("performed_via_github_app"), ACTIONS_APP)
            and (comment.get("user") or {}).get("login") == "github-actions[bot]"
            and str(comment.get("body") or "").startswith(f"<!-- chatboc-claude-release:v1 pr={pr} head={head} "))


def report_body(outcome):
    marker = (f"<!-- chatboc-claude-release:v1 pr={outcome.pr} head={outcome.head} "
              f"merge={outcome.merge or '-'} state={outcome.state} -->")
    if outcome.state == "production_confirmed":
        title = "**Fusionado y Production confirmado.**"
        details = (f"Vercel confirmó la publicación (status `{outcome.vercel_status_id}`) y `www.chatboc.ar` "
                   f"respondió 200 con la revisión `{outcome.served_sha}`. "
                   + ("Coincide con el merge." if outcome.served_sha == outcome.merge else
                      "GitHub confirmó que esa revisión posterior contiene el merge aprobado."))
    elif outcome.state == "approval_required":
        title = "**Se necesita una línea de aprobación nueva de Claude con el SHA completo.**"
        details = (f"@claude Para este head, usá como primera línea independiente: `aprobado — head {outcome.head}`. "
                   "La explicación puede ir en la línea siguiente. No se fusionó el PR.")
    elif outcome.state in {"ignored", "waiting_for_ci", "preflight_changed", "merge_rejected"}:
        title, details = "**No se fusionó el PR.**", "La operación quedó detenida en sus condiciones previas; no se eludieron controles."
    else:
        title = "**Fusionado; publicación NO confirmada.**" if outcome.merge else "**Resultado del merge no confirmado.**"
        details = "No se declara éxito de publicación ni se reintenta el merge a ciegas."
    return (f"{marker}\n{title}\n\nHead: `{outcome.head}`. Merge: `{outcome.merge or 'no confirmado'}`. "
            f"Aprobación: `{outcome.approval_id or 'pendiente'}`.\n\n{details}\n\nEstado técnico: `{outcome.reason or outcome.state}`.")


class Coordinator:
    def __init__(self, api, acceptance_names, probe=public_revision, clock=time.monotonic, sleep=time.sleep,
                 publication_timeout=480, interval=15):
        self.api, self.acceptance_names, self.probe = api, acceptance_names, probe
        self.clock, self.sleep = clock, sleep
        self.publication_timeout, self.interval = publication_timeout, interval

    def comments(self, number):
        return self.api.pages("/issues/" + str(number) + "/comments")

    def report(self, outcome):
        try:
            body = report_body(outcome)
            reports = [c for c in self.comments(outcome.pr) if owned_report(c, outcome.pr, outcome.head)]
            existing = max(reports, key=lambda c: c["id"]) if reports else None
            if existing and existing.get("body") == body:
                return
            if existing:
                self.api.request("PATCH", API_ROOT + "/issues/comments/" + str(existing["id"]), {"body": body})
            else:
                self.api.request("POST", API_ROOT + "/issues/" + str(outcome.pr) + "/comments", {"body": body})
        except GateError as exc:
            # A report failure must neither replay a write nor erase a known merge.
            print(json.dumps({"report_state": "unconfirmed", "pr": outcome.pr, "reason": exc.code}))

    def includes_merge(self, merged, served):
        if served == merged:
            return True
        comparison = self.api.get("/compare/" + merged + "..." + served + "?per_page=1")
        return (comparison.get("status") == "ahead" and comparison.get("behind_by") == 0
                and positive_int(comparison.get("ahead_by"))
                and (comparison.get("base_commit") or {}).get("sha") == merged
                and (comparison.get("merge_base_commit") or {}).get("sha") == merged)

    def publication(self, outcome):
        # A bot comment is only an idempotency key, never publication evidence:
        # another Actions workflow could post a forged copy of the marker.
        deadline = self.clock() + self.publication_timeout
        ancestry = {outcome.merge: True}
        while True:
            try:
                served = self.probe()
                if valid_sha(served) and served not in ancestry:
                    ancestry[served] = self.includes_merge(outcome.merge, served)
                signal = (vercel_signal(self.api.pages("/commits/" + served + "/statuses"))
                          if valid_sha(served) and ancestry.get(served) else None)
                if signal:
                    confirmed = Outcome("production_confirmed", outcome.pr, outcome.head, outcome.merge,
                                        approval_id=outcome.approval_id, vercel_status_id=signal["id"], served_sha=served)
                    self.report(confirmed)
                    return confirmed
            except GateError:
                pass  # Bounded retry of read-only evidence, never of the merge.
            if self.clock() >= deadline:
                pending = Outcome("merged_publication_unconfirmed", outcome.pr, outcome.head, outcome.merge,
                                  "publication_timeout", outcome.approval_id)
                self.report(pending)
                return pending
            self.sleep(min(self.interval, max(0, deadline - self.clock())))

    def execute(self, number):
        if not positive_int(number):
            raise GateError("pr_number_invalid")
        pr = self.api.get("/pulls/" + str(number))
        if not in_scope(pr) or pr.get("number") != number:
            return Outcome("ignored", number, reason="pr_out_of_scope")
        head = pr["head"]["sha"]
        approval, reason = approval_for(self.comments(number), head)
        if approval is None:
            outcome = Outcome("approval_required" if reason in {"approval_requires_full_sha", "approval_edited"} else "ignored", number, head, reason=reason)
            if outcome.state == "approval_required" and pr.get("state") == "open":
                self.report(outcome)
            return outcome
        if pr.get("merged"):
            merged = pr.get("merge_commit_sha")
            if not valid_sha(merged):
                return Outcome("merge_unconfirmed", number, head, reason="merge_sha_missing", approval_id=approval.id)
            try:
                commit = self.api.get("/commits/" + merged)
                verified = len(commit.get("parents", [])) == 2 and commit["parents"][1].get("sha") == head
            except GateError:
                verified = False
            if not verified:
                outcome = Outcome("merged_publication_unconfirmed", number, head, merged, "merge_shape_unverified", approval.id)
                self.report(outcome)
                return outcome
            return self.publication(Outcome("merged", number, head, merged, approval_id=approval.id))
        if pr.get("state") != "open":
            return Outcome("ignored", number, head, reason="pr_closed")
        try:
            ci_green(self.api, pr, self.acceptance_names)
        except GateError as exc:
            return Outcome("waiting_for_ci", number, head, reason=exc.code, approval_id=approval.id)
        base = self.api.get("/git/ref/heads/main").get("object", {}).get("sha")
        if not valid_sha(base):
            raise GateError("base_sha_missing")
        # Re-read decisions, CI, head and base after potentially slow API work.
        current = self.api.get("/pulls/" + str(number))
        fresh, reason = approval_for(self.comments(number), head)
        if (not in_scope(current) or current.get("state") != "open" or current.get("merged")
                or current["head"]["sha"] != head or current.get("mergeable") is not True or fresh is None):
            return Outcome("preflight_changed", number, head, reason=reason if fresh is None else "pr_changed", approval_id=approval.id)
        try:
            ci_green(self.api, current, self.acceptance_names)
        except GateError as exc:
            return Outcome("waiting_for_ci", number, head, reason=exc.code, approval_id=fresh.id)
        final = self.api.get("/pulls/" + str(number))
        final_approval, final_reason = approval_for(self.comments(number), head)
        if (not in_scope(final) or final.get("state") != "open" or final.get("merged")
                or final["head"]["sha"] != head or final.get("mergeable") is not True or final_approval is None):
            return Outcome("preflight_changed", number, head, reason=final_reason if final_approval is None else "pr_changed", approval_id=fresh.id)
        fresh = final_approval
        if self.api.get("/git/ref/heads/main").get("object", {}).get("sha") != base:
            return Outcome("preflight_changed", number, head, reason="base_changed", approval_id=fresh.id)
        acknowledged_sha = ""
        try:
            result = self.api.request("PUT", API_ROOT + "/pulls/" + str(number) + "/merge", {"sha": head, "merge_method": "merge"})
            if result.get("merged") is not True:
                return Outcome("merge_rejected", number, head, reason="github_merge_rejected", approval_id=fresh.id)
            if valid_sha(result.get("sha")):
                acknowledged_sha = result["sha"]
            print(json.dumps({"merge_state": "acknowledged", "pr": number, "head": head, "merge": acknowledged_sha}))
        except GateError as exc:
            if exc.status in {400, 401, 403, 404, 405, 409, 422}:
                return Outcome("merge_rejected", number, head, reason="github_merge_rejected", approval_id=fresh.id)
            # A lost ACK may have merged. Reconcile with GET; never replay PUT.
        try:
            after = self.api.get("/pulls/" + str(number))
            merged = after.get("merge_commit_sha")
            if not after.get("merged") or not valid_sha(merged):
                outcome = Outcome("merged_publication_unconfirmed" if acknowledged_sha else "merge_unconfirmed",
                                  number, head, acknowledged_sha, "merge_ack_unresolved", fresh.id)
                self.report(outcome)
                return outcome
            if acknowledged_sha and merged != acknowledged_sha:
                outcome = Outcome("merged_publication_unconfirmed", number, head, acknowledged_sha, "merge_sha_changed", fresh.id)
                self.report(outcome)
                return outcome
            acknowledged_sha = merged
            commit = self.api.get("/commits/" + merged)
            if [p.get("sha") for p in commit.get("parents", [])] != [base, head]:
                outcome = Outcome("merged_publication_unconfirmed", number, head, merged, "merge_parents_changed", fresh.id)
                self.report(outcome)
                return outcome
            return self.publication(Outcome("merged", number, head, merged, approval_id=fresh.id))
        except GateError:
            # Preserve the known merge outcome even if subsequent reads fail.
            outcome = Outcome("merged_publication_unconfirmed" if acknowledged_sha else "merge_unconfirmed",
                              number, head, acknowledged_sha, "merge_readback_unavailable", fresh.id)
            self.report(outcome)
            return outcome


def trusted_runtime(context):
    # The documented events use the default branch. Pin the workflow source
    # itself and the explicit main checkout; never select code from event.ref.
    # The event's provider/SHA are authenticated separately through GitHub API.
    expected_ref = REPOSITORY + "/" + WORKFLOW_FILE + "@refs/heads/main"
    return (context.get("GITHUB_ACTIONS") == "true" and context.get("GITHUB_REPOSITORY") == REPOSITORY
            and context.get("GITHUB_WORKFLOW_REF") == expected_ref
            and context.get("GITHUB_EVENT_NAME") in {"issue_comment", "workflow_run", "status", "check_run"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("discover", "run"))
    parser.add_argument("--pr-number", type=int)
    args = parser.parse_args()
    if not trusted_runtime(os.environ):
        raise GateError("untrusted_workflow_runtime")
    api = GitHub(os.environ.get("GITHUB_TOKEN", ""))
    if args.command == "discover":
        raw = Path(os.environ["GITHUB_EVENT_PATH"]).read_bytes()
        if len(raw) > MAX_BODY:
            raise GateError("event_too_large")
        candidates = discover(api, os.environ.get("GITHUB_EVENT_NAME"), json.loads(raw))
        if len(candidates) > 20:
            raise GateError("too_many_candidate_prs")
        with Path(os.environ["GITHUB_OUTPUT"]).open("a", encoding="utf-8") as stream:
            stream.write("prs=" + json.dumps(candidates) + "\nhas_prs=" + str(bool(candidates)).lower() + "\n")
        print(json.dumps({"candidate_prs": candidates}))
        return
    contract = json.loads(Path(__file__).with_name("acceptance-contract.json").read_text())
    outcome = Coordinator(api, {row["name"] for row in contract}).execute(args.pr_number)
    print(json.dumps(asdict(outcome), sort_keys=True))
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as stream:
            stream.write(report_body(outcome) + "\n")
    if outcome.state in {"merge_unconfirmed", "merged_publication_unconfirmed", "merge_rejected"}:
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except GateError as error:
        print(json.dumps({"state": "blocked", "reason": error.code, "http_status": error.status}))
        raise SystemExit(1) from None
    except Exception:
        # Never emit token-bearing requests, response bodies or exception reprs.
        print(json.dumps({"state": "blocked", "reason": "unexpected_failure"}))
        raise SystemExit(1) from None
