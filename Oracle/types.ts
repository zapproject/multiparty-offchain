export interface QueryEvent {
  queryId: string,
  query: string,
  endpoint: string,
  subscriber: string,
  endpointParams: string[],
  onchainSub: boolean
}

export interface ResponseEvent {
  queryId: string,
  response: string,
  publicKey: string
}

export interface EndpointSchema {
  name: string,
  curve: number[],
  queryList: QuerySchema[]
}

export interface QuerySchema {
  params: string[],
  query: string,
  response: string[],
  getResponse: Function
}