
.DEFAULT_GOAL := help

.PHONY: help setup fmt fmt-check lint security test build check clean

## Show available commands
help:
	@echo "Intelligent IoT Solutions - Development commands"
	@echo ""
	@echo "make setup      Install development dependencies"
	@echo "make fmt        Format Python code"
	@echo "make fmt-check  Check Python formatting"
	@echo "make lint       Check Python code quality"
	@echo "make security   Scan dependencies for vulnerabilities"
	@echo "make test       Run automated tests"
	@echo "make build      Build Docker image"
	@echo "make check      Run all quality checks and tests"
	@echo "make clean      Remove temporary Python files"

## Install development dependencies
setup:
	python -m pip install -r requirements.txt
	python -m pip install -r requirements-dev.txt

## Format Python code
fmt:
	ruff format .

## Check formatting without changing files
fmt-check:
	ruff format --check .

## Check Python code quality
lint:
	ruff check .

## Scan dependencies for known vulnerabilities
security:
	pip-audit -r requirements.txt

## Run automated tests
test:
	pytest -q

## Build Docker image
build:
	docker compose build api

## Run all checks
check: fmt-check lint security test build

## Remove temporary Python files
clean:
	python -c "import pathlib, shutil; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]; [p.unlink() for p in pathlib.Path('.').rglob('*.pyc')]"
