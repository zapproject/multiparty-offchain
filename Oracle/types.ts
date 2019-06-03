export interface QueryEvent {
  queryId: string,
  query: string,
  endpoint: string,
  subscriber: string,
  endpointParams: string[],
  onchainSub: boolean
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
  response: string;
  signature: any;
}

export interface QuerySchema {
  params: string[],
  query: string,
  response: string[],
  getResponse: Function
}