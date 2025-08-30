{
  function dedentLines(lines) {
    if (!lines?.length) return '';

    const indentations = lines
      .filter(line => line.trim())
      .map(line => line.search(/\S/));

    if (indentations.length === 0) return lines.join('\n');

    const minIndent = Math.min(...indentations);
    return minIndent === 0
      ? lines.join('\n')
      : lines.map(line => line.slice(minIndent)).join('\n');
  }

  function unwrapLiteral(value) {
    if (value && typeof value === 'object' && (
      value.type === 'number' ||
      value.type === 'string' ||
      value.type === 'boolean'
    )) {
      return value.value;
    }
    return value;
  }

  function constantFolding(expr) {
    switch (expr.type) {
      case 'logical':
        return foldLogical(expr);
      case 'comparison':
        return foldComparison(expr);
      case 'arithmetic':
        return foldArithmetic(expr);
    }
    return expr;
  }

  function foldLogical(expr) {
    if (expr.type !== 'logical') error('Invalid expression type');

    if (expr.left.type === 'boolean' && expr.right.type === 'boolean') {
      const leftVal = expr.left.value;
      const rightVal = expr.right.value;
      switch (expr.operator) {
        case '&&':
          return { type: 'boolean', value: leftVal && rightVal };
        case '||':
          return { type: 'boolean', value: leftVal || rightVal };
        default:
          // 未知の演算子はそのまま返す
          return expr;
      }
    }

    return expr;
  }

  function foldComparison(expr) {
    if (expr.type !== 'comparison') error('Invalid expression type');

    if (expr.left.type === 'number' && expr.right.type === 'number') {
      const leftVal = expr.left.value;
      const rightVal = expr.right.value;
      switch (expr.operator) {
        case '>=':
          return { type: 'boolean', value: leftVal >= rightVal };
        case '<=':
          return { type: 'boolean', value: leftVal <= rightVal };
        case '==':
          return { type: 'boolean', value: leftVal === rightVal };
        case '!=':
          return { type: 'boolean', value: leftVal !== rightVal };
        case '>':
          return { type: 'boolean', value: leftVal > rightVal };
        case '<':
          return { type: 'boolean', value: leftVal < rightVal };
        default:
          // 未知の演算子はそのまま返す
          return expr;
      }
    }

    return expr;
  }

  function foldArithmetic(expr) {
    if (expr.type !== 'arithmetic') error('Invalid expression type');

    if (expr.left.type === 'number' && expr.right.type === 'number') {
      const leftVal = expr.left.value;
      const rightVal = expr.right.value;
      switch (expr.operator) {
        case '+':
          return { type: 'number', value: leftVal + rightVal };
        case '-':
          return { type: 'number', value: leftVal - rightVal };
        case '*':
          return { type: 'number', value: leftVal * rightVal };
        case '/':
          if (rightVal === 0) {
            throw error('Division by zero is not allowed');
          }
          return { type: 'number', value: leftVal / rightVal };
        default:
          // 未知の演算子はそのまま返す
          return expr;
      }
    } else if (expr.left.type === 'string' && expr.right.type === 'string' && expr.operator === '+') {
      // 文字列の連結
      return { type: 'string', value: expr.left.value + expr.right.value };
    }

    return expr;
  }
}

Start =
  _ meta:FrontMatter?
  _ commands:(_ command:Command _ { return command; })*
  _ {
    const filteredCommands = commands.filter(Boolean);
    return {
      meta: meta ?? {},
      commands: filteredCommands
    };
  }

// --------------------------------------------------------
// FrontMatter
// --------------------------------------------------------

FrontMatter =
  '---' _ Break
  _ pairs:(_ f:FrontMatterPair _ { return f; })*
  _ '---' _ (Break / EOF) {
    return Object.fromEntries(new Map(pairs));
  }

FrontMatterPair = key:Identity _ ':' _ value:FrontMatterValue _ (Break / &'---') {
  return [key, value];
}

FrontMatterValue = FrontMatterArray / FrontMatterObject / FrontMatterScalar

FrontMatterScalar = value:(NumberLiteral / StringLiteral / BooleanLiteral / NullLiteral / FrontMatterSimpleValue) {
  return value;
}

FrontMatterArray = Break items:FrontMatterArrayContent {
  return items;
}

FrontMatterArrayContent = items:FrontMatterArrayItem+ {
  return items;
}

