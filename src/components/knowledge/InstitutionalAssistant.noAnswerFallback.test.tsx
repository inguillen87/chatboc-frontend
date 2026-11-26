import React from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {node,reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';

const mocks=vi.hoisted(()=>({fetch:vi.fn(),workspace:vi.fn()}));
vi.mock('@/utils/api',async importOriginal=>({
  ...await importOriginal<typeof import('@/utils/api')>(),
  apiFetch:(...args:unknown[])=>String(args[0]).includes('/institutional-assistant')?mocks.workspace(...args):mocks.fetch(...args),
}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:'qa-knowledge'})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));

import InstitutionalAssistant from './InstitutionalAssistant';
import {
  DEFAULT_OTHER_WAYS_LABEL,
  DEFAULT_REWRITE_QUESTION_LABEL,
  isInstitutionalContactAction,
  orderInstitutionalFallbackActions,
  resolveInstitutionalNoAnswerLabels,
} from './InstitutionalTextBlocks';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import {
  extractInstitutionalNoAnswerUi,
  institutionalChatBootstrapPayload,
  parseInstitutionalChatMessage,
  parseInstitutionalUnknownQuestionMessage,
} from '@/features/chat/institutionalChatMessage';
import {useChatLogic} from '@/hooks/useChatLogic';

const ACTIONS_WITH_CONTACT=[
  {code:'1',label:'Documentación y requisitos',target:'requirements'},
  {code:'2',label:'Turnos y horarios',target:'appointments'},
  {code:'3',label:'📞 Contactos útiles',target:'contactos'},
];

const ACTIONS_WITHOUT_CONTACT=[
  {code:'1',label:'Documentación y requisitos',target:'requirements'},
  {code:'2',label:'Turnos y horarios',target:'appointments'},
];

const publishedWorkspace=(
  actions=ACTIONS_WITH_CONTACT,
  uiOverrides:Record<string,string>={},
)=>{
  const base=structuredClone(workspace({visibility:'public',can_edit:false}));
  base.ui={...base.ui,...uiOverrides};
  base.knowledge!.initial.actions=actions;
  base.knowledge!.topics=actions.map(action=>({id:action.target,label:action.label}));
  return base;
};

const uncoveredReply=(w=publishedWorkspace())=>({
  ...reply('requirements',w),
  nodes:[],
  text:w.ui.unknown,
  selection_performed:true,
});

const submitQuestion=async(text:string)=>{
  const input=await screen.findByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:text}});
  input.focus();
  fireEvent.submit(input.closest('form')!);
};

beforeEach(()=>{
  mocks.fetch.mockReset();
  mocks.workspace.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({},'','/t/qa-knowledge');
});

afterEach(()=>{
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({},'','/');
});

describe('no-answer fallback pure helpers',()=>{
  it('detects contact and human-access options generically without hardcoding org IDs',()=>{
    expect(isInstitutionalContactAction({code:'1',label:'Contactos útiles',target:'node-a'})).toBe(true);
    expect(isInstitutionalContactAction({code:'2',label:'Hablar con una persona',target:'n42'})).toBe(true);
    expect(isInstitutionalContactAction({code:'3',label:'Atención humana',target:'soporte'})).toBe(true);
    expect(isInstitutionalContactAction({code:'4',label:'Canales de atención',target:'channels'})).toBe(true);
    expect(isInstitutionalContactAction({code:'5',label:'Oficinas',target:'contactos_generales'})).toBe(true);
    expect(isInstitutionalContactAction({code:'6',label:'Documentación y requisitos',target:'requirements'})).toBe(false);
    expect(isInstitutionalContactAction({code:'7',label:'Turnos y horarios',target:'appointments'})).toBe(false);
  });

  it('orders contact options first and does not invent one when absent',()=>{
    const withContact=orderInstitutionalFallbackActions(ACTIONS_WITH_CONTACT);
    expect(withContact.map(item=>item.action.target)).toEqual(['contactos','requirements','appointments']);
    expect(withContact.map(item=>item.isContact)).toEqual([true,false,false]);

    const withoutContact=orderInstitutionalFallbackActions(ACTIONS_WITHOUT_CONTACT);
    expect(withoutContact.map(item=>item.action.target)).toEqual(['requirements','appointments']);
    expect(withoutContact.every(item=>!item.isContact)).toBe(true);
  });

  it('resolves backend UI overrides and falls back only to the two fixed labels',()=>{
    expect(resolveInstitutionalNoAnswerLabels(undefined)).toEqual({
      otherWays:DEFAULT_OTHER_WAYS_LABEL,
      rewriteQuestion:DEFAULT_REWRITE_QUESTION_LABEL,
    });
    expect(resolveInstitutionalNoAnswerLabels({
      other_ways:'Opciones para continuar',
      rewrite_question:'Reformular mi pregunta',
    })).toEqual({
      otherWays:'Opciones para continuar',
      rewriteQuestion:'Reformular mi pregunta',
    });
  });
});

