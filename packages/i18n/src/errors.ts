import { sourceIndex } from './source-index.generated';
export type ErrorValues = Record<string, string | number>;
/** Retains the legacy diagnostic text while presentation uses a stable catalog code. */
export class ProductError extends Error {
  readonly code: string;
  readonly source: string;
  readonly values?: ErrorValues;
  constructor(source: string, values?: ErrorValues) {
    super(source.replace(/\{(\w+)\}/g, (match, key) => values && key in values ? String(values[key]) : match));
    this.name = 'ProductError';
    this.source = source; this.values = values;
    this.code = Object.hasOwn(sourceIndex, source) ? sourceIndex[source] : 'app.error.generic';
  }
}
export const productError = (source: string, values?: ErrorValues) => new ProductError(source, values);