FrontMatterArrayItem = [ \t]+ '-' [ \t]+ value:FrontMatterValue _ (Break / &'---') {
  return value;
}

FrontMatterObject = Break pairs:FrontMatterObjectContent {
  return Object.fromEntries(pairs);
}

FrontMatterObjectContent = pairs:FrontMatterObjectPair+ {
  return pairs;
}

FrontMatterObjectPair = [ \t]+ key:Identity _ ':' _ value:FrontMatterValue _ (Break / &'---') {
  return [key, value];
}

FrontMatterSimpleValue = chars:[^\r\n]+ { return chars.join("").trim(); }

// --------------------------------------------------------
// Command
// --------------------------------------------------------

Command = Separator / LineComment / IfBlock / ChoicesBlock / BlockFunction / CallFunction / Label / TalkText / Text

Separator = BlankLine+ { return null; }

// 行コメント
LineComment = '//' Chars* (Break / EOF) { return null; }

// if構文
IfBlock =
  BlockFunctionPrefix 'if' '(' cond:ConditionalExpression ')' BlockFunctionSuffix EndOfLine
  children:BlockFunctionContent
  elsifParts:(
    _ BlockFunctionPrefix 'elsif' '(' elsifCond:ConditionalExpression ')' BlockFunctionSuffix EndOfLine
    elsifChildren:BlockFunctionContent {
      return {
        condition: elsifCond,
        children: elsifChildren
      };
    }
  )*
  elseItems:(
    _ BlockFunctionPrefix 'else' BlockFunctionSuffix EndOfLine
    elseChildren:BlockFunctionContent {
      return {
        children: elseChildren
      };
    }
  )?
  _ BlockFunctionPrefix '/' 'if' BlockFunctionSuffix EndOfLine {
    return {
      command: "if",
      args: [],
      branches: [
        {
          condition: cond,
          children
        },
        ...elsifParts,
        elseItems
      ].filter(Boolean),
      loc: location()
    };
  }

// ブロック関数
BlockFunction =
  BlockFunctionPrefix name:FunctionName '(' args:FunctionArgs ')' BlockFunctionSuffix EndOfLine
  children:BlockFunctionContent
  _ BlockFunctionPrefix '/' endName:FunctionName BlockFunctionSuffix EndOfLine {
    if (endName !== name) {
      error(`Block function end name "${endName}" does not match start name "${name}"`);
    }

    return {
      command: name,
      args: args || [],
      children: children,
      loc: location()
    };
  }

BlockFunctionPrefix = '<<<'
BlockFunctionSuffix = '>>>'

BlockFunctionContent = items:(item:BlockFunctionItem _ { return item; })* {
  return items.filter(Boolean);
}

BlockFunctionItem = !(_ BlockFunctionPrefix '/') command:Command { return command; }

ChoicesBlock =
  BlockFunctionPrefix 'choices' '(' args:FunctionArgs ')' BlockFunctionSuffix EndOfLine
  children:ChoicesBlockContent
  _ BlockFunctionPrefix '/' 'choices' BlockFunctionSuffix EndOfLine {
    return {
      command: 'choices',
      args: args || [],
      children,
      loc: location()
    };
  }

ChoicesBlockContent = items:(item:ChoiceItem _ { return item; })* {
  return items.filter(Boolean);
}

// 関数呼び出し
CallFunction = CallFunctionPrefix name:FunctionName '(' args:FunctionArgs ')' CallFunctionSuffix EndOfLine {
  return {
    command: name,
    args: args || [],
    loc: location()
  };
}
CallFunctionPrefix = '<<'
CallFunctionSuffix = '>>'

// ラベル
Label = '*' name:Identity EndOfLine {
  return {
    command: 'label',
    args: [name],
    loc: location()
  };
}

// 選択肢の要素（ChoicesBlock内でのみ有効）
ChoiceItem =
  _ idPart:('#id:' id:Identity EndOfLine)?
  _ '-' _ cond:ChoiceCondition? _ content:ChoiceContentAndLabel {
  const command = {
    command: 'item',
    args: [content.text],
    loc: location()
  };

  const options = cond ?? {};
  options.label = content.label;

  if (idPart) {
    command.id = idPart[1];
  }

  if (Object.keys(options).length > 0) {
    command.args.push(options);
  }

  return command;
}

ChoiceCondition = '[if(' _ condition:ConditionalExpression _ params:(',' _ p:NamedArgs { return p; })? _ ')]:' EndOfLine {
  return {
    condition,
    ...(params ?? {})
  };
}

