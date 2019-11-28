export interface QueryEvent {
  queryId: string,
  mpoId: string;
  query: string,
  endpoint: string,
  subscriber: string,
  provider: string;
  endpointParams: string[],
  onchainSubscriber: boolean,
  threshold: number
}

interface Signature {
  r: {
    type: string;
    data: Array<any>;
  },
  s: {
    type: string;
    data: Array<any>;
  },
  v: number;
}
export interface ResponseEvent {
  queryId: string;
  mpoId: string;
  response: string;
  signature: any;
}

export interface QuerySchema {
  params: string[],
  query: string,
  response: string[],
  getResponse: Function
}