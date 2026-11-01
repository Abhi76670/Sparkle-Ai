.PHONY: run dev check build clean

run:
	npx tsx server.ts

dev:
	npx tsx server.ts

check:
	npx tsc --noEmit

build:
	npx tsc --noEmit

clean:
	rm -rf dist server.js
