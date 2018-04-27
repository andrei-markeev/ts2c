import * as ts from 'typescript';

/*
Code that was used to generate type guards:

Object.keys(ts.SyntaxKind).filter(n => isNaN(+n)).map(s => `export function ${s}(n): n is ts.${s} {
    return n && n.kind == ts.SyntaxKind.${s};
}`).join('\n\n');

*/



export function NumericLiteral(n): n is ts.NumericLiteral {
    return n && n.kind == ts.SyntaxKind.NumericLiteral;
}

export function StringLiteral(n): n is ts.StringLiteral {
    return n && n.kind == ts.SyntaxKind.StringLiteral;
}

export function JsxText(n): n is ts.JsxText {
    return n && n.kind == ts.SyntaxKind.JsxText;
}

export function RegularExpressionLiteral(n): n is ts.RegularExpressionLiteral {
    return n && n.kind == ts.SyntaxKind.RegularExpressionLiteral;
}

export function NoSubstitutionTemplateLiteral(n): n is ts.NoSubstitutionTemplateLiteral {
    return n && n.kind == ts.SyntaxKind.NoSubstitutionTemplateLiteral;
}

export function TemplateHead(n): n is ts.TemplateHead {
    return n && n.kind == ts.SyntaxKind.TemplateHead;
}

export function TemplateMiddle(n): n is ts.TemplateMiddle {
    return n && n.kind == ts.SyntaxKind.TemplateMiddle;
}

export function TemplateTail(n): n is ts.TemplateTail {
    return n && n.kind == ts.SyntaxKind.TemplateTail;
}

export function Identifier(n): n is ts.Identifier {
    return n && n.kind == ts.SyntaxKind.Identifier;
}

export function QualifiedName(n): n is ts.QualifiedName {
    return n && n.kind == ts.SyntaxKind.QualifiedName;
}

export function ComputedPropertyName(n): n is ts.ComputedPropertyName {
    return n && n.kind == ts.SyntaxKind.ComputedPropertyName;
}

export function Decorator(n): n is ts.Decorator {
    return n && n.kind == ts.SyntaxKind.Decorator;
}

export function PropertySignature(n): n is ts.PropertySignature {
    return n && n.kind == ts.SyntaxKind.PropertySignature;
}

export function PropertyDeclaration(n): n is ts.PropertyDeclaration {
    return n && n.kind == ts.SyntaxKind.PropertyDeclaration;
}

export function MethodSignature(n): n is ts.MethodSignature {
    return n && n.kind == ts.SyntaxKind.MethodSignature;
}

export function MethodDeclaration(n): n is ts.MethodDeclaration {
    return n && n.kind == ts.SyntaxKind.MethodDeclaration;
}

export function ObjectBindingPattern(n): n is ts.ObjectBindingPattern {
    return n && n.kind == ts.SyntaxKind.ObjectBindingPattern;
}

export function ArrayBindingPattern(n): n is ts.ArrayBindingPattern {
    return n && n.kind == ts.SyntaxKind.ArrayBindingPattern;
}

export function BindingElement(n): n is ts.BindingElement {
    return n && n.kind == ts.SyntaxKind.BindingElement;
}

export function ArrayLiteralExpression(n): n is ts.ArrayLiteralExpression {
    return n && n.kind == ts.SyntaxKind.ArrayLiteralExpression;
}

export function ObjectLiteralExpression(n): n is ts.ObjectLiteralExpression {
    return n && n.kind == ts.SyntaxKind.ObjectLiteralExpression;
}

export function PropertyAccessExpression(n): n is ts.PropertyAccessExpression {
    return n && n.kind == ts.SyntaxKind.PropertyAccessExpression;
}

export function ElementAccessExpression(n): n is ts.ElementAccessExpression {
    return n && n.kind == ts.SyntaxKind.ElementAccessExpression;
}

export function CallExpression(n): n is ts.CallExpression {
    return n && n.kind == ts.SyntaxKind.CallExpression;
}

export function NewExpression(n): n is ts.NewExpression {
    return n && n.kind == ts.SyntaxKind.NewExpression;
}

