# practical-tla

Hillel Wayne, *Practical TLA+: Planning Driven Development*(Apress, 2018)を読みながらの実験場。

## 置き方

```
specs/practical-tla/_book/chNN/   本のコードを写したもの(.gitignore 済み。リポジトリに入れない)
specs/practical-tla/chNN/         自分で書き換えた版、練習問題、実験の記録(コミットする)
```

本のコード(リスト)は著者と出版社の著作物なので、公開リポジトリには写しを入れない。`_book/` は手元で動かして読むための置き場にする。リポジトリに残すのは、自分で書いた変更・問題・メモと、それを動かすための `.cfg`。書籍の配布ソースコードを使う場合は、出版社の書籍ページの案内に従うこと(利用条件はそこで確認する)。

## Toolbox の設定 → `.cfg`

本は TLA+ Toolbox でモデルを作る前提で書かれている。CLI では、モデルの設定がそのまま `.cfg` になる。

| Toolbox のモデル設定 | `.cfg` の書き方 |
|---|---|
| Behavior Spec(Temporal formula) | `SPECIFICATION Spec` |
| Behavior Spec(Init / Next) | `INIT Init` と `NEXT Next` |
| Invariants | `INVARIANT TypeOK` |
| Properties | `PROPERTY Termination` |
| Constants(通常の値) | `CONSTANTS Max = 3` |
| Constants(モデル値の集合) | `CONSTANTS Users = {u1, u2}`(`u1`、`u2` はモデル値として扱われる) |
| Symmetry set | spec 側に `Sym == Permutations(Users)` を書き、`SYMMETRY Sym` |
| State constraint | `CONSTRAINT Bound` |
| Deadlock の検査をしない | `CHECK_DEADLOCK FALSE`(終了する spec では付ける) |
| Translate PlusCal Algorithm | `tla pcal <file>.tla` |

`.cfg` に書いた項目は、実際に TLC で通ることを確認済み。複数の項目は 1 行ずつ書き並べる(`INVARIANT` を複数行に分けてもよい)。

## 実行

```powershell
tla pcal specs\practical-tla\_book\chNN\<Module>.tla    # PlusCal の spec のとき
tla check specs\practical-tla\_book\chNN\<Module>.tla
```

`tlc` ツール(MCP)でも、`spec` に同じパスを渡せる。
