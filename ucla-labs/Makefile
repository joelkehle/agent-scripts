.PHONY: help install fetch catalog index search clean

PYTHON ?= python3
Q ?= cancer immunotherapy

help:
	@echo "Targets:"
	@echo "  install   pip install requirements"
	@echo "  fetch     run all fetchers (nih, nsf, trials, scholar)"
	@echo "  catalog   build merged catalog jsonl"
	@echo "  index     embed and build sqlite-vec db"
	@echo "  search    semantic search (override Q=...)"
	@echo "  all       full pipeline end-to-end"

install:
	$(PYTHON) -m pip install -r requirements.txt

fetch:
	$(PYTHON) -m src.fetch_nih
	$(PYTHON) -m src.fetch_nsf
	$(PYTHON) -m src.fetch_trials
	$(PYTHON) -m src.fetch_scholar

catalog:
	$(PYTHON) -m src.build_catalog

index:
	$(PYTHON) -m src.embed_and_index

search:
	$(PYTHON) -m src.search "$(Q)"

all: install fetch catalog index
	@echo "Done. Try: make search Q='your query'"

clean:
	rm -rf data/raw/*.jsonl data/catalog.jsonl data/catalog.db