export function TaggedTemplateExpression(n): n is ts.TaggedTemplateExpression {
    return n && n.kind == ts.SyntaxKind.TaggedTemplateExpression;
}

export function ParenthesizedExpression(n): n is ts.ParenthesizedExpression {
    return n && n.kind == ts.SyntaxKind.ParenthesizedExpression;
}

export function FunctionExpression(n): n is ts.FunctionExpression {
    return n && n.kind == ts.SyntaxKind.FunctionExpression;
}

export function ArrowFunction(n): n is ts.ArrowFunction {
    return n && n.kind == ts.SyntaxKind.ArrowFunction;
}

export function DeleteExpression(n): n is ts.DeleteExpression {
    return n && n.kind == ts.SyntaxKind.DeleteExpression;
}

export function VoidExpression(n): n is ts.VoidExpression {
    return n && n.kind == ts.SyntaxKind.VoidExpression;
}

export function AwaitExpression(n): n is ts.AwaitExpression {
    return n && n.kind == ts.SyntaxKind.AwaitExpression;
}

export function PrefixUnaryExpression(n): n is ts.PrefixUnaryExpression {
    return n && n.kind == ts.SyntaxKind.PrefixUnaryExpression;
}

export function PostfixUnaryExpression(n): n is ts.PostfixUnaryExpression {
    return n && n.kind == ts.SyntaxKind.PostfixUnaryExpression;
}

export function BinaryExpression(n): n is ts.BinaryExpression {
    return n && n.kind == ts.SyntaxKind.BinaryExpression;
}

export function ConditionalExpression(n): n is ts.ConditionalExpression {
    return n && n.kind == ts.SyntaxKind.ConditionalExpression;
}

export function TemplateExpression(n): n is ts.TemplateExpression {
    return n && n.kind == ts.SyntaxKind.TemplateExpression;
}

export function YieldExpression(n): n is ts.YieldExpression {
    return n && n.kind == ts.SyntaxKind.YieldExpression;
}

export function SpreadElement(n): n is ts.SpreadElement {
    return n && n.kind == ts.SyntaxKind.SpreadElement;
}

export function ClassExpression(n): n is ts.ClassExpression {
    return n && n.kind == ts.SyntaxKind.ClassExpression;
}

export function OmittedExpression(n): n is ts.OmittedExpression {
    return n && n.kind == ts.SyntaxKind.OmittedExpression;
}

export function AsExpression(n): n is ts.AsExpression {
    return n && n.kind == ts.SyntaxKind.AsExpression;
}

export function NonNullExpression(n): n is ts.NonNullExpression {
    return n && n.kind == ts.SyntaxKind.NonNullExpression;
}

export function MetaProperty(n): n is ts.MetaProperty {
    return n && n.kind == ts.SyntaxKind.MetaProperty;
}

export function TemplateSpan(n): n is ts.TemplateSpan {
    return n && n.kind == ts.SyntaxKind.TemplateSpan;
}

export function SemicolonClassElement(n): n is ts.SemicolonClassElement {
    return n && n.kind == ts.SyntaxKind.SemicolonClassElement;
}

export function Block(n): n is ts.Block {
    return n && n.kind == ts.SyntaxKind.Block;
}

export function VariableStatement(n): n is ts.VariableStatement {
    return n && n.kind == ts.SyntaxKind.VariableStatement;
}

export function EmptyStatement(n): n is ts.EmptyStatement {
    return n && n.kind == ts.SyntaxKind.EmptyStatement;
}

export function ExpressionStatement(n): n is ts.ExpressionStatement {
    return n && n.kind == ts.SyntaxKind.ExpressionStatement;
}

export function IfStatement(n): n is ts.IfStatement {
    return n && n.kind == ts.SyntaxKind.IfStatement;
}

export function DoStatement(n): n is ts.DoStatement {
    return n && n.kind == ts.SyntaxKind.DoStatement;
}

export function WhileStatement(n): n is ts.WhileStatement {
    return n && n.kind == ts.SyntaxKind.WhileStatement;
}

