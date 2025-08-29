# VSCode MNSC Extension — 設計と実装計画

本ドキュメントは apps/vscode-mnsc に実装する VS Code 拡張の設計と実施プランをまとめたものです。前提は apps/vscode-mnsc/about.md の要件（シンタックスハイライト、入力補完、設定、generate-ids 連携）に基づきます。

## 概要
- 言語: `mnsc`、拡張子: `.mnsc`
- 目的: エディタでの快適な MNSC 執筆支援（色分け、補完、ID 付与、構文診断）
- 技術: VS Code Extension Host API（TextMate Grammar + Completion/Signature/Diagnostics）。将来は LSP も視野。

## 目標と非目標
- 目標
  - `.mnsc` のハイライトと基本補完を提供
  - `generate-ids` の操作（コマンド/保存時自動）
  - 軽量な構文エラーの診断
  - ユーザー設定で関数/話者/表情を拡張可能
- 非目標（初期）
  - フル LSP 実装、クロスファイル参照/インデックス作成
  - 高度な型検証やセマンティックハイライト

## 設計方針
- 拡張は最小構成から段階的に拡張（小さく始めて安全に）
- パーサは `@rutan/mnsc`（packages/mnsc）を直接利用
- ID 付与は `@rutan/mnsc-cli` の `insertIdsUsingLoc` 相当ロジックを Extension 側に移植（I/O のない純関数）
- TextMate Grammar でベースの色分け、将来的に必要なら LSP/semantic tokens へ昇格

## 提供機能
### シンタックスハイライト（TextMate）
- スコープ例
  - 行コメント: `// ...`
  - メッセージ ID: `#id:<identity>`
  - 関数呼び出し: `<<name(args)>>`
  - ブロック関数: `<<<name(args)>>> ... <<< /name >>>`
  - 会話テキスト: `speaker: face: 'smile'` と、インデントされた本文
  - フロントマター: 先頭 `---` ブロック（YAML 風）

### 入力補完/シグネチャ
- 関数名補完: `<<`/`<<<` 直後で `mnsc.functions[].name` を提示
- 引数キー補完: 括弧内で named 引数候補を提示（`mnsc.functions[].args`）
- Signature Help: 関数名 + 引数の簡易表示
- 話者名補完: 行頭の会話行で `mnsc.characters[].name`
- 表情補完: `face: '...'` 値で話者ごとの `faces`

### generate-ids 連携
- コマンド: `mnsc.generateIds`（アクティブドキュメント対象）
- 保存時自動実行: 設定で ON にし、`.mnsc` のみ対象
- ID 生成方式: `uuid` / `hash`（設定で選択、デフォルト `uuid`）
- 反映: `TextEdit` で差分適用（Undo 1 回で戻せる）

### 診断（Diagnostics）
- パーサで構文チェックし、エラー位置を DiagnosticsCollection に反映
- トリガー: 保存時／変更時デバウンス（小容量ファイル前提）

## 設定スキーマ
`package.json` の `contributes.configuration` で公開。例:

```jsonc
{
  "mnsc.functions": [
    { "name": "bg", "args": ["color", "duration"] },
    { "name": "playBgm", "args": [
      { "name": "id", "type": "string" },
      { "name": "loop", "type": "boolean" }
    ]}
  ],
  "mnsc.characters": [
    { "name": "rutan", "faces": ["smile", "sad", "angry"] },
    { "name": "hain", "faces": ["angry", "shy"] }
  ],
  "mnsc.generateIds.onSave": false,
  "mnsc.generateIds.format": "uuid" // or "hash"
}
```

## アーキテクチャ
- `src/extension.ts`: エントリ。言語登録、プロバイダ登録、コマンド登録
- `syntaxes/mnsc.tmLanguage.json`: TextMate Grammar
- `src/config.ts`: 設定の読込・監視（`workspace.getConfiguration('mnsc')`）
- `src/completions/*`: 補完/シグネチャの実装
- `src/ids/*`: ID 生成とテキスト編集適用（`insertIdsUsingLoc`）
- `src/diagnostics/*`: パースと Diagnostics 連携

## 実装計画（段階）
1) スキャフォールド
   - `package.json` に `contributes.languages`、`grammars`、`commands`、`configuration` 追加
   - `src/extension.ts` の骨格（activate/deactivate）
   - ビルド/開発スクリプト整備（tsup or esbuild）

2) 言語登録とハイライト
   - `mnsc.tmLanguage.json` の最小ルール（コメント、#id、関数、ブロック関数、会話）
   - サンプルで配色確認

3) 関数補完
   - `CompletionItemProvider` で `<<`/`<<<` 直後に関数候補
   - 括弧内では named 引数キーを候補に
   - `SignatureHelpProvider` で簡易シグネチャ

4) 会話補完
   - 会話行の話者名補完
   - `face:` 値で顔候補

5) generate-ids
   - `mnsc.generateIds` コマンド（アクティブエディタのテキストへ反映）
   - `onWillSaveTextDocument` で自動付与（設定依存、デバウンス）
   - 生成方式 `uuid`/`hash` 切替

6) 診断
   - `@rutan/mnsc` でパース、エラーを Diagnostics に変換
   - 変更時はデバウンス、保存時は即時

7) 仕上げ
   - README / about.md 更新、設定サンプル、スクリーンショット
   - examples/ と連携、最小 E2E 動作確認

## 依存関係とビルド
- 依存: `@rutan/mnsc`（必須）。`@rutan/mnsc-cli` はロジック参照のみ（I/O は拡張側）
- ビルド: `tsup` で ESM 向けバンドル（Node 18）
- ルートの `pnpm build`/`pnpm dev`/`pnpm lint`/`pnpm test` に統合

## パフォーマンスと UX 配慮
- パースは変更時に 200–400ms デバウンス、保存時は即時
- 大きなファイルでも ID 挿入は逆順適用でオフセット破綻回避
- すべての編集は `WorkspaceEdit` 経由で適用（Undo 一発）

## 検証計画
- ハイライト: fixtures の `.mnsc` を用いた目視確認
- 補完/シグネチャ: 設定変更による候補の変化を確認
- generate-ids: 生成結果の差分と Undo/Redo を確認
- 診断: 意図的なシンタックスエラーで位置とメッセージを確認

## 将来展望
- Language Server 化（補完/診断/コードアクションの強化）
- ワークスペース全体への generate-ids 適用、ウォッチャ統合
- セマンティックトークン、ドキュメントシンボル、コードアクション（ID 付与）

