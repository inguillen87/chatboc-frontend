import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {node,reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async importOriginal=>({...await importOriginal<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
import {
  DEFAULT_PRINT_ANSWER_LABEL,
  DEFAULT_PRINT_DISCLAIMER,
  DEFAULT_WHATSAPP_SHARE_LABEL,
  MAX_INSTITUTIONAL_WHATSAPP_CHARS,
  buildInstitutionalPortalUrl,
  buildInstitutionalWhatsAppText,
  buildInstitutionalWhatsAppUrl,
  stripMarkdownToPlainText,
} from './InstitutionalTextBlocks';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import {institutionalInitialMenuContext,parseInstitutionalChatMessage} from '@/features/chat/institutionalChatMessage';

const CUD={acronym:'CUD',expansion:'Certificado Único de Discapacidad'};
const CMO={acronym:'CMO',expansion:'Certificado Médico Oficial'};

const publishedWorkspace=(uiOverrides:Record<string,string>={})=>{
  const base=workspace({visibility:'public',can_edit:false});
  return {...base,ui:{...base.ui,acronyms:'Siglas',...uiOverrides}};
};

const routePublic=(uiOverrides:Record<string,string>={},nodeOverrides:Partial<ReturnType<typeof node>>={})=>{
  mocks.fetch.mockImplementation(async(path:string)=>{
    const w=publishedWorkspace(uiOverrides);
    if(path.endsWith('/answer')||path.includes('/nodes/')){
      const answer=reply('requirements',w);
      return {
        ...answer,
        nodes:answer.nodes.map(n=>({
          ...n,
          acronyms:[CUD,CMO],
          ...nodeOverrides,
        })),
      };
    }
    return w;
  });
};

beforeEach(()=>{
  mocks.fetch.mockReset();
  window.history.replaceState({},'','/t/qa-knowledge');
});

afterEach(()=>{
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({},'','/');
});

describe('WhatsApp share text and URL builders',()=>{
  it('strips markdown syntax into clean plain text',()=>{
    const raw='## Requisitos **principales**\n\n- Presentar *documento* y [formulario oficial](https://example.org/form)\n> Revisar `vigencia` antes de asistir.';
    const plain=stripMarkdownToPlainText(raw);
    expect(plain).not.toContain('##');
    expect(plain).not.toContain('**');
    expect(plain).not.toContain('*documento*');
    expect(plain).not.toContain('`');
    expect(plain).toContain('Requisitos principales');
    expect(plain).toContain('• Presentar documento y formulario oficial (https://example.org/form)');
    expect(plain).toContain('Revisar vigencia antes de asistir.');
  });

  it('builds a wa.me URL containing title, plain text, acronyms, reference links and portal link',()=>{
    const portalUrl=buildInstitutionalPortalUrl('qa-knowledge','requirements','https://portal.example.org/t/qa-knowledge');
    expect(portalUrl).toBe('https://portal.example.org/t/qa-knowledge?tema=requirements');

    const waUrl=buildInstitutionalWhatsAppUrl({
      title:'Requisitos de la consulta',
      text:'**Documentación** necesaria:\n- DNI vigente\n- Constancia de domicilio',
      acronyms:[CUD],
      acronymsLabel:'Siglas',
      links:[{label:'Referencia institucional',url:'https://example.org/informacion'}],
      portalUrl,
    });

    expect(waUrl.startsWith('https://wa.me/?text=')).toBe(true);
    const decoded=decodeURIComponent(waUrl.slice('https://wa.me/?text='.length));
    expect(decoded).toContain('Requisitos de la consulta');
    expect(decoded).toContain('Documentación necesaria:');
    expect(decoded).not.toContain('**');
    expect(decoded).toContain('Siglas:');
    expect(decoded).toContain('CUD: Certificado Único de Discapacidad');
    expect(decoded).toContain('Referencia institucional: https://example.org/informacion');
    expect(decoded.endsWith(`Ver en el portal: ${portalUrl}`)).toBe(true);
  });

  it('truncates messages over 3500 characters with an ellipsis while keeping the portal link at the end',()=>{
    const portalUrl='https://portal.example.org/t/qa-knowledge?tema=requirements';
    const longBody=Array.from({length:120},(_,i)=>`Párrafo ${i+1}: Información orientativa de prueba para verificar el recorte seguro.`).join('\n\n');
    const text=buildInstitutionalWhatsAppText({
      title:'Guía extensa de prueba',
      text:longBody,
      acronyms:[CUD],
      acronymsLabel:'Siglas',
      links:[{label:'Referencia institucional',url:'https://example.org/informacion'}],
      portalUrl,
    });

    expect(text.length).toBeLessThanOrEqual(MAX_INSTITUTIONAL_WHATSAPP_CHARS);
    expect(text).toContain('…');
    expect(text.endsWith(`Ver en el portal: ${portalUrl}`)).toBe(true);

    const waUrl=buildInstitutionalWhatsAppUrl({
      title:'Guía extensa de prueba',
      text:longBody,
      acronyms:[CUD],
      links:[{label:'Referencia institucional',url:'https://example.org/informacion'}],
      portalUrl,
    });
    expect(waUrl.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(waUrl.slice('https://wa.me/?text='.length))).toBe(text);
  });
});

describe('share and print actions in InstitutionalAssistant',()=>{
  it('hides share and print buttons on the start menu and shows both real buttons on an opened topic',async()=>{
    routePublic();
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('button',{name:/Consultar requisitos/});
    expect(screen.queryByRole('button',{name:DEFAULT_WHATSAPP_SHARE_LABEL})).toBeNull();
    expect(screen.queryByRole('button',{name:DEFAULT_PRINT_ANSWER_LABEL})).toBeNull();

    fireEvent.click(screen.getByRole('button',{name:/Consultar requisitos/}));
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});

    const whatsappButton=screen.getByRole('button',{name:DEFAULT_WHATSAPP_SHARE_LABEL});
    const printButton=screen.getByRole('button',{name:DEFAULT_PRINT_ANSWER_LABEL});
    expect(whatsappButton.tagName).toBe('BUTTON');
    expect(printButton.tagName).toBe('BUTTON');
    for(const svg of [...whatsappButton.querySelectorAll('svg'),...printButton.querySelectorAll('svg')]){
      expect(svg).toHaveAttribute('aria-hidden','true');
    }

    const openSpy=vi.spyOn(window,'open').mockReturnValue(null);
    fireEvent.click(whatsappButton);
    expect(openSpy).toHaveBeenCalledOnce();
    const [calledUrl,calledTarget,calledFeatures]=openSpy.mock.calls[0];
    expect(String(calledUrl).startsWith('https://wa.me/?text=')).toBe(true);
    expect(calledTarget).toBe('_blank');
    expect(calledFeatures).toBe('noopener,noreferrer');

    const decoded=decodeURIComponent(String(calledUrl).slice('https://wa.me/?text='.length));
    expect(decoded).toContain('Requisitos de la consulta');
    expect(decoded).toContain('Esta es la respuesta publicada en el documento de prueba.');
    expect(decoded).toContain('CUD: Certificado Único de Discapacidad');
    expect(decoded).toContain('Referencia institucional: https://example.org/informacion');
    expect(decoded).toContain('/t/qa-knowledge?tema=requirements');
  });

  it('calls window.print, opens citations and renders the orientative disclaimer when printing',async()=>{
    routePublic();
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});

    const printSpy=vi.spyOn(window,'print').mockImplementation(()=>{});
    const assistant=screen.getByTestId('institutional-assistant');
    const details=assistant.querySelector<HTMLDetailsElement>('details.institutional-assistant__citations')!;
    expect(details.open).toBe(false);

    fireEvent.click(screen.getByRole('button',{name:DEFAULT_PRINT_ANSWER_LABEL}));
    expect(printSpy).toHaveBeenCalledOnce();
    expect(details.open).toBe(true);
    expect(assistant).toHaveAttribute('data-printing-node','requirements');
    expect(assistant.querySelector('.institutional-assistant__print-disclaimer')).toHaveTextContent(DEFAULT_PRINT_DISCLAIMER);
    expect(assistant.querySelector('.institutional-assistant__print-date')).toHaveTextContent(/Fecha de impresión:/);

    fireEvent(window,new Event('afterprint'));
    expect(details.open).toBe(false);
    expect(assistant).not.toHaveAttribute('data-printing-node');
  });

  it('uses backend-supplied UI labels and disclaimer when provided',async()=>{
    routePublic({
      share_whatsapp:'Compartir respuesta por WhatsApp',
      print_answer:'Imprimir hoja de respuesta',
      print_disclaimer:'Texto orientativo oficial del organismo.',
    });
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});

    expect(screen.getByRole('button',{name:'Compartir respuesta por WhatsApp'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Imprimir hoja de respuesta'})).toBeInTheDocument();
    expect(screen.getByTestId('institutional-assistant').querySelector('.institutional-assistant__print-disclaimer'))
      .toHaveTextContent('Texto orientativo oficial del organismo.');
  });

  it('opens the node directly when ?tema=<nodeId> is present in public mode',async()=>{
    window.history.replaceState({},'','/t/qa-knowledge?tema=requirements');
    routePublic();
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    expect(await screen.findByRole('heading',{name:'Requisitos de la consulta'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:DEFAULT_WHATSAPP_SHARE_LABEL})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:DEFAULT_PRINT_ANSWER_LABEL})).toBeInTheDocument();
  });
});

