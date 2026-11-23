# specs

自分の実験用の spec を置く場所。`examples/` は配布用のサンプルなので、手を入れたり増やしたりはここで行う。

## 置き方

1 トピック 1 フォルダ。spec と設定ファイルを同じフォルダに置く。

```
specs/<topic>/<Module>.tla    MODULE 名とファイル名を一致させる(TLC の要件)
specs/<topic>/<Module>.cfg    同名の .cfg は自動で使われる
specs/<topic>/<Helper>.tla    EXTENDS する自作モジュールも同じフォルダに置く(TLC は spec のあるフォルダから探す)
```

## 実行

```powershell
tla check specs\<topic>\<Module>.tla
tla check --json --workers 1 specs\<topic>\<Module>.tla   # 最短の反例が欲しいとき
tla pcal specs\<topic>\<Module>.tla                        # PlusCal の翻訳(同じファイルを書き換える)
```

MCP の `tlc` ツールでは、`spec` に `specs/<topic>/<Module>.tla` を渡す(lab からの相対パス。絶対パスも可)。

## `work/` との使い分け

Claude にインラインで渡した spec は `work/` に入る。ここは `.gitignore` 済みの一時置き場で、同じモジュール名なら上書きされる。残したいものは `specs/<topic>/` に移す。

## 公開しないものの置き場

このリポジトリが公開なら、仕事に関係するものや整理前のものは `specs/` に入れない。`tlc` の `spec` には絶対パスも渡せるので、リポジトリの外に置いても同じように検査できる。
