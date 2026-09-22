import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {SurveyCard} from './SurveyCard';
import {surveyCardFixture} from '../../../tests/fixtures/survey-card-actions';

afterEach(cleanup);
const show=(mode:'draft'|'live', title:string)=>{
  const survey={...surveyCardFixture(mode),titulo:title};
  const action=vi.fn().mockResolvedValue(undefined);
  return {survey,action,view:render(<MemoryRouter><SurveyCard survey={survey} tenantSlug="qa-a"
    onEdit={()=>{}} onAnalytics={()=>{}} onDelete={action} onClose={action}/></MemoryRouter>)};
};

describe('visible identity before destructive survey confirmation',()=>{
  it.each(['draft','live'] as const)('shows the actual %s title in the accessible description',mode=>{
    const title='Consulta recibida del backend';
    const {action}=show(mode,title);
    fireEvent.click(screen.getByRole('button',{name:mode==='draft'?'Borrar borrador':'Cerrar participación'}));
    const dialog=screen.getByRole('alertdialog');
    expect(within(dialog).getByTestId('survey-confirmation-identity')).toHaveTextContent(title);
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining(title));
    expect(action).not.toHaveBeenCalled();
  });
  it('renders a received markup-like title as text rather than HTML',()=>{
    const title='<img src=x onerror=alert(1)>';
    show('draft',title);
    fireEvent.click(screen.getByRole('button',{name:'Borrar borrador'}));
    const identity=within(screen.getByRole('alertdialog')).getByTestId('survey-confirmation-identity');
    expect(identity).toHaveTextContent(title);
    expect(identity.querySelector('img')).toBeNull();
  });
  it('does not truncate an identifier the operator must review',()=>{
    const title='IdentificadorExtenso'.repeat(40);
    show('live',title);
    fireEvent.click(screen.getByRole('button',{name:'Cerrar participación'}));
    const identity=within(screen.getByRole('alertdialog')).getByTestId('survey-confirmation-identity');
    expect(identity.textContent?.trim()).toBe(title);
    expect(identity.className).toContain('[overflow-wrap:anywhere]');
    expect(identity.className).not.toMatch(/line-clamp|truncate/);
  });
});