describe('no-answer fallback in InstitutionalAssistant (portal)',()=>{
  it('shows Otras formas de seguir with initial-menu topics, prioritizes contact first, focuses result text and refocuses input on rewrite',async()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT);
    mocks.workspace.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('button',{name:/Documentación y requisitos/});

    // An answer with nodes (start menu) never shows the no-answer block.
    expect(screen.queryByTestId('institutional-no-answer')).toBeNull();

    mocks.workspace.mockResolvedValueOnce(uncoveredReply(w));
    await submitQuestion('¿Hay un trámite que no figura en las guías?');

    const notice=await screen.findByText(w.ui.unknown);
    await waitFor(()=>expect(notice).toHaveFocus());

    const fallback=screen.getByTestId('institutional-no-answer');
    expect(fallback).toHaveAttribute('aria-live','polite');
    expect(fallback.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(within(fallback).getByRole('heading',{name:DEFAULT_OTHER_WAYS_LABEL})).toBeVisible();

    const topicButtons=Array.from(fallback.querySelectorAll<HTMLButtonElement>('[data-no-answer-actions] button'));
    expect(topicButtons).toHaveLength(3);
    expect(topicButtons[0]).toHaveAttribute('data-contact-action','true');
    expect(topicButtons[0]).toHaveTextContent(/Contactos útiles/);
    expect(topicButtons[1]).toHaveTextContent(/Documentación y requisitos/);
    expect(topicButtons[2]).toHaveTextContent(/Turnos y horarios/);

    // Clicking "Escribir la consulta de otra forma" returns focus to the textarea.
    const rewriteButton=within(fallback).getByRole('button',{name:DEFAULT_REWRITE_QUESTION_LABEL});
    fireEvent.click(rewriteButton);
    expect(screen.getByLabelText('Escribí tu consulta')).toHaveFocus();

    // Selecting a topic from the fallback opens that node and hides the fallback block.
    mocks.workspace.mockResolvedValueOnce(reply('requirements',w));
    fireEvent.click(topicButtons[1]);
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});
    expect(screen.queryByTestId('institutional-no-answer')).toBeNull();
  });

  it('does not invent a contact option when the published initial menu has none',async()=>{
    const w=publishedWorkspace(ACTIONS_WITHOUT_CONTACT);
    mocks.workspace.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('button',{name:/Documentación y requisitos/});

    mocks.workspace.mockResolvedValueOnce(uncoveredReply(w));
    await submitQuestion('Consulta sin cobertura de prueba');

    const fallback=await screen.findByTestId('institutional-no-answer');
    const topicButtons=Array.from(fallback.querySelectorAll<HTMLButtonElement>('[data-no-answer-actions] button'));
    expect(topicButtons).toHaveLength(2);
    expect(fallback.querySelector('[data-contact-action="true"]')).toBeNull();
    expect(topicButtons[0]).toHaveTextContent(/Documentación y requisitos/);
    expect(topicButtons[1]).toHaveTextContent(/Turnos y horarios/);
  });

  it('uses backend UI labels for the fallback block when supplied',async()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT,{
      other_ways:'Otras alternativas disponibles',
      rewrite_question:'Intentar con otras palabras',
    });
    mocks.workspace.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('button',{name:/Documentación y requisitos/});

    mocks.workspace.mockResolvedValueOnce(uncoveredReply(w));
    await submitQuestion('Consulta sin resultados');

    const fallback=await screen.findByTestId('institutional-no-answer');
    expect(within(fallback).getByRole('heading',{name:'Otras alternativas disponibles'})).toBeVisible();
    expect(within(fallback).getByRole('button',{name:'Intentar con otras palabras'})).toBeVisible();
  });

  it('does not show the fallback block when an answer returns nodes',async()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT);
    mocks.workspace.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    await screen.findByRole('button',{name:/Documentación y requisitos/});

    mocks.workspace.mockResolvedValueOnce(reply('requirements',w));
    await submitQuestion('¿Qué documentación necesito?');

    await screen.findByRole('heading',{name:'Requisitos de la consulta'});
    expect(screen.queryByTestId('institutional-no-answer')).toBeNull();
  });
});