export function ForStatement(n): n is ts.ForStatement {
    return n && n.kind == ts.SyntaxKind.ForStatement;
}

export function ForInStatement(n): n is ts.ForInStatement {
    return n && n.kind == ts.SyntaxKind.ForInStatement;
}

export function ForOfStatement(n): n is ts.ForOfStatement {
    return n && n.kind == ts.SyntaxKind.ForOfStatement;
}

export function ContinueStatement(n): n is ts.ContinueStatement {
    return n && n.kind == ts.SyntaxKind.ContinueStatement;
}

export function BreakStatement(n): n is ts.BreakStatement {
    return n && n.kind == ts.SyntaxKind.BreakStatement;
}

export function ReturnStatement(n): n is ts.ReturnStatement {
    return n && n.kind == ts.SyntaxKind.ReturnStatement;
}

export function WithStatement(n): n is ts.WithStatement {
    return n && n.kind == ts.SyntaxKind.WithStatement;
}

export function SwitchStatement(n): n is ts.SwitchStatement {
    return n && n.kind == ts.SyntaxKind.SwitchStatement;
}

export function LabeledStatement(n): n is ts.LabeledStatement {
    return n && n.kind == ts.SyntaxKind.LabeledStatement;
}

export function ThrowStatement(n): n is ts.ThrowStatement {
    return n && n.kind == ts.SyntaxKind.ThrowStatement;
}

export function TryStatement(n): n is ts.TryStatement {
    return n && n.kind == ts.SyntaxKind.TryStatement;
}

export function DebuggerStatement(n): n is ts.DebuggerStatement {
    return n && n.kind == ts.SyntaxKind.DebuggerStatement;
}

export function VariableDeclaration(n): n is ts.VariableDeclaration {
    return n && n.kind == ts.SyntaxKind.VariableDeclaration;
}

export function VariableDeclarationList(n): n is ts.VariableDeclarationList {
    return n && n.kind == ts.SyntaxKind.VariableDeclarationList;
}

export function FunctionDeclaration(n): n is ts.FunctionDeclaration {
    return n && n.kind == ts.SyntaxKind.FunctionDeclaration;
}

export function ClassDeclaration(n): n is ts.ClassDeclaration {
    return n && n.kind == ts.SyntaxKind.ClassDeclaration;
}

export function InterfaceDeclaration(n): n is ts.InterfaceDeclaration {
    return n && n.kind == ts.SyntaxKind.InterfaceDeclaration;
}

export function EnumDeclaration(n): n is ts.EnumDeclaration {
    return n && n.kind == ts.SyntaxKind.EnumDeclaration;
}

export function ModuleDeclaration(n): n is ts.ModuleDeclaration {
    return n && n.kind == ts.SyntaxKind.ModuleDeclaration;
}

export function ModuleBlock(n): n is ts.ModuleBlock {
    return n && n.kind == ts.SyntaxKind.ModuleBlock;
}

export function CaseBlock(n): n is ts.CaseBlock {
    return n && n.kind == ts.SyntaxKind.CaseBlock;
}

export function NamespaceExportDeclaration(n): n is ts.NamespaceExportDeclaration {
    return n && n.kind == ts.SyntaxKind.NamespaceExportDeclaration;
}

export function ImportEqualsDeclaration(n): n is ts.ImportEqualsDeclaration {
    return n && n.kind == ts.SyntaxKind.ImportEqualsDeclaration;
}

export function ImportDeclaration(n): n is ts.ImportDeclaration {
    return n && n.kind == ts.SyntaxKind.ImportDeclaration;
}

export function ImportClause(n): n is ts.ImportClause {
    return n && n.kind == ts.SyntaxKind.ImportClause;
}

export function NamespaceImport(n): n is ts.NamespaceImport {
    return n && n.kind == ts.SyntaxKind.NamespaceImport;
}

export function NamedImports(n): n is ts.NamedImports {
    return n && n.kind == ts.SyntaxKind.NamedImports;
}

