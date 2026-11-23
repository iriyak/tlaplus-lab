---------------------------- MODULE RaceCounter ----------------------------
(* PlusCal の例。2 つのワーカーが共有カウンタを「読む→書く」の 2 ステップで
   加算する。ステップが分かれているため lost update が起き、Correct が破れる。
   使い方:  tla pcal examples/RaceCounter.tla   (翻訳を同じファイルに挿入)
            tla check examples/RaceCounter.tla *)
EXTENDS Naturals

(*--algorithm RaceCounter
variables counter = 0;

process Worker \in 1..2
variables tmp = 0;
begin
  Read:  tmp := counter;
  Write: counter := tmp + 1;
end process;
end algorithm; *)

Correct == (\A self \in 1..2 : pc[self] = "Done") => counter = 2
=============================================================================