describe('no-answer fallback in InstitutionalChatMessage and useChatLogic (widget)',()=>{
  it('renders Otras formas de seguir from a scoped unknown_question response, prioritizes contact, focuses result and refocuses input',async()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT);
    mocks.workspace.mockResolvedValueOnce(w);
    const hook=renderHook(()=>useChatLogic({tipoChat:'municipio',tenantSlug:'qa-knowledge',skipAuth:true,socketEnabled:false,autoInitEnabled:false}));
    await act(async()=>{await hook.result.current.initializeConversation({force:true});});

    const notice={
      fuente:'institutional_knowledge_unknown_question',
      knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
      context_revision:w.revision!,
      message_body:w.ui.unknown,
      botones:[],
    };
    mocks.fetch.mockResolvedValueOnce(notice);
    await act(async()=>{await hook.result.current.handleSend('Pregunta sin cobertura');});

    const lastMessage=hook.result.current.messages.at(-1)!;
    expect(lastMessage.institutional?.kind).toBe('unknown_question');

    const onButtonClick=vi.fn();
    const inputRef=React.createRef<HTMLInputElement>();
    render(<>
      <InstitutionalChatMessage
        answer={lastMessage.institutional!}
        onButtonClick={onButtonClick}
        onFocusInput={()=>inputRef.current?.focus()}
        interactive
      />
      <input ref={inputRef} aria-label="Escribí tu mensaje"/>
    </>);

    const card=screen.getByTestId('institutional-chat-message');
    const resultText=within(card).getByText(w.ui.unknown);
    await waitFor(()=>expect(resultText).toHaveFocus());

    const fallback=within(card).getByTestId('institutional-no-answer');
    expect(fallback).toHaveAttribute('aria-live','polite');
    expect(fallback.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(within(fallback).getByRole('heading',{name:DEFAULT_OTHER_WAYS_LABEL})).toBeVisible();

    const topicButtons=Array.from(fallback.querySelectorAll<HTMLButtonElement>('[data-no-answer-actions] button'));
    expect(topicButtons).toHaveLength(3);
    expect(topicButtons[0]).toHaveAttribute('data-contact-action','true');
    expect(topicButtons[0]).toHaveTextContent(/Contactos útiles/);
    expect(topicButtons[1]).toHaveTextContent(/Documentación y requisitos/);

    fireEvent.click(topicButtons[0]);
    expect(onButtonClick).toHaveBeenCalledWith({
      text:'📞 Contactos útiles',
      action:`knowledge:${w.revision!.slice(0,16)}:contactos`,
      action_id:`knowledge:${w.revision!.slice(0,16)}:contactos`,
      source:'button',
    });

    fireEvent.click(within(fallback).getByRole('button',{name:DEFAULT_REWRITE_QUESTION_LABEL}));
    expect(screen.getByLabelText('Escribí tu mensaje')).toHaveFocus();
  });

  it('does not invent a contact option in the widget when none exists in the initial menu',()=>{
    const w=publishedWorkspace(ACTIONS_WITHOUT_CONTACT);
    const parsed=parseInstitutionalUnknownQuestionMessage(
      {
        fuente:'institutional_knowledge_unknown_question',
        knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
        context_revision:w.revision!,
        message_body:w.ui.unknown,
        botones:[],
      },
      'qa-knowledge',
      {
        tenantId:w.tenant.id,
        tenantSlug:w.tenant.slug,
        revision:w.revision!,
        actions:ACTIONS_WITHOUT_CONTACT,
        ui:extractInstitutionalNoAnswerUi(w.ui),
      },
    )!;
    expect(parsed).not.toBeNull();

    render(<InstitutionalChatMessage answer={parsed} onButtonClick={vi.fn()} interactive/>);
    const fallback=screen.getByTestId('institutional-no-answer');
    const topicButtons=Array.from(fallback.querySelectorAll<HTMLButtonElement>('[data-no-answer-actions] button'));
    expect(topicButtons).toHaveLength(2);
    expect(fallback.querySelector('[data-contact-action="true"]')).toBeNull();
  });

  it('does not show the fallback block in the widget when the response has nodes',()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT);
    const answerNode=node('requirements');
    const payload={
      fuente:'institutional_knowledge',
      context_revision:w.revision!,
      knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
      knowledge_nodes:[answerNode],
      knowledge_sources:answerNode.sources,
      message_body:answerNode.text,
      botones:answerNode.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`})),
    };
    const parsed=parseInstitutionalChatMessage(payload,'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={parsed} onButtonClick={vi.fn()} interactive/>);
    expect(screen.queryByTestId('institutional-no-answer')).toBeNull();

    // Also verify initial menu payload (which has nodes) does not show the fallback block.
    const bootstrap=parseInstitutionalChatMessage(institutionalChatBootstrapPayload(w,'qa-knowledge'),'qa-knowledge')!;
    cleanup();
    render(<InstitutionalChatMessage answer={bootstrap} onButtonClick={vi.fn()} interactive/>);
    expect(screen.queryByTestId('institutional-no-answer')).toBeNull();
  });

  it('rejects unknown_question fallback binding across mismatched tenants or revisions',()=>{
    const w=publishedWorkspace(ACTIONS_WITH_CONTACT);
    const fallbackContext={
      tenantId:w.tenant.id,
      tenantSlug:w.tenant.slug,
      revision:w.revision!,
      actions:ACTIONS_WITH_CONTACT,
    };
    const validNotice={
      fuente:'institutional_knowledge_unknown_question',
      knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
      context_revision:w.revision!,
      message_body:w.ui.unknown,
      botones:[],
    };
    expect(parseInstitutionalUnknownQuestionMessage(validNotice,'other-org',fallbackContext)).toBeNull();
    expect(parseInstitutionalUnknownQuestionMessage({...validNotice,context_revision:'c'.repeat(64)},'qa-knowledge',fallbackContext)).toBeNull();
  });
});
