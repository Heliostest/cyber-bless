import {Component,type ReactNode} from 'react';

/** Caught web render errors do not reach Expo Updates' native fatal handler. */
export class DomHealthBoundary extends Component<{onFailure():void;children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true}}
  componentDidCatch(){this.props.onFailure()}
  render(){return this.state.failed?null:this.props.children}
}
