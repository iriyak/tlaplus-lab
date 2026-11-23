# tlaplus-lab

TLA+ を手軽に試すための足場。`tla2tools.jar`(SANY / PlusCal トランスレータ / TLC)を、
CLI と MCP ツールの両方から同じ形で呼べるようにしたもの。bun + Java だけで動くので、
**Windows ネイティブ(Documents 配下など)でも WSL2 でも Linux でも**同じ手順で使える。

tlaplus の repo を clone する必要はない(リリースの jar だけで動く)。

## セットアップ

必要なもの: Java(OpenJDK 11 以上、`java -version` が通ること)、bun。

### Windows(PowerShell)

```powershell
cd $HOME\Documents\tlaplus-lab        # 展開した場所
bun install                            # MCP 用の依存(CLI だけなら不要)
mkdir lib -Force
curl.exe -fL -o lib\tla2tools.jar https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar
$env:Path += ";$PWD\bin"               # 恒久化するなら環境変数 Path に bin を追加
tla version
tla check examples\DieHard.tla         # 解(=不変条件違反)が見つかるのが正解
```

### WSL2 / Linux

```sh
cd ~/tlaplus-lab && bun install && make jar
export PATH=$PWD/bin:$PATH
tla check examples/DieHard.tla
```

PowerShell で `tla.ps1` が「スクリプトの実行が無効」と拒否されたら、一度だけ
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` を実行する。zip 由来で「ブロック」
表示が付いたファイルは `Get-ChildItem -Recurse | Unblock-File` で外せる。

OneDrive が Documents を同期している場合、`work/` や jar が同期対象になる。気になるなら
OneDrive 外(例 `C:\dev\tlaplus-lab`)に置く。パスに空白や日本語があっても動く設計だが、
未確認なら ASCII のパスが無難。

## CLI: `bin/tla`(実体は `bin/tla.ts`。PowerShell は `tla.ps1`、cmd.exe は `tla.cmd`、WSL2/Linux は `tla`)

| コマンド | 内容 |
|---|---|
| `tla version` | TLC のバージョン |
| `tla parse Spec.tla` | SANY で構文・レベル検査 |
| `tla pcal Spec.tla` | PlusCal を TLA+ に翻訳(同じファイルに挿入、`.old` を残す) |
| `tla check [--json] [--workers N] [--config F] Spec.tla [-- TLC引数]` | TLC でモデル検査 |
| `tla sim [--depth N] ...` | TLC のランダムシミュレーション |
| `tla put Name.tla\|Name.cfg` | 標準入力を `work/` に保存(MCP ツールが使う) |

`--json` の出力: `status`(`ok` / `invariant_violated` / `deadlock` / `liveness_violated` / …)、
`states_generated`、`distinct_states`、`depth`、反例の `trace`(状態ごとの変数値)。
終了コードは TLC のもの(0 成功、11 デッドロック、12 不変条件違反、13 活性違反)。

`.cfg` は spec と同名のものが自動で使われる。メタデータは一時ディレクトリに出すので
`states/` は散らからない。ヒープは `TLA_JAVA_OPTS`(既定 `-Xmx2g -XX:+UseParallelGC`)、jar は `TLA_JAR`、
java は `JAVA` / `JAVA_HOME` で指定できる。

## MCP ツール: `tlc`

`mcp/tlc-tool.ts` が `registerTlcTool(server)` を export している。local-mcp-server に
入れるときはこの 1 ファイルをコピーして登録するだけ(`zod` と MCP SDK は既存のものを使う)。
単体確認は:

```sh
bun run mcp/server.ts          # stdio。MCP Inspector から接続できる
bun run mcp/smoke-test.ts      # 一通りの動作確認
```

引数: `action`(`version` / `parse` / `pcal` / `check` / `sim`)、
spec は `spec`(lab 内のパス)か `module` + `source`(+ `cfg`)のインライン指定。
未翻訳の PlusCal を含むインライン spec は、`check` / `sim` の前に自動で翻訳される。

環境変数: `TLA_LAB`(lab のフォルダ。既定 `<ホーム>/tlaplus-lab`。Documents に置いたなら必ず指定)、
`TLA_WSL=1`(lab を WSL2 側に置いて `wsl.exe` 経由で呼ぶ。`TLA_LAB` は WSL 側のパス)、
`TLA_WSL_DISTRO`。

## サンプル

- `examples/DieHard.tla` — 水差しパズル。`NotSolved` の違反が解になる。最短は 7 ステップだが、
  workers が複数だと最短とは限らない(`--workers 1` で最短)
- `examples/RaceCounter.tla` — PlusCal。非アトミックな加算で lost update が起きる

## 既知の注意

- 取得される TLC は GitHub の最新リリース(2026-11-23 時点で 2.19)。
- SANY は標準モジュール(Naturals など)を一時フォルダに展開する。
- インライン spec の `MODULE` 名は `module` 引数と一致させる(TLC の要件)。
- Windows ネイティブでの実行は未検証(開発・テストは Linux のみ)。
