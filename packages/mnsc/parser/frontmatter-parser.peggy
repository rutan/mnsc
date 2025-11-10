{
  function toObject(pairs) {
    return Object.fromEntries(new Map(pairs));
  }
}

Start =
  _ pairs:(_ pair:FrontMatterPair _ { return pair; })*
  _ EOF {
    return toObject(pairs);
  }

FrontMatterPair = key:Identity _ ':' _ value:FrontMatterValue _ (Break / EOF) {
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

FrontMatterArrayItem = [ \t]+ '-' [ \t]+ value:FrontMatterValue _ (Break / EOF) {
  return value;
}

FrontMatterObject = Break pairs:FrontMatterObjectContent {
  return toObject(pairs);
}

FrontMatterObjectContent = pairs:FrontMatterObjectPair+ {
  return pairs;
}

FrontMatterObjectPair = [ \t]+ key:Identity _ ':' _ value:FrontMatterValue _ (Break / EOF) {
  return [key, value];
}

FrontMatterSimpleValue = chars:[^\r\n]+ { return chars.join("").trim(); }

// --------------------------------------------------------
// Shared literals
// --------------------------------------------------------

_ = [ \t]*;
Break = '\n' / '\r\n' / '\r';
EOF = !.;
Identity = chars:[a-zA-Z0-9_-]+ { return text(); }

NumberLiteral = FloatLiteral / IntegerLiteral

FloatLiteral = sign:('+' / '-')? n1:[0-9]+ '.' n2:[0-9]+ {
  return Number.parseFloat((sign || '') + n1.join('') + '.' + n2.join(''));
}

IntegerLiteral = sign:('+' / '-')? n:[0-9]+ {
  return Number.parseInt((sign || '') + n.join(''), 10);
}

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

BooleanLiteral = BooleanTrueLiteral / BooleanFalseLiteral
BooleanTrueLiteral = 'true' { return true; }
BooleanFalseLiteral = 'false' { return false; }

NullLiteral = 'null' { return null; }