// テキスト
Text =
  idPart:(_ '#id:' id:Identity EndOfLine { return id; })?
  lines:MessageLine+ {
    const command = {
      command: 'text',
      args: [dedentLines(lines)],
      loc: location()
    };
    if (idPart) command.id = idPart;

    return command;
  }

// 会話テキスト
TalkText =
  idPart:(_ '#id:' id:Identity EndOfLine { return id; })?
  name:TalkName ':' params:TalkParameters? Break
  lines:(TalkMessageLine)* {
    const command = {
      command: 'text',
      args: [
        lines.join('\n'),
        {
          name,
          ...(params ?? {})
        }
      ],
      loc: location()
    };
    if (idPart) command.id = idPart;

    return command;
  }

TalkName =
  StringLiteral // 名前内に `:` などを含む場合は文字列リテラルとして指定する
  / [^\r\n:]+ { return text(); }

TalkMessageLine = TalkIndent c:MessageLine { return c; }
TalkIndent = [ \t]+

// --------------------------------------------------------
// Conditional Expression Parser
// --------------------------------------------------------

ConditionalExpression = LogicalOrExpression

LogicalOrExpression =
  left:LogicalAndExpression rest:(_ '||' _ right:LogicalAndExpression { return right; })* {
    return rest.reduce((acc, right) => constantFolding({
      type: 'logical',
      operator: '||',
      left: acc,
      right: right
    }), left);
  }

LogicalAndExpression =
  left:ComparisonExpression rest:(_ '&&' _ right:ComparisonExpression { return right; })* {
    return rest.reduce((acc, right) => constantFolding({
      type: 'logical',
      operator: '&&',
      left: acc,
      right: right
    }), left);
  }

ComparisonExpression =
  left:ArithmeticExpression _ op:ComparisonOperator _ right:ArithmeticExpression {
    return constantFolding({
      type: 'comparison',
      operator: op,
      left: left,
      right: right
    });
  } /
  ArithmeticExpression

ComparisonOperator =
  '>=' { return '>='; }
  / '<=' { return '<='; }
  / '==' { return '=='; }
  / '!=' { return '!='; }
  / '>' { return '>'; }
  / '<' { return '<'; }

ArithmeticExpression =
  left:Term
  rest:(_ op:("+" / '-') _ right:Term { return {op, right}; })* {
    return rest.reduce((acc, {op, right}) => {
      return constantFolding({
        type: 'arithmetic',
        operator: op,
        left: acc,
        right: right
      });
    }, left);
  }

Term =
  left:Factor
  rest:(_ op:('*' / '/') _ right:Factor { return {op, right}; })* {
    return rest.reduce((acc, {op, right}) => {
      return constantFolding({
        type: 'arithmetic',
        operator: op,
        left: acc,
        right: right
      });
    }, left);
  }

Factor =
  '(' _ expr:ConditionalExpression _ ')' { return expr; } /
  VariableReferenceNode /
  LiteralNode

VariableReferenceNode = '$' name:VariableName {
  return {
    type: 'variable',
    name: name
  };
}

VariableName = first:[a-zA-Z_] rest:[a-zA-Z0-9_]* {
  return `${first}${rest.join('')}`;
}

LiteralNode =
  value:NumberLiteral {
    return {
      type: 'number',
      value: value
    };
  } /
  value:StringLiteral {
    return {
      type: 'string',
      value: value
    };
  } /
  value:BooleanLiteral {
    return {
      type: 'boolean',
      value: value
    };
  }

ChoiceContentAndLabel =
  text:(!('=>' / EndOfLine) c:. { return c; })+ _ '=>' _ '*' label:Identity EndOfLine {
    return { text: text.join("").trim(), label: label };
  } /
  lines:ChoiceContentLine+ label:ChoiceLabel? {
    const text = lines.join('\n').trim();
    if (!label) {
      error(`Choice item "${text}" must have a label (=> *labelName)`);
    }
    return { text: text, label: label };
  }

ChoiceContentLine =
  !(_ BlockFunctionPrefix '/')
  !ChoiceLabel
  !('#id:')
  !(_ '-')
  _ chars:(!EndOfLine c:. { return c; })+ EndOfLine {
    return chars.join("").trim();
  }

ChoiceLabel = _ '=>' _ '*' label:Identity EndOfLine {
  return label;
}

