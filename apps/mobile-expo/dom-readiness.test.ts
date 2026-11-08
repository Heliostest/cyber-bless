import {afterEach,it,expect,vi} from 'vitest';
import {watchDomReadiness} from './dom-readiness';
afterEach(()=>vi.useRealTimers());
it('bounds a silent bootstrap failure without triggering an update request',()=>{
  vi.useFakeTimers();const fail=vi.fn();watchDomReadiness(fail);vi.advanceTimersByTime(29999);expect(fail).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(fail).toHaveBeenCalledOnce();
});
it('cancels the deadline when DOM is ready, backgrounded or replaced',()=>{
  vi.useFakeTimers();const fail=vi.fn();const stop=watchDomReadiness(fail);vi.advanceTimersByTime(1000);stop();vi.advanceTimersByTime(60000);expect(fail).not.toHaveBeenCalled();
});
