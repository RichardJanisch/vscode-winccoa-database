.PHONY: all clean install build package test test-local test-unit lint \
       quick watch rebuild prebuilds help

# ── Variables ─────────────────────────────────────────────────────────
BIN_DIR       := bin
PREBUILDS_DIR := prebuilds
EXTENSION_NAME := vscode-winccoa-database
VERSION       := $(shell node -p "require('./package.json').version")
EXT_PUBLISHER := winccoa-tools-pack
EXT_ID        := $(EXT_PUBLISHER).$(EXTENSION_NAME)
NPM           := npm
VSCE          := npx @vscode/vsce
PLATFORM      := $(shell node -p "process.platform")
ARCH          := $(shell node -p "process.arch")
NODE_ABI      := $(shell node -p "process.versions.modules")

# Test workspace configuration
TEST_WORKSPACE ?= .
CODE_BIN       ?= code

# ── Default ───────────────────────────────────────────────────────────
all: clean install build prebuilds package

# ── Clean ─────────────────────────────────────────────────────────────
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf out dist $(BIN_DIR) $(PREBUILDS_DIR)
	@echo "Clean complete."

clean-all: clean
	@echo "Removing node_modules..."
	@rm -rf node_modules
	@echo "Clean-all complete."

# ── Install ───────────────────────────────────────────────────────────
install:
	@echo "Installing dependencies..."
	@$(NPM) install
	@echo "Dependencies installed."

# ── Build ─────────────────────────────────────────────────────────────
build:
	@echo "Building extension..."
	@$(NPM) run compile
	@echo "Build complete."

# ── Native prebuilds ─────────────────────────────────────────────────
# Collects better-sqlite3 binaries for both Node.js and Electron so the
# extension works in local VS Code (Electron) AND Remote SSH (Node.js).

prebuilds: prebuild-node prebuild-electron
	@echo "Prebuilds collected in $(PREBUILDS_DIR)/$(PLATFORM)-$(ARCH)/"
	@ls -1 $(PREBUILDS_DIR)/$(PLATFORM)-$(ARCH)/

prebuild-node:
	@echo "Rebuilding better-sqlite3 for Node.js (ABI $(NODE_ABI))..."
	@cd node_modules/better-sqlite3 && node-gyp rebuild --release
	@echo "Collecting Node.js prebuild (ABI $(NODE_ABI))..."
	@node scripts/collect-prebuilds.js --node

prebuild-electron:
	@echo "Rebuilding for Electron..."
	@$(NPM) run rebuild
	@echo "Collecting Electron prebuild..."
	@node scripts/collect-prebuilds.js --electron

# ── Package ───────────────────────────────────────────────────────────
package:
	@echo "Packaging VSIX..."
	@mkdir -p $(BIN_DIR)
	@$(VSCE) package --out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Packaged: $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

package-target:
	@echo "Packaging platform-specific VSIX ($(PLATFORM)-$(ARCH))..."
	@mkdir -p $(BIN_DIR)
	@$(VSCE) package --target $(PLATFORM)-$(ARCH) \
		--out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION)-$(PLATFORM)-$(ARCH).vsix
	@echo "Packaged: $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION)-$(PLATFORM)-$(ARCH).vsix"

# ── Lint & Test ───────────────────────────────────────────────────────
lint:
	@$(NPM) run lint

test: test-unit

test-unit:
	@$(NPM) run test:unit

test-local:
	@node scripts/test-local.js $(BIN_DIR) $(EXTENSION_NAME) $(VERSION) \
		$(EXT_ID) $(CODE_BIN) $(TEST_WORKSPACE)

# ── Dev shortcuts ─────────────────────────────────────────────────────
quick: build prebuilds package

watch:
	@$(NPM) run watch

rebuild: clean-all install build

# ── Info ──────────────────────────────────────────────────────────────
info:
	@echo "Extension:  $(EXT_ID) v$(VERSION)"
	@echo "Platform:   $(PLATFORM)-$(ARCH)"
	@echo "Node ABI:   $(NODE_ABI)"
	@echo "Prebuilds:  $(PREBUILDS_DIR)/$(PLATFORM)-$(ARCH)/"
	@test -d "$(PREBUILDS_DIR)/$(PLATFORM)-$(ARCH)" \
		&& ls -1 $(PREBUILDS_DIR)/$(PLATFORM)-$(ARCH)/ \
		|| echo "  (none — run 'make prebuilds')"

# ── Help ──────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Build & Package:"
	@echo "  all              Clean, install, build, prebuilds, package (default)"
	@echo "  install          Install npm dependencies"
	@echo "  build            Compile TypeScript via webpack"
	@echo "  prebuilds        Collect native binaries for Node + Electron"
	@echo "  package          Create universal .vsix in bin/"
	@echo "  package-target   Create platform-specific .vsix in bin/"
	@echo "  quick            Build + prebuilds + package (no clean/install)"
	@echo ""
	@echo "Quality:"
	@echo "  lint             Run ESLint"
	@echo "  test             Run unit tests (alias for test-unit)"
	@echo "  test-unit        Run unit tests"
	@echo "  test-local       Build, install into VS Code, open workspace"
	@echo ""
	@echo "Housekeeping:"
	@echo "  clean            Remove dist/, bin/, prebuilds/"
	@echo "  clean-all        clean + remove node_modules/"
	@echo "  rebuild          clean-all + install + build"
	@echo "  watch            Webpack watch mode"
	@echo "  info             Show current build environment"
	@echo ""
	@echo "Options:"
	@echo "  TEST_WORKSPACE   Path to WinCC OA project  (default: .)"
	@echo "  CODE_BIN         VS Code binary             (default: code)"
	@echo ""
