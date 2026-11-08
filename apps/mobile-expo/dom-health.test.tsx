// @vitest-environment jsdom
import {createElement} from 'react';
import {expect,it,vi} from 'vitest';
import {renderUI,settle} from '../../packages/app/src/dom-test-utils';
import {DomHealthBoundary} from './dom-health';

it('reports a DOM render failure once and removes the broken subtree',async()=>{
  const failure=vi.fn(),consoleError=vi.spyOn(console,'error').mockImplementation(()=>{});
  function Broken():never{throw Error('private render details')}
  const ui=renderUI(createElement(DomHealthBoundary,{onFailure:failure,children:createElement(Broken)}));
  try{await settle();expect(failure).toHaveBeenCalledOnce();expect(failure).toHaveBeenCalledWith();expect(ui.host.textContent).toBe('')}
  finally{ui.unmount();consoleError.mockRestore()}
});
