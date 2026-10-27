import { message } from './format';
// Type-only contract checks. This function is deliberately never invoked.
export function checkMessageArguments() {
  message('app.input.counter', { n: 12, max: 60 });
  message('app.language.label');
  // @ts-expect-error ICU counter requires numeric n.
  message('app.input.counter', { n: 'twelve', max: 60 });
  // @ts-expect-error ICU counter requires max.
  message('app.input.counter', { n: 12 });
  // @ts-expect-error Required ICU arguments cannot be omitted.
  message('app.input.counter');
}
