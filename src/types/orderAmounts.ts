export type PublishedValueState = 'reported' | 'missing' | 'invalid' | 'conflicting';
export interface PublishedValue<T> { state: PublishedValueState; value: T | null }
export interface OrderAmountEvidence {
  total: PublishedValue<number>;
  currency: PublishedValue<string>;
}
export interface OrderItemAmountEvidence {
  quantity: PublishedValue<number>;
  price: PublishedValue<number>;
  subtotal: PublishedValue<number>;
  currency: PublishedValue<string>;
}
