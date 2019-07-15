import React from 'react';
export interface IIdentificationContextProps {
    identification: string;
    eventEmitter: any;
    keepAlive: boolean;
    getLifecycle: () => number;
    isExisted: () => boolean;
    activated: boolean;
}
declare const WithKeepAliveContext: React.Context<IIdentificationContextProps>;
export default WithKeepAliveContext;
