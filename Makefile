.PHONY: all clean install build package test-local test

# Variables
BIN_DIR := bin
EXTENSION_NAME := vscode-winccoa-database
VERSION := $(shell node -p "require('./package.json').version")
EXT_PUBLISHER := winccoa-tools-pack
EXT_NAME := vscode-winccoa-database
EXT_ID := $(EXT_PUBLISHER).$(EXT_NAME)
NPM := npm
VSCE := npx vsce

# Test workspace configuration
# On Linux: set TEST_WORKSPACE to your WinCC OA project directory
TEST_WORKSPACE ?= .
CODE_BIN ?= code
FORCE_CLOSE_VSCODE ?= no
SKIP_UNINSTALL ?= yes
CLOSE_OLD_WINDOW ?= no

# Local build counter file
LOCAL_COUNTER_FILE := $(BIN_DIR)/.local_build_counter

# OS Detection
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    RM := del /Q /F
    RMDIR := rmdir /S /Q
    MKDIR := mkdir
    KILL_CODE := taskkill /IM Code.exe /F 2>nul || echo "No VS Code process found"
else
    DETECTED_OS := $(shell uname -s)
    RM := rm -f
    RMDIR := rm -rf
    MKDIR := mkdir -p
    KILL_CODE := pkill -f "$(CODE_BIN)" 2>/dev/null || echo "No VS Code process found"
endif

# Default target
all: clean install build package

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf out dist node_modules
	@rm -rf $(BIN_DIR)
	@echo "Clean complete."

# Install dependencies
install:
	@echo "Installing dependencies..."
	@$(NPM) install
	@echo "Dependencies installed."

# Build TypeScript sources
build:
	@echo "Building extension..."
	@$(NPM) run compile
	@echo "Build complete."

# Run tests
test:
	@echo "Running tests..."
	@$(NPM) test
	@echo "Tests complete."

# Package extension into .vsix file (production release)
package:
	@echo "Packaging production release..."
	@-$(MKDIR) $(BIN_DIR) 2>/dev/null || true
	@echo "Updating version badge in README.md..."
	@node -e "const fs=require('fs'); let c=fs.readFileSync('README.md','utf8'); c=c.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/,'![Version](https://img.shields.io/badge/version-$(VERSION)-blue.svg)'); fs.writeFileSync('README.md',c);"
	@$(VSCE) package --out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Extension packaged to $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

# Quick build without cleaning
quick: build package

# Development watch mode
watch:
	@$(NPM) run watch

# Rebuild (clean + install + build)
rebuild: clean install build

# Local test target - Build, package with local stamp, replace extension, restart VS Code
test-local:
	@node scripts/test-local.js $(BIN_DIR) $(EXTENSION_NAME) $(VERSION) $(EXT_ID) $(CODE_BIN) $(TEST_WORKSPACE)

# Help target
help:
	@echo "Available targets:"
	@echo "  all          - Clean, install, build and package (default)"
	@echo "  clean        - Remove build artifacts and node_modules"
	@echo "  install      - Install npm dependencies"
	@echo "  build        - Compile TypeScript sources"
	@echo "  test         - Run tests"
	@echo "  package      - Create .vsix package in bin/ directory (with version badge update)"
	@echo "  quick        - Build and package without cleaning"
	@echo "  watch        - Watch and recompile extension on changes"
	@echo "  rebuild      - Clean, install and build"
	@echo "  test-local   - Build, package with local stamp, install into running VS Code"
	@echo "                 Use: TEST_WORKSPACE=/path/to/winccoa-project make test-local"
	@echo "  help         - Show this help message"
	@echo ""
	@echo "Configuration:"
	@echo "  TEST_WORKSPACE        - Path to test workspace (default: .)"
	@echo "  CODE_BIN              - VS Code binary (default: code, use 'code-insiders' for Insiders)"