describe('WhatsApp share action in InstitutionalChatMessage (widget)',()=>{
  const widgetUi={
    more_options:'Más opciones',
    previous_options:'Opciones anteriores',
    options_page:'Opciones: grupo {current} de {total}',
    large_text:'Texto ampliado',
    source_details:'Consultar fuentes',
    acronyms:'Siglas',
  };

  it('renders only Enviar por WhatsApp (without print) on an opened answer and opens wa.me cleanly',()=>{
    const w=publishedWorkspace();
    const answerNode={...node('requirements'),acronyms:[CUD]};
    const payload={
      fuente:'institutional_knowledge',
      context_revision:w.revision!,
      knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
      knowledge_nodes:[answerNode],
      knowledge_sources:answerNode.sources,
      message_body:answerNode.text,
      knowledge_ui:widgetUi,
      botones:answerNode.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`})),
    };
    const parsed=parseInstitutionalChatMessage(payload,'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={parsed} interactive onButtonClick={vi.fn()}/>);

    const card=screen.getByTestId('institutional-chat-message');
    const waButton=within(card).getByRole('button',{name:DEFAULT_WHATSAPP_SHARE_LABEL});
    expect(within(card).queryByRole('button',{name:DEFAULT_PRINT_ANSWER_LABEL})).toBeNull();

    const openSpy=vi.spyOn(window,'open').mockReturnValue(null);
    fireEvent.click(waButton);
    expect(openSpy).toHaveBeenCalledOnce();
    const [calledUrl,calledTarget,calledFeatures]=openSpy.mock.calls[0];
    expect(calledTarget).toBe('_blank');
    expect(calledFeatures).toBe('noopener,noreferrer');
    const decoded=decodeURIComponent(String(calledUrl).slice('https://wa.me/?text='.length));
    expect(decoded).toContain('Requisitos de la consulta');
    expect(decoded).toContain('CUD: Certificado Único de Discapacidad');
    expect(decoded).toContain('https://example.org/informacion');
    expect(decoded).toContain('/t/qa-knowledge?tema=requirements');
  });

  it('does not render Enviar por WhatsApp on the initial start menu',()=>{
    const w=publishedWorkspace();
    const startNode=w.knowledge!.initial;
    const payload={
      fuente:'institutional_knowledge',
      context_revision:w.revision!,
      knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
      knowledge_nodes:[startNode],
      knowledge_sources:startNode.sources,
      message_body:startNode.text,
      knowledge_ui:widgetUi,
      botones:startNode.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`})),
    };
    const parsed=parseInstitutionalChatMessage(payload,'qa-knowledge')!;
    const withInitial={...parsed,initialMenu:institutionalInitialMenuContext(w,'qa-knowledge')!};
    render(<InstitutionalChatMessage answer={withInitial} interactive onButtonClick={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:DEFAULT_WHATSAPP_SHARE_LABEL})).toBeNull();
  });
});
