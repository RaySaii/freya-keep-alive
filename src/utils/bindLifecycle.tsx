import React from 'react'
import hoistNonReactStatics from 'hoist-non-react-statics'
import noop from './noop'
import { warn } from './debug'
import { COMMAND } from './keepAliveDecorator'
import withIdentificationContextConsumer from './withIdentificationContextConsumer'
import getDisplayName from './getDisplayName'

export const bindLifecycleTypeName = '$$bindLifecycle'

export default function bindLifecycle<P = any>(Component: React.ComponentClass<P>) {
  const WrappedComponent = (Component as any).WrappedComponent || (Component as any).wrappedComponent || Component

  const {
    componentDidMount = noop,
    componentDidUpdate = noop,
    componentDidActivate = noop,
    componentWillUnactivate = noop,
    componentWillUnmount = noop,
    shouldComponentUpdate = noop,
  } = WrappedComponent.prototype

  let oldActivate = componentDidActivate
  let oldUnactivate = componentWillUnactivate

  let init = true


  componentDidActivate = function () {
    if (this.props._routerStore.status == 'activate' || init) {
      oldActivate()
      this.props._routerStore.status = ''
    }
  }

  componentWillUnactivate = function () {
    if (this.props._routerStore.status == 'unActivate') {
      oldUnactivate()
      this.props._routerStore.status = ''
    }
  }


  WrappedComponent.prototype.componentDidMount = function () {
    componentDidMount.call(this)
    this._needActivate = false
    const {
      _container: {
        identification,
        eventEmitter,
        activated,
      },
      keepAlive,
    } = this.props
    // Determine whether to execute the componentDidActivate life cycle of the current component based on the activation state of the KeepAlive components
    if (!activated && keepAlive !== false || init) {
      componentDidActivate.call(this)
      init = false
    }
    eventEmitter.on(
      [identification, COMMAND.ACTIVATE],
      this._bindActivate = () => this._needActivate = true,
      true,
    )
    eventEmitter.on(
      [identification, COMMAND.UNACTIVATE],
      this._bindUnactivate = () => {
        componentWillUnactivate.call(this)
        this._unmounted = false
      },
      true,
    )
    eventEmitter.on(
      [identification, COMMAND.UNMOUNT],
      this._bindUnmount = () => {
        componentWillUnmount.call(this)
        this._unmounted = true
      },
      true,
    )
  }

  // In order to be able to re-update after transferring the DOM, we need to block the first update.
  WrappedComponent.prototype.shouldComponentUpdate = function (...args: any) {
    if (this._needActivate) {
      this.forceUpdate()
      return false
    }
    return shouldComponentUpdate.call(this, ...args) || true
  }

  WrappedComponent.prototype.componentDidUpdate = function () {
    componentDidUpdate.call(this)
    if (this._needActivate) {
      this._needActivate = false
      componentDidActivate.call(this)
    }
  }
  WrappedComponent.prototype.componentWillUnmount = function () {
    if (!this._unmounted) {
      componentWillUnmount.call(this)
    }
    const {
      _container: {
        identification,
        eventEmitter,
      },
    } = this.props
    eventEmitter.off(
      [identification, COMMAND.ACTIVATE],
      this._bindActivate,
    )
    eventEmitter.off(
      [identification, COMMAND.UNACTIVATE],
      this._bindUnactivate,
    )
    eventEmitter.off(
      [identification, COMMAND.UNMOUNT],
      this._bindUnmount,
    )
  }

  const BindLifecycleHOC = withIdentificationContextConsumer(
    ({
       forwardRef,
       _identificationContextProps: {
         identification,
         eventEmitter,
         activated,
         keepAlive,
       },
       ...wrapperProps
     }) => {
      if (!identification) {
        warn('[React Keep Alive] You should not use bindLifecycle outside a <KeepAlive>.')
        return null
      }

      return (
        <Component
          {...wrapperProps}
          ref={forwardRef || noop}
          _container={{
            identification,
            eventEmitter,
            activated,
            keepAlive,
          }}
        />
      )
    },
  )
  const BindLifecycle = React.forwardRef((props: P, ref) => (
    <BindLifecycleHOC {...props} forwardRef={ref}/>
  ));

  (BindLifecycle as any).WrappedComponent = WrappedComponent
  BindLifecycle.displayName = `${bindLifecycleTypeName}(${getDisplayName(Component)})`
  return hoistNonReactStatics(
    BindLifecycle,
    Component,
  )
}
