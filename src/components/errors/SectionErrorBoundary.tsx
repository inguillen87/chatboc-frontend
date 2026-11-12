import React, {type ComponentType, type ErrorInfo, type ReactNode} from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import './sectionRecovery.css';

type ResetValue = string | number | boolean | null | undefined;
interface SectionErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void | Promise<unknown>;
  resetKeys?: readonly ResetValue[];
  fallbackAction?: ReactNode;
}
interface SectionErrorBoundaryState {
  hasError: boolean;
  retrying: boolean;
  retryFailed: boolean;
  keys: readonly ResetValue[];
  generation: number;
}
const keysChanged = (before: readonly ResetValue[], after: readonly ResetValue[]) =>
  before.length !== after.length || before.some((value,index) => !Object.is(value,after[index]));

class SectionErrorBoundaryImpl extends (React.Component as any)<SectionErrorBoundaryProps,SectionErrorBoundaryState> {
  private mounted = false;
  private requestId = 0;
  private pending: {id:number;generation:number} | null = null;
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = {hasError:false,retrying:false,retryFailed:false,keys:[...(props.resetKeys ?? [])],generation:0};
  }
  static getDerivedStateFromError(): Partial<SectionErrorBoundaryState> {
    return {hasError:true,retrying:false};
  }
  static getDerivedStateFromProps(props: SectionErrorBoundaryProps, state: SectionErrorBoundaryState) {
    const keys = props.resetKeys ?? [];
    return keysChanged(state.keys,keys)
      ? {keys:[...keys],generation:state.generation+1,hasError:false,retrying:false,retryFailed:false}
      : null;
  }
  componentDidMount() { this.mounted = true; }
  componentWillUnmount() { this.mounted = false; this.requestId += 1; this.pending = null; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SectionErrorBoundary captured an error',error,info);
  }
  handleRetry = async () => {
    const generation = this.state.generation;
    if (!this.mounted || !this.state.hasError || this.pending?.generation === generation) return;
    const id = ++this.requestId;
    this.pending = {id,generation};
    const current = () => this.mounted && this.requestId === id && this.state.generation === generation;
    this.setState({retrying:true,retryFailed:false});
    try {
      // Do not remount the failed subtree until its recovery callback has completed.
      await this.props.onRetry?.();
      if (current()) this.setState({hasError:false,retrying:false,retryFailed:false});
    } catch {
      if (current()) this.setState({hasError:true,retrying:false,retryFailed:true});
    } finally {
      if (this.pending?.id === id) this.pending = null;
    }
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    const title = this.props.title || 'No pudimos cargar esta sección';
    const description = this.props.description || 'El resto del panel sigue disponible. Podés volver a intentar cargar este bloque.';
    return <section className="section-recovery" aria-label={title}>
      <div className="section-recovery-card">
        <div className="section-recovery-icon"><AlertTriangle aria-hidden="true" size={24}/></div>
        <h2>{title}</h2>
        <p>{description}</p>
        <div role="status" aria-atomic="true" className="section-recovery-status">
          {this.state.retrying ? 'Recuperando la sección…' : this.state.retryFailed ? 'No se pudo recuperar la sección. Podés reintentar; no se recargó toda la aplicación.' : 'La sección necesita volver a cargarse.'}
        </div>
        <div className="section-recovery-actions">
          <Button type="button" disabled={this.state.retrying} onClick={()=>void this.handleRetry()}>
            <RefreshCw size={16} aria-hidden="true"/>{this.state.retrying ? 'Reintentando…' : 'Reintentar'}
          </Button>
          {this.props.fallbackAction ?? <a href="/">Ir al inicio</a>}
        </div>
        <p className="section-recovery-note">Reintentar reinicia este bloque. Un borrador dentro de la sección afectada puede perderse.</p>
      </div>
    </section>;
  }
}
export const SectionErrorBoundary = SectionErrorBoundaryImpl as unknown as ComponentType<SectionErrorBoundaryProps>;
export default SectionErrorBoundary;
