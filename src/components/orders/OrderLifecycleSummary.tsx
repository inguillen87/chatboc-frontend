import React, { useId } from 'react';
import { CreditCard, Package, Truck, Info } from 'lucide-react';
import { orderLifecycle } from '@/features/orders/orderLifecycle';
import './orderLifecycle.css';

export function OrderLifecycleSummary({ order, compact = false }: { order: unknown; compact?: boolean }) {
  const model = orderLifecycle(order), id = useId();
  return <section className={`order-lifecycle ${compact ? 'is-compact' : ''}`} aria-labelledby={id}>
    <header><h2 id={id}>Estado del pedido, pago y entrega</h2>
      {!compact && <p>Cada estado se informa por separado. Confirmar o entregar un pedido no demuestra que esté pagado.</p>}
    </header>
    <dl>{([
      { title: 'Pedido', value: model.order, Icon: Package },
      { title: 'Pago', value: model.payment, Icon: CreditCard },
      { title: 'Entrega', value: model.delivery, Icon: Truck },
    ]).map(({ title, value, Icon }) => <div key={title} className={`order-lifecycle-signal is-${value.tone}`}>
      <dt><Icon size={18} aria-hidden="true" />{title}</dt>
      <dd><strong>{value.label}</strong>{!compact && <span>{value.source || 'Sin información independiente en esta respuesta.'}</span>}</dd>
    </div>)}</dl>
    {model.attention.length > 0 && <div className="order-lifecycle-attention"><Info size={18} aria-hidden="true" /><div>{model.attention.map((item) => <p key={item}>{item}</p>)}</div></div>}
  </section>;
}
