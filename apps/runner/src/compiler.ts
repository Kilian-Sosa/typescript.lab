import ts from 'typescript';
import declarations from './supported-lib.txt?raw';

type Checked =
  { status: 'ok'; javascript: string } | { status: 'compile-error' | 'policy-rejected'; diagnostics: string[] };
export function compile(source: string): Checked {
  const options: ts.CompilerOptions = {
    noLib: true,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    exactOptionalPropertyTypes: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  };
  const files = new Map([
    ['/learner.ts', source],
    ['/supported.d.ts', declarations],
  ]);
  const host: ts.CompilerHost = {
    getDefaultLibFileName: () => '/supported.d.ts',
    getSourceFile: (name, target) => {
      const text = files.get(name);
      return text === undefined ? undefined : ts.createSourceFile(name, text, target, true);
    },
    writeFile() {},
    getCurrentDirectory: () => '/',
    getDirectories: () => [],
    fileExists: (name) => files.has(name),
    readFile: (name) => files.get(name),
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
  const program = ts.createProgram([...files.keys()], options, host);
  const syntax = program.getSyntacticDiagnostics();
  const messages = (ds: readonly ts.Diagnostic[]) =>
    ds.slice(0, 20).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n').slice(0, 450));
  if (syntax.length) return { status: 'compile-error', diagnostics: messages(syntax) };
  let policy = false;
  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) ||
      ts.isImportEqualsDeclaration(node) ||
      ts.isImportTypeNode(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier) ||
      (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) ||
      (ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) ||
      ts.isAwaitExpression(node) ||
      ts.isYieldExpression(node) ||
      (ts.isFunctionLike(node) && 'asteriskToken' in node && node.asteriskToken) ||
      (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword))
    )
      policy = true;
    ts.forEachChild(node, visit);
  }
  visit(program.getSourceFile('/learner.ts')!);
  if (policy)
    return {
      status: 'policy-rejected',
      diagnostics: ['Only synchronous functions without imports or dependencies are supported.'],
    };
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length) return { status: 'compile-error', diagnostics: messages(diagnostics) };
  return {
    status: 'ok',
    javascript: ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
    }).outputText,
  };
}