FunctionName = f1:[A-Za-z_] f2:[A-Za-z0-9_]* {
  return text();
}

FunctionArgs =
  __
  args:(
    // 位置引数＋名前付き引数
    positionalArgs:PositionalArgs __ ',' __ namedArgs:NamedArgs { return [...positionalArgs, namedArgs]; }
    // 位置引数のみ
    / positionalArgs:PositionalArgs { return positionalArgs; }
    // 名前付き引数のみ
    / namedArgs:NamedArgs { return [namedArgs]; }
  )?
  __ {
    return args;
  }

PositionalArgs =
  first:FunctionArgExpression rest:(__ ',' __ arg:FunctionArgExpression __ { return arg; })* {
    return [first, ...rest];
  }

NamedArgs =
  first:NamedArg rest:(__ ',' __ arg:NamedArg __ { return arg; })* {
    const result = {};
    [first, ...rest].forEach(arg => {
      result[arg.key] = arg.value;
    });
    return result;
  }

NamedArg = key:Identity ':' __ value:(FunctionArgExpression) {
  return { type: "named", key, value: value };
}

FunctionArgExpression = expr:ConditionalExpression &(__ (',' / ')' / EndOfLine)) {
  return unwrapLiteral(expr);
}

// パラメータ
TalkParameters = _ params:TalkParametersList _ {
  return params;
}

TalkParametersList =
  first:TalkParameter rest:(_ ',' _ param:TalkParameter _ { return param; })* {
    const result = {};
    [first, ...rest].forEach(param => {
      result[param.key] = param.value;
    });
    return result;
  }

TalkParameter = key:Identity _ ':' _ value:TalkParameterValue {
  return { key, value };
}

TalkParameterValue = StringLiteral / NumberLiteral / BooleanLiteral / NullLiteral

// Only exclude simple talk headers like `name:` from being consumed by Text lines
TalkHeader = [A-Za-z0-9_]+ ':'

MessageLine =
  !(_ (CallFunctionPrefix / BlockFunctionPrefix / '#id:' / '*' / '//' / TalkHeader))
  body:Chars
  EndOfLine { return body; }

// --------------------------------------------------------
// Utils
// --------------------------------------------------------

// 空白
_ = [ \t]*;

// 空白（改行を含む）
__ = [ \t\r\n]*;

// 空行 (空白のみの行 + 改行)
BlankLine = _ Break;

// 改行トークン
Break = '\n' / '\r\n' / '\r';

// 文字列
Chars = [^\r\n]+ { return text(); }

// ID値
Identity = chars:[a-zA-Z0-9_-]+ { return text(); }

// 終端
EOF = !.;

// 行末
EndOfLine = _ (Break / EOF)

// リテラル
Literal = StringLiteral / NumberLiteral / BooleanLiteral / NullLiteral

// 数値リテラル
NumberLiteral = FloatLiteral / IntegerLiteral

FloatLiteral = sign:('+' / '-')? n1:[0-9]+ '.' n2:[0-9]+ {
  return Number.parseFloat((sign || '') + n1.join('') + '.' + n2.join(''));
}

IntegerLiteral = sign:('+' / '-')? n:[0-9]+ {
  return Number.parseInt((sign || '') + n.join(''), 10);
}

// 文字列リテラル
StringLiteral = DoubleQuoteString / SingleQuoteString

DoubleQuoteString = '"' chars:DoubleQuoteChar* '"' {
  return chars.join("");
}

DoubleQuoteChar =
  '\\' esc:EscapeSequence { return esc; }
  / !["\\] . { return text(); }

SingleQuoteString = "'" chars:SingleQuoteChar* "'" {
  return chars.join("");
}

SingleQuoteChar =
  '\\' esc:EscapeSequence { return esc; }
  / [^'\\] { return text(); }

EscapeSequence =
  c:(
    'n' / 'r' / 't' / '"' / "'" / '\\' / 'b' / 'f'
  ) {
    const map = {
      n: '\n',
      r: '\r',
      t: '\t',
      '"': '"',
      "'": "'",
      '\\': '\\',
      b: '\b',
      f: '\f'
    };
    return map[c] ?? c;
  }

// 真偽値リテラル
BooleanLiteral = BooleanTrueLiteral / BooleanFalseLiteral
BooleanTrueLiteral = 'true' { return true; }
BooleanFalseLiteral = 'false' { return false; }

// nullリテラル
NullLiteral = 'null' { return null; }
