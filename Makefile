MAKEFILE_DIR := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

.PHONY: help
help: ## Show this help message
	@echo "Makefile commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install packages required to node_modules/
	@npm install

.PHONY: build
build: ## Build the main.js file
	@npm run build

.PHONY: clean
clean: ## Remove the node_modules directory
	@rm -rf $(MAKEFILE_DIR)/node_modules/ && \
		echo "Removed node_modules directory."
