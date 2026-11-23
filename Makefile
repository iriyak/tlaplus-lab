JAR_URL ?= https://github.com/tlaplus/tlaplus/releases/latest/download/tla2tools.jar

.PHONY: jar test clean
jar: lib/tla2tools.jar

lib/tla2tools.jar:
	mkdir -p lib
	curl -fL -o $@ $(JAR_URL)
	@bin/tla version

test: jar
	bin/tla check examples/DieHard.tla || test $$? -eq 12
	bun run mcp/smoke-test.ts

clean:
	rm -rf work states
