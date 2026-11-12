import {describe, expect, it} from 'vitest';
import type {SurveyAdmin} from '@/types/encuestas';
import {surveyCardMetrics, surveyCountLabel, surveyCoverageLabel, surveyDateLabel} from './surveyCardPresentation';
const item = (data: Record<string, unknown>) => data as unknown as SurveyAdmin;
describe('survey metric presentation', () => {
  it('distinguishes absent metrics from measured zero', () => {
    expect(surveyCardMetrics(item({}))).toMatchObject({responses:null,uniqueParticipants:null,responsesLast24h:null,territorialCoverage:null});
    expect(surveyCountLabel(null)).toBe('No informado');
    expect(surveyCardMetrics(item({metricas:{total_respuestas:0}})).responses).toBe(0);
    expect(surveyCountLabel(0)).toBe('0');
  });
  it.each([-1,NaN,Infinity,1.5,'12',null])('does not present invalid counts as observations: %s',value=>{
    expect(surveyCardMetrics(item({metricas:{total_respuestas:value}})).responses).toBeNull();
  });
  it('does not replace an explicitly invalid authoritative count with an older number',()=>{
    const model=surveyCardMetrics(item({admin_lifecycle:{participation:{responses:null}},metricas:{total_respuestas:24}}));
    expect(model.responses).toBeNull();
  });
  it('preserves authoritative zero over a legacy value',()=>{
    expect(surveyCardMetrics(item({admin_lifecycle:{participation:{responses:0}},metricas:{total_respuestas:24}})).responses).toBe(0);
  });
  it('does not clamp contradictory coverage to 100 percent',()=>{
    expect(surveyCardMetrics(item({metricas:{total_respuestas:10,respuestas_con_coordenadas:12}}))).toMatchObject({territorialCoverage:null,contradictoryCoverage:true});
  });
  it('does not divide by zero when no responses exist',()=>{
    expect(surveyCardMetrics(item({metricas:{total_respuestas:0,respuestas_con_coordenadas:0}})).territorialCoverage).toBeNull();
  });
  it('preserves the reported base and a fractional percentage',()=>{
    const model=surveyCardMetrics(item({metricas:{total_respuestas:200,respuestas_con_coordenadas:1}}));
    expect(model.territorialCoverage).toBe(.5);expect(surveyCoverageLabel(.5)).toBe('0,5');
  });
  it('keeps an explicit coordinate count of zero',()=>{
    expect(surveyCardMetrics(item({metricas:{total_respuestas:8,respuestas_con_coordenadas:0}})).territorialCoverage).toBe(0);
  });
  it('does not show invalid date text as a real date',()=>{
    expect(surveyDateLabel('not-a-date')).toBe('Fecha no verificable');
    expect(surveyDateLabel(null)).toBe('Sin fecha');
  });
});