export function ImportSpecifier(n): n is ts.ImportSpecifier {
    return n && n.kind == ts.SyntaxKind.ImportSpecifier;
}

export function ExportAssignment(n): n is ts.ExportAssignment {
    return n && n.kind == ts.SyntaxKind.ExportAssignment;
}

export function ExportDeclaration(n): n is ts.ExportDeclaration {
    return n && n.kind == ts.SyntaxKind.ExportDeclaration;
}

export function NamedExports(n): n is ts.NamedExports {
    return n && n.kind == ts.SyntaxKind.NamedExports;
}

export function ExportSpecifier(n): n is ts.ExportSpecifier {
    return n && n.kind == ts.SyntaxKind.ExportSpecifier;
}

export function MissingDeclaration(n): n is ts.MissingDeclaration {
    return n && n.kind == ts.SyntaxKind.MissingDeclaration;
}

export function ExternalModuleReference(n): n is ts.ExternalModuleReference {
    return n && n.kind == ts.SyntaxKind.ExternalModuleReference;
}

export function JsxElement(n): n is ts.JsxElement {
    return n && n.kind == ts.SyntaxKind.JsxElement;
}

export function JsxSelfClosingElement(n): n is ts.JsxSelfClosingElement {
    return n && n.kind == ts.SyntaxKind.JsxSelfClosingElement;
}

export function JsxOpeningElement(n): n is ts.JsxOpeningElement {
    return n && n.kind == ts.SyntaxKind.JsxOpeningElement;
}

export function JsxClosingElement(n): n is ts.JsxClosingElement {
    return n && n.kind == ts.SyntaxKind.JsxClosingElement;
}

export function JsxAttribute(n): n is ts.JsxAttribute {
    return n && n.kind == ts.SyntaxKind.JsxAttribute;
}

export function JsxAttributes(n): n is ts.JsxAttributes {
    return n && n.kind == ts.SyntaxKind.JsxAttributes;
}

export function JsxSpreadAttribute(n): n is ts.JsxSpreadAttribute {
    return n && n.kind == ts.SyntaxKind.JsxSpreadAttribute;
}

export function JsxExpression(n): n is ts.JsxExpression {
    return n && n.kind == ts.SyntaxKind.JsxExpression;
}

export function CaseClause(n): n is ts.CaseClause {
    return n && n.kind == ts.SyntaxKind.CaseClause;
}

export function DefaultClause(n): n is ts.DefaultClause {
    return n && n.kind == ts.SyntaxKind.DefaultClause;
}

export function HeritageClause(n): n is ts.HeritageClause {
    return n && n.kind == ts.SyntaxKind.HeritageClause;
}

export function CatchClause(n): n is ts.CatchClause {
    return n && n.kind == ts.SyntaxKind.CatchClause;
}

export function PropertyAssignment(n): n is ts.PropertyAssignment {
    return n && n.kind == ts.SyntaxKind.PropertyAssignment;
}

export function ShorthandPropertyAssignment(n): n is ts.ShorthandPropertyAssignment {
    return n && n.kind == ts.SyntaxKind.ShorthandPropertyAssignment;
}

export function SpreadAssignment(n): n is ts.SpreadAssignment {
    return n && n.kind == ts.SyntaxKind.SpreadAssignment;
}

export function EnumMember(n): n is ts.EnumMember {
    return n && n.kind == ts.SyntaxKind.EnumMember;
}

export function SourceFile(n): n is ts.SourceFile {
    return n && n.kind == ts.SyntaxKind.SourceFile;
}

export function Bundle(n): n is ts.Bundle {
    return n && n.kind == ts.SyntaxKind.Bundle;
}


export function SyntaxList(n): n is ts.SyntaxList {
    return n && n.kind == ts.SyntaxKind.SyntaxList;
}

export function NotEmittedStatement(n): n is ts.NotEmittedStatement {
    return n && n.kind == ts.SyntaxKind.NotEmittedStatement;
}

export function PartiallyEmittedExpression(n): n is ts.PartiallyEmittedExpression {
    return n && n.kind == ts.SyntaxKind.PartiallyEmittedExpression;
}

