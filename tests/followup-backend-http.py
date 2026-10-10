"""Original Flask routes, auth and persistence on disposable SQLite. No external network."""
import sys
from pathlib import Path
import argparse
import subprocess
parser=argparse.ArgumentParser()
parser.add_argument('--backend',required=True)
parser.add_argument('--browser',action='store_true')
parser.add_argument('--evidence',default='.vercel/followup-evidence')
args=parser.parse_args()
BACKEND=Path(args.backend).resolve()
FRONTEND=Path(__file__).resolve().parents[1]
EVIDENCE=Path(args.evidence).resolve()
EVIDENCE.mkdir(parents=True,exist_ok=True)
BACKEND_REVISION=subprocess.check_output(['git','-C',str(BACKEND),'rev-parse','HEAD'],text=True).strip()
sys.path.insert(0,str(BACKEND))
from tests.profile_acceptance_runtime import prepare_process, create_disposable_app
prepare_process()
import os
os.environ['CLERK_SUPERADMIN_EMAILS']='platform-qa@example.invalid'
import json
import tempfile
import unittest
import uuid

class FollowUpHttpAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory(prefix='chatboc-followup-qa-')
        cls.app, cls.accounts, cls.password = create_disposable_app(cls.directory.name)
        from database import db
        from models import User
        from models_memory import Contact
        cls.ids = {}
        with cls.app.app_context():
            assert 'chatboc-followup-qa-' in db.engine.url.database
            db.create_all()
            for slug in ('acceptance-a', 'acceptance-b'):
                cid = str(uuid.uuid4())
                db.session.add(Contact(id=cid, tenant_id=cls.accounts[slug]['tenant_id'], name='Synthetic follow-up',
                    preferences={'conversation_status':'nuevo','marketing_opt_in':False}, tags=['qa']))
                cls.ids[slug]=cid
            admin = User(name='Platform QA',email='platform-qa@example.invalid',rol='super_admin', tenant_id=cls.accounts['acceptance-a']['tenant_id'], tenant_slug='acceptance-a', municipio_id=cls.accounts['acceptance-a']['id'],tipo_chat='municipio')
            admin.set_password(cls.password);db.session.add(admin);db.session.commit();cls.platform_id=admin.id
    @classmethod
    def tearDownClass(cls):
        from database import db
        with cls.app.app_context():
            db.session.remove();db.engine.dispose()
        cls.directory.cleanup()
    def login(self, account='acceptance-a'):
        client=self.app.test_client()
        if account=='platform':
            # Test-only signed session; does not certify the external Clerk flow.
            from services.clerk_auth_service import _issue_clerk_chatboc_token
            from models import User, TenantProfile
            with self.app.app_context():
                user=User.query.filter_by(id=self.platform_id).one()
                tenant=TenantProfile.query.filter_by(id=self.accounts['acceptance-a']['tenant_id']).one()
                token=_issue_clerk_chatboc_token(user,tenant,{'sid':'local-acceptance-session','sub':'local-acceptance-subject'})
            return client, {'Authorization':'Bearer '+token}
        email=self.accounts[account]['email']
        result=client.post('/auth/login',json={'email':email,'password':self.password})
        self.assertEqual(result.status_code,200, str(result.get_json().get('error')))
        token=result.get_json().get('token');self.assertTrue(token)
        return client, {'Authorization':'Bearer '+token}
    def path(self,suffix='history',slug='acceptance-a'):
        return '/api/admin/tenants/'+slug+'/contacts/'+self.ids['acceptance-a']+'/'+suffix
    def test_01_saves_and_survives_a_new_authenticated_client(self):
        client,headers=self.login()
        wanted={'owner_notes':'Revisar propuesta local','next_action_at':'2026-10-01T15:00:00.000Z'}
        before=client.get(self.path(),headers=headers);self.assertEqual(before.status_code,200)
        response=client.patch(self.path('stage'),json=wanted,headers=headers)
        self.assertEqual(response.status_code,200);self.assertTrue(response.get_json()['ok'])
        self.assertEqual(response.get_json()['contact']['contact_id'],self.ids['acceptance-a'])
        client2,headers2=self.login();result=client2.get(self.path(),headers=headers2)
        self.assertEqual(result.status_code,200)
        prefs=result.get_json()['contact']['preferences']
        self.assertEqual(prefs['owner_notes'],wanted['owner_notes']);self.assertEqual(prefs['next_action_at'],wanted['next_action_at'])
        self.assertEqual(prefs['stage_updated_by'],self.accounts['acceptance-a']['id'])
        self.assertEqual(prefs['conversation_status'],'nuevo');self.assertFalse(prefs['marketing_opt_in'])
        from models_memory import InteractionEvent
        with self.app.app_context():
            event=InteractionEvent.query.filter_by(contact_id=self.ids['acceptance-a']).order_by(InteractionEvent.id.desc()).first()
            self.assertEqual(event.channel,'crm');self.assertEqual(event.metadata_payload['event_type'],'crm_stage_update')
    def test_02_clear_schedule_preserves_notes(self):
        client,headers=self.login();response=client.patch(self.path('stage'),json={'owner_notes':'Contexto conservado','next_action_at':None},headers=headers)
        self.assertEqual(response.status_code,200)
        prefs=client.get(self.path(),headers=headers).get_json()['contact']['preferences']
        self.assertIsNone(prefs['next_action_at']);self.assertEqual(prefs['owner_notes'],'Contexto conservado')
    def test_03_anonymous_read_and_write_are_rejected(self):
        client=self.app.test_client()
        self.assertEqual(client.get(self.path()).status_code,401)
        self.assertEqual(client.patch(self.path('stage'),json={'owner_notes':'No write'}).status_code,401)
    def test_04_foreign_tenant_cannot_read_or_write(self):
        client,headers=self.login('acceptance-b')
        self.assertIn(client.get(self.path(),headers=headers).status_code,(403,404))
        self.assertIn(client.patch(self.path('stage'),headers=headers,json={'owner_notes':'Foreign'}).status_code,(403,404))
    def test_05_foreign_contact_in_own_scope_is_not_found(self):
        client,headers=self.login('acceptance-b')
        self.assertEqual(client.get(self.path(slug='acceptance-b'),headers=headers).status_code,404)
    def test_06_global_queue_requires_platform_role(self):
        client,headers=self.login()
        self.assertEqual(client.get('/api/admin/crm/leads?limit=100',headers=headers).status_code,403)
    def test_07_platform_queue_keeps_real_contact_and_tenant_identities(self):
        client,headers=self.login('platform')
        result=client.get('/api/admin/crm/leads?limit=100',headers=headers)
        self.assertEqual(result.status_code,200)
        item=next(row for row in result.get_json()['items'] if row['contact_id']==self.ids['acceptance-a'])
        self.assertEqual(item['tenant']['slug'],'acceptance-a')
        self.assertIn('next_action_at',item);self.assertIn('owner_notes',item)
    def test_08_read_only_does_not_add_interaction_events(self):
        from models_memory import InteractionEvent
        client,headers=self.login()
        with self.app.app_context():before=InteractionEvent.query.count()
        self.assertEqual(client.get(self.path(),headers=headers).status_code,200)
        with self.app.app_context():self.assertEqual(InteractionEvent.query.count(),before)

    def test_09_platform_password_login_remains_blocked(self):
        response=self.app.test_client().post('/auth/login',json={'email':'platform-qa@example.invalid','password':self.password})
        self.assertEqual(response.status_code,403)
        self.assertIn('Clerk',response.get_json().get('error',''))

    @unittest.skipUnless(args.browser, 'Enable --browser to run the integrated Chromium workflow')
    def test_10_browser_saves_through_original_http_routes(self):
        import threading
        from werkzeug.serving import make_server
        from models_memory import Contact, InteractionEvent
        from database import db
        server=make_server('127.0.0.1',0,self.app,threaded=True)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        _,headers=self.login('platform')
        with self.app.app_context():before=InteractionEvent.query.filter_by(contact_id=self.ids['acceptance-a']).count()
        try:
            payload={'backendOrigin':'http://127.0.0.1:'+str(server.server_port),'authorization':headers['Authorization'],'contactId':self.ids['acceptance-a'],'tenantSlug':'acceptance-a','evidence':str(EVIDENCE)}
            run=subprocess.run(['node',str(FRONTEND/'tests/followup-full.browser.mjs')],cwd=FRONTEND,input=json.dumps(payload),text=True,encoding='utf-8',capture_output=True,timeout=120)
            (EVIDENCE/'full-browser.log').write_text(run.stdout+'\n'+run.stderr,encoding='utf-8')
            self.assertEqual(run.returncode,0,'See full-browser.log')
            with self.app.app_context():
                db.session.expire_all();contact=Contact.query.filter_by(id=self.ids['acceptance-a']).one()
                self.assertEqual(contact.preferences['owner_notes'],'Seguimiento QA integrado')
                self.assertEqual(contact.preferences['next_action_at'],'2026-10-02T15:30:00.000Z')
                self.assertEqual(contact.preferences['conversation_status'],'nuevo')
                self.assertEqual(InteractionEvent.query.filter_by(contact_id=contact.id).count(),before+1)
        finally:server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=='__main__':
    with (EVIDENCE/'backend-http-results.log').open('w',encoding='utf-8') as output:
        suite=unittest.defaultTestLoader.loadTestsFromTestCase(FollowUpHttpAcceptance)
        result=unittest.TextTestRunner(stream=output,verbosity=2).run(suite)
    (EVIDENCE/'backend-http-results.json').write_text(json.dumps({'tests':result.testsRun,'errors':len(result.errors),'failures':len(result.failures),'skipped':len(result.skipped),'success':result.wasSuccessful(),'backend_revision':BACKEND_REVISION,'tenant_password_login':True,'platform_session':'original issuer with local synthetic claims; external Clerk not certified','real_routes':True,'database':'disposable SQLite','external_network':'blocked'}),encoding='utf-8')
    sys.exit(0 if result.wasSuccessful() else 1)
