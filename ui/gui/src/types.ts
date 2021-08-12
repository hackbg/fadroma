export type State = {
  blobs: Record<number, Instance>;
};

export type Instance = {
  name: CodeName;
  codeHash: CodeHash;
  instances: Array<ContractLink>;
  schema: {
    init: CallSignature;
    handle: Record<string, CallSignature>;
    query: Record<string, CallSignature>;
  };
};

type CodeName = string;
type CodeId = number;
type CodeHash = string;

type ContractName = string;
type ContractAddr = string;
type ContractLink = {
  name: ContractName;
  address: ContractAddr;
  codeId: CodeId;
  codeHash: CodeHash;
};

type FieldName = string;
type WidgetType = string;
type CallSignature = Record<FieldName, WidgetType>;
