"""Original auth routes in a new disposable database; never uses customer credentials."""
from pathlib import Path
import argparse,json,subprocess,sys,tempfile,threading,unittest
parser=argparse.ArgumentParser()
parser.add_argument('--backend',required=True)
parser.add_argument('--browser',action='store_true')
parser.add_argument('--evidence',default='.vercel/unified-login-evidence')
args=parser.parse_args()
BACKEND=Path(args.backend).resolve();FRONTEND=Path(__file__).resolve().parents[1]
EVIDENCE=Path(args.evidence).resolve();EVIDENCE.mkdir(parents=True,exist_ok=True)
expected=subprocess.check_output(['git','-C',str(BACKEND),'show','912446bf96f8330664a9dec009ae57dbf935c73c:routes/auth.py'])
if (BACKEND/'routes/auth.py').read_text(encoding='utf-8').replace('\r\n','\n')!=expected.decode().replace('\r\n','\n'):
    raise RuntimeError('Auth route differs from the observed production base')
sys.path.insert(0,str(BACKEND))
from tests.profile_acceptance_runtime import prepare_process,create_disposable_app
prepare_process()

class UnifiedLoginTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory=tempfile.TemporaryDirectory(prefix='unified-login-qa-')
        cls.app,cls.accounts,cls.password=create_disposable_app(cls.directory.name)
    @classmethod
    def tearDownClass(cls):
        from database import db
        with cls.app.app_context():db.session.remove();db.engine.dispose()
        cls.directory.cleanup()
    def credentials(self):return {'email':self.accounts['acceptance-a']['email'],'password':self.password}
    def test_central_login_derives_the_organization_from_the_account(self):
        result=self.app.test_client().post('/auth/admin/login',json=self.credentials())
        self.assertEqual(result.status_code,200);self.assertEqual(result.get_json()['user']['tenant_slug'],'acceptance-a')
        self.assertEqual(result.get_json()['user']['id'],self.accounts['acceptance-a']['id'])
    def test_explicit_login_uses_the_same_identity(self):
        result=self.app.test_client().post('/auth/admin/login',json={**self.credentials(),'tenant_slug':'acceptance-a'},headers={'X-Tenant':'acceptance-a'})
        self.assertEqual(result.status_code,200);self.assertEqual(result.get_json()['user']['id'],self.accounts['acceptance-a']['id'])
    def test_login_does_not_grant_access_to_another_organization(self):
        client=self.app.test_client();result=client.post('/auth/admin/login',json=self.credentials())
        headers={'Authorization':'Bearer '+result.get_json()['token']}
        response=client.get('/api/admin/tenants/acceptance-b/config',headers=headers)
        self.assertIn(response.status_code,(403,404))
    def test_wrong_password_is_rejected(self):
        result=self.app.test_client().post('/auth/admin/login',json={**self.credentials(),'password':'not-the-fixture-password'})
        self.assertEqual(result.status_code,401);self.assertNotIn('token',result.get_json())
    @unittest.skipUnless(args.browser,'Browser explicitly enabled by the acceptance runner')
    def test_login_page_against_original_authentication(self):
        from werkzeug.serving import make_server
        server=make_server('127.0.0.1',0,self.app,threaded=True)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            settings={'backendOrigin':'http://127.0.0.1:'+str(server.server_port),'email':self.accounts['acceptance-a']['email'],
                      'password':self.password,'userId':self.accounts['acceptance-a']['id'],'evidence':str(EVIDENCE)}
            run=subprocess.run(['node','tests/unified-login.browser.mjs'],cwd=FRONTEND,input=json.dumps(settings),
                               text=True,encoding='utf-8',capture_output=True,timeout=150)
            (EVIDENCE/'integrated-browser.log').write_text(run.stdout+'\n'+run.stderr,encoding='utf-8')
            self.assertEqual(run.returncode,0,'See integrated-browser.log; no production credentials used')
        finally:server.shutdown();server.server_close();thread.join(timeout=5)

if __name__=='__main__':
    with (EVIDENCE/'backend-tests.log').open('w',encoding='utf-8') as output:
        result=unittest.TextTestRunner(stream=output,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(UnifiedLoginTests))
    report={'success':result.wasSuccessful(),'tests':result.testsRun,'failed':len(result.failures),'errors':len(result.errors),'skipped':len(result.skipped),
            'original_auth_routes':True,'auth_runtime_base':'912446bf96f8330664a9dec009ae57dbf935c73c','database':'disposable SQLite',
            'accounts':'synthetic','production_credentials_used':False}
    (EVIDENCE/'backend-results.json').write_text(json.dumps(report),encoding='utf-8');print(json.dumps(report))
    raise SystemExit(0 if result.wasSuccessful() else 1)
