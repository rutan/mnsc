export type Mnsc = {
  meta: Record<string, unknown>;
  commands: Command[];
};

export type Command = TextCommand | LabelCommand | ItemCommand | IfCommand | BlockCommand | BaseCommand;

export interface BaseCommand {
  id?: string;
  command: string;
  args: unknown[];
  loc?: Location;
}

export interface TextCommand extends BaseCommand {
  command: 'text';
  args: [string] | [string, { name?: string; [key: string]: unknown }];
}

export interface LabelCommand extends BaseCommand {
  command: 'label';
  args: [string];
}

export interface ItemCommand extends BaseCommand {
  command: 'item';
  args: [
    string,
    {
      label: string;
      condition?: Expression;
      alwaysVisible?: boolean;
      [key: string]: unknown;
    },
  ];
}

export interface IfCommand extends BaseCommand {
  command: 'if';
  args: [];
  branches: IfBranch[];
}

export interface IfBranch {
  condition?: Expression;
  children: Command[];
}

export interface BlockCommand extends BaseCommand {
  children: Command[];
}

export interface Location {
  start: {
    offset: number;
    line: number;
    column: number;
  };
  end: {
    offset: number;
    line: number;
    column: number;
  };
}

export type Expression =
  | VariableReference
  | LiteralValue
  | ArithmeticExpression
  | ComparisonExpression
  | LogicalExpression
  | number
  | string
  | boolean;

export interface VariableReference {
  type: 'variable';
  name: string;
}

export interface NumberLiteral {
  type: 'number';
  value: number;
}

export interface StringLiteral {
  type: 'string';
  value: string;
}

export interface BooleanLiteral {
  type: 'boolean';
  value: boolean;
}

export type LiteralValue = NumberLiteral | StringLiteral | BooleanLiteral;

export interface ArithmeticExpression {
  type: 'arithmetic';
  operator: '+' | '-' | '*' | '/';
  left: Expression;
  right: Expression;
}

export interface ComparisonExpression {
  type: 'comparison';
  operator: '>=' | '<=' | '==' | '!=' | '>' | '<';
  left: Expression;
  right: Expression;
}

export interface LogicalExpression {
  type: 'logical';
  operator: '&&' | '||';
  left: Expression;
  right: Expression;
}
